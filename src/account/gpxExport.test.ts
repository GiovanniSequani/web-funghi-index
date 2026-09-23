// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createDerivedGpxExport } from './gpxExport';
import type { GpxMapData, GpxMushroomMarker, GpxTrack } from './types';

const track: GpxTrack = {
  id: 'usa-e-getta',
  storage_path: 'owner/usa-e-getta.gpx.gz',
  status: 'ready',
  display_name: 'Valle rinominata',
  original_filename: 'traccia-storica.gpx.gz',
  compressed_size_bytes: 100,
  uncompressed_size_bytes: 200,
  started_at: null,
  ended_at: null,
  point_count: 5,
  distance_m: 100,
  trim_start_point_index: 1,
  trim_end_point_index: 3,
  ready_at: '2026-09-23T10:00:00Z',
  created_at: '2026-09-23T10:00:00Z',
};

const points = Array.from({ length: 5 }, (_, pointIndex) => ({
  pointIndex,
  coordinate: [11 + pointIndex / 100, 46 + pointIndex / 100] as [number, number],
}));

const data: GpxMapData = {
  lines: { type: 'FeatureCollection', features: [] },
  findings: {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { species: 'porcino', name: 'Porcino storico 7' },
      geometry: { type: 'Point', coordinates: [11.2, 46.2] },
    }],
  },
  start: points[0].coordinate,
  end: points[4].coordinate,
  bbox: [11, 46, 11.04, 46.04],
  porciniCount: 1,
  finferliCount: 0,
  rawPointCount: points.length,
  trackPoints: points,
  trackSegments: [{ points }],
  usesTrackPoints: true,
};

const markers: GpxMushroomMarker[] = [
  { track_id: track.id, track_point_index: 0, latitude: 46, longitude: 11, species: 'porcini', count: 9 },
  { track_id: track.id, track_point_index: 2, latitude: 46.02, longitude: 11.02, species: 'finferli', count: 2 },
  { track_id: track.id, track_point_index: 3, latitude: 46.03, longitude: 11.03, species: 'porcini', count: 3 },
];

describe('derived cloud GPX export', () => {
  it('usa il nome e il trim correnti senza modificare il GPX raw', async () => {
    const exportFile = createDerivedGpxExport(track, data, markers);
    const xml = await exportFile.blob.text();
    const document = new DOMParser().parseFromString(xml, 'application/xml');

    expect(exportFile.filename).toBe('Valle rinominata.gpx');
    expect(document.querySelector('trk > name')?.textContent).toBe('Valle rinominata');
    expect([...document.querySelectorAll('trkpt')].map((point) => point.getAttribute('lon')))
      .toEqual(['11.01', '11.02', '11.03']);
    expect(xml).not.toContain('lon="11"');
    expect(xml).not.toContain('lon="11.04"');
  });

  it('preserva i marker storici e aggiunge marker nuovi con progressivi per specie e quantità', async () => {
    const xml = await createDerivedGpxExport(track, data, markers).blob.text();
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    const waypoints = [...document.querySelectorAll('wpt')];

    expect(waypoints.map((waypoint) => waypoint.querySelector('name')?.textContent))
      .toEqual(['Porcino storico 7', 'finferlo1', 'porcino1']);
    expect(waypoints.map((waypoint) => waypoint.querySelector('type')?.textContent))
      .toEqual(['porcino', 'finferlo', 'porcino']);
    expect(xml).toContain('<funghitracker:count>2</funghitracker:count>');
    expect(xml).toContain('<funghitracker:count>3</funghitracker:count>');
    expect(xml).not.toContain('Porcino storico 1');
    expect(xml).not.toContain('Porcini: 9');
  });

  it('esporta percorsi storici come route GPX senza richiedere trkpt', async () => {
    const historical = { ...data, usesTrackPoints: false };
    const xml = await createDerivedGpxExport({ ...track, trim_start_point_index: null, trim_end_point_index: null }, historical, []).blob.text();

    expect(xml).toContain('<rte>');
    expect(xml).toContain('<rtept lat="46" lon="11"/>');
    expect(xml).not.toContain('<trk>');
  });
});
