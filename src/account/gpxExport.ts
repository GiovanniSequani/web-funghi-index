import { AccountArchiveError, type GpxMapData, type GpxMushroomMarker, type GpxTrack } from './types';
import { getStoredTrim } from './trackEditing';

const GPX_NAMESPACE = 'http://www.topografix.com/GPX/1/1';
const FUNGHITRACKER_NAMESPACE = 'https://funghitracker.it/gpx/1';

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[character] ?? character);
}

function coordinate(value: number): string {
  if (!Number.isFinite(value)) throw new AccountArchiveError('invalid_gpx', 'La traccia contiene coordinate non valide.');
  return String(value);
}

function safeDerivedFilename(name: string): string {
  const clean = name.replace(/[\\/:*?"<>|]+/g, '-').replace(/\.gpx(?:\.gz)?$/i, '').trim() || 'traccia';
  return `${clean}.gpx`;
}

function markerXml(marker: GpxMushroomMarker, name: string): string {
  const species = marker.species === 'porcini' ? 'porcino' : 'finferlo';
  return [
    `  <wpt lat="${coordinate(marker.latitude)}" lon="${coordinate(marker.longitude)}">`,
    `    <name>${name}</name>`,
    `    <type>${species}</type>`,
    `    <desc>${species === 'porcino' ? 'Porcini' : 'Finferli'}: ${marker.count}</desc>`,
    '    <extensions>',
    `      <funghitracker:species>${marker.species}</funghitracker:species>`,
    `      <funghitracker:count>${marker.count}</funghitracker:count>`,
    '    </extensions>',
    '  </wpt>',
  ].join('\n');
}

/**
 * Creates a local, derived GPX export. The private Storage object remains the
 * immutable source GPX: its current name, trim and editor markers live in the
 * database and are applied only to this browser-generated copy.
 */
export function createDerivedGpxExport(
  track: GpxTrack,
  data: GpxMapData,
  markers: GpxMushroomMarker[],
): { blob: Blob; filename: string } {
  const [trimStart, trimEnd] = getStoredTrim(track, data);
  if (trimStart < 0 || trimEnd < trimStart || trimEnd >= data.rawPointCount) {
    throw new AccountArchiveError('invalid_gpx', 'Il taglio salvato della traccia non è valido. Aggiorna l’archivio e riprova.');
  }

  const keptSegments = data.trackSegments
    .map((segment) => segment.points.filter((point) => point.pointIndex >= trimStart && point.pointIndex <= trimEnd))
    .filter((points) => points.length > 0);
  const keptPointCount = keptSegments.reduce((total, points) => total + points.length, 0);
  if (keptPointCount < 2) {
    throw new AccountArchiveError('invalid_gpx', 'Il taglio salvato deve mantenere almeno due punti.');
  }

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<gpx version="1.1" creator="FunghiTracker" xmlns="${GPX_NAMESPACE}" xmlns:funghitracker="${FUNGHITRACKER_NAMESPACE}">`,
  ];

  // Historical GPX waypoints are preserved with their original names. New
  // editor markers are appended below with independent names per species.
  for (const finding of data.findings.features) {
    const [longitude, latitude] = finding.geometry.coordinates;
    const type = finding.properties.species;
    lines.push(
      `  <wpt lat="${coordinate(latitude)}" lon="${coordinate(longitude)}">`,
      `    <name>${escapeXml(finding.properties.name)}</name>`,
      `    <type>${type}</type>`,
      '  </wpt>',
    );
  }

  const pointByIndex = new Map(data.trackPoints.map((point) => [point.pointIndex, point]));
  const newMarkers = markers
    .filter((marker) => marker.track_point_index >= trimStart && marker.track_point_index <= trimEnd)
    .filter((marker) => pointByIndex.has(marker.track_point_index))
    .sort((left, right) => left.track_point_index - right.track_point_index || left.species.localeCompare(right.species));
  let porciniIndex = 0;
  let finferliIndex = 0;
  for (const marker of newMarkers) {
    const name = marker.species === 'porcini' ? `porcino${++porciniIndex}` : `finferlo${++finferliIndex}`;
    const point = pointByIndex.get(marker.track_point_index)!;
    const [longitude, latitude] = point.coordinate;
    // The server marker is keyed to the original GPX point index. Export that
    // canonical coordinate rather than a rounded display coordinate.
    lines.push(markerXml({ ...marker, latitude, longitude }, name));
  }

  if (data.usesTrackPoints) {
    lines.push('  <trk>', `    <name>${escapeXml(track.display_name)}</name>`);
    for (const segment of keptSegments) {
      lines.push('    <trkseg>');
      for (const point of segment) {
        const [longitude, latitude] = point.coordinate;
        lines.push(`      <trkpt lat="${coordinate(latitude)}" lon="${coordinate(longitude)}"/>`);
      }
      lines.push('    </trkseg>');
    }
    lines.push('  </trk>');
  } else {
    lines.push('  <rte>', `    <name>${escapeXml(track.display_name)}</name>`);
    for (const segment of keptSegments) {
      for (const point of segment) {
        const [longitude, latitude] = point.coordinate;
        lines.push(`    <rtept lat="${coordinate(latitude)}" lon="${coordinate(longitude)}"/>`);
      }
    }
    lines.push('  </rte>');
  }

  lines.push('</gpx>', '');
  return {
    blob: new Blob([lines.join('\n')], { type: 'application/gpx+xml;charset=utf-8' }),
    filename: safeDerivedFilename(track.display_name),
  };
}
