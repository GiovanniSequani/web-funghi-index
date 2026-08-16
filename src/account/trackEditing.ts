import type { CloudMapTrack, GpxEditDraft, GpxMapData, GpxMushroomMarker, GpxTrack } from './types';

export function getStoredTrim(track: GpxTrack, data: GpxMapData): [number, number] {
  const last = Math.max(0, data.rawPointCount - 1);
  return [track.trim_start_point_index ?? 0, track.trim_end_point_index ?? last];
}

export function getActiveDraft(track: CloudMapTrack): GpxEditDraft {
  if (track.preview) return track.preview;
  const [trimStart, trimEnd] = getStoredTrim(track.track, track.data);
  return { trimStart, trimEnd, markers: track.markers };
}

export function isTrackEditable(track: CloudMapTrack): boolean {
  const expected = track.track.point_count;
  return track.data.usesTrackPoints && expected !== null && expected >= 2
    && track.data.rawPointCount === expected && track.data.trackPoints.length === expected
    && track.data.trackPoints.every((point, index) => point.pointIndex === index);
}

function lineFeature(coordinates: [number, number][], properties: Record<string, string | number>): GeoJSON.Feature<GeoJSON.LineString> | null {
  if (coordinates.length < 2) return null;
  return { type: 'Feature', properties, geometry: { type: 'LineString', coordinates } };
}

export function markerKey(marker: Pick<GpxMushroomMarker, 'track_point_index' | 'species'>): string {
  return marker.track_point_index + ':' + marker.species;
}

export function buildTrackFeatures(track: CloudMapTrack, colorIndex: number): GeoJSON.Feature[] {
  const draft = getActiveDraft(track);
  const lineProperties = { routeId: track.id, colorIndex };
  const features: GeoJSON.Feature[] = [];
  for (const segment of track.data.trackSegments) {
    const kept = segment.points.filter((point) => point.pointIndex >= draft.trimStart && point.pointIndex <= draft.trimEnd);
    const before = draft.trimStart > 0 ? segment.points.filter((point) => point.pointIndex <= draft.trimStart) : [];
    const after = draft.trimEnd < track.data.rawPointCount - 1 ? segment.points.filter((point) => point.pointIndex >= draft.trimEnd) : [];
    const beforeFeature = lineFeature(before.map((point) => point.coordinate), { ...lineProperties, kind: 'excluded-line' });
    const afterFeature = lineFeature(after.map((point) => point.coordinate), { ...lineProperties, kind: 'excluded-line' });
    const keptFeature = lineFeature(kept.map((point) => point.coordinate), { ...lineProperties, kind: 'kept-line' });
    if (beforeFeature) features.push(beforeFeature);
    if (afterFeature) features.push(afterFeature);
    if (keptFeature) features.push(keptFeature);
  }

  features.push(...track.data.findings.features.map((feature) => ({
    ...feature,
    properties: { ...feature.properties, routeId: track.id, kind: 'finding' },
  })));

  const pointByIndex = new Map(track.data.trackPoints.map((point) => [point.pointIndex, point.coordinate]));
  const grouped = new Map<number, { porcini: number; finferli: number }>();
  for (const marker of draft.markers) {
    if (marker.track_point_index < draft.trimStart || marker.track_point_index > draft.trimEnd) continue;
    const counts = grouped.get(marker.track_point_index) ?? { porcini: 0, finferli: 0 };
    counts[marker.species] += marker.count;
    grouped.set(marker.track_point_index, counts);
  }
  for (const [pointIndex, counts] of grouped) {
    const coordinate = pointByIndex.get(pointIndex);
    if (!coordinate) continue;
    const markerSpecies = counts.porcini > 0 && counts.finferli > 0 ? 'mixed' : counts.porcini > 0 ? 'porcini' : 'finferli';
    const countLabel = counts.porcini > 0 && counts.finferli > 0
      ? 'P' + counts.porcini + ' F' + counts.finferli
      : String(counts.porcini || counts.finferli);
    features.push({
      type: 'Feature',
      properties: { routeId: track.id, kind: 'cloud-marker', pointIndex, markerSpecies, countLabel },
      geometry: { type: 'Point', coordinates: coordinate },
    });
  }

  const start = pointByIndex.get(draft.trimStart);
  const end = pointByIndex.get(draft.trimEnd);
  if (start) features.push({ type: 'Feature', properties: { routeId: track.id, kind: 'start' }, geometry: { type: 'Point', coordinates: start } });
  if (end) features.push({ type: 'Feature', properties: { routeId: track.id, kind: 'end' }, geometry: { type: 'Point', coordinates: end } });
  return features;
}

export function getTrackVisibleBbox(track: CloudMapTrack): [number, number, number, number] {
  const { trimStart, trimEnd } = getActiveDraft(track);
  const points = track.data.trackPoints.filter((point) => point.pointIndex >= trimStart && point.pointIndex <= trimEnd).map((point) => point.coordinate);
  if (points.length === 0) return track.data.bbox;
  const longitudes = points.map(([longitude]) => longitude);
  const latitudes = points.map(([, latitude]) => latitude);
  return [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)];
}

export function markerMap(markers: GpxMushroomMarker[]): Map<string, GpxMushroomMarker> {
  return new Map(markers.map((marker) => [markerKey(marker), marker]));
}
