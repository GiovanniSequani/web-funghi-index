import { describe, expect, it } from 'vitest';
import { buildTrackFeatures, getStoredTrim, isTrackEditable } from './trackEditing';
import type { CloudMapTrack, GpxMapData, GpxTrack } from './types';

const data: GpxMapData = {
  lines: { type: 'FeatureCollection', features: [] },
  findings: { type: 'FeatureCollection', features: [] },
  start: [11, 46],
  end: [11.04, 46.04],
  bbox: [11, 46, 11.04, 46.04],
  porciniCount: 0,
  finferliCount: 0,
  rawPointCount: 5,
  trackPoints: Array.from({ length: 5 }, (_, pointIndex) => ({ pointIndex, coordinate: [11 + pointIndex / 100, 46 + pointIndex / 100] as [number, number] })),
  trackSegments: [],
  usesTrackPoints: true,
};
data.trackSegments = [{ points: data.trackPoints }];

const serverTrack: GpxTrack = {
  id: 'track-1',
  storage_path: 'user/track-1.gpx.gz',
  status: 'ready',
  display_name: 'Bosco',
  original_filename: 'bosco.gpx.gz',
  compressed_size_bytes: 100,
  uncompressed_size_bytes: 200,
  started_at: null,
  ended_at: null,
  point_count: 5,
  distance_m: 50,
  trim_start_point_index: 1,
  trim_end_point_index: 3,
  ready_at: '2026-08-16T10:00:00Z',
  created_at: '2026-08-16T10:00:00Z',
};

const cloudTrack: CloudMapTrack = {
  id: serverTrack.id,
  name: serverTrack.display_name,
  data,
  track: serverTrack,
  markers: [
    { track_id: serverTrack.id, track_point_index: 0, latitude: 46, longitude: 11, species: 'porcini', count: 2 },
    { track_id: serverTrack.id, track_point_index: 2, latitude: 46.02, longitude: 11.02, species: 'finferli', count: 4 },
    { track_id: serverTrack.id, track_point_index: 2, latitude: 46.02, longitude: 11.02, species: 'porcini', count: 2 },
  ],
};

describe('editing GPX cloud', () => {
  it('usa gli indici inclusivi del backend e richiede corrispondenza esatta dei trkpt', () => {
    expect(getStoredTrim(serverTrack, data)).toEqual([1, 3]);
    expect(isTrackEditable(cloudTrack)).toBe(true);
    expect(isTrackEditable({ ...cloudTrack, data: { ...data, rawPointCount: 4 } })).toBe(false);
  });

  it('separa graficamente tratto mantenuto ed escluso preservando il confine', () => {
    const features = buildTrackFeatures(cloudTrack, 0);
    const kept = features.filter((feature) => feature.properties?.kind === 'kept-line') as GeoJSON.Feature<GeoJSON.LineString>[];
    const excluded = features.filter((feature) => feature.properties?.kind === 'excluded-line') as GeoJSON.Feature<GeoJSON.LineString>[];
    expect(kept[0].geometry.coordinates).toEqual([[11.01, 46.01], [11.02, 46.02], [11.03, 46.03]]);
    expect(excluded).toHaveLength(2);
  });

  it('nasconde i marker fuori trim e mantiene count e point_index del marker visibile', () => {
    const marker = buildTrackFeatures(cloudTrack, 0).find((feature) => feature.properties?.kind === 'cloud-marker');
    expect(marker?.properties).toMatchObject({ countLabel: 'P2 F4', markerSpecies: 'mixed', pointIndex: 2 });
    expect(marker?.geometry).toEqual({ type: 'Point', coordinates: [11.02, 46.02] });
  });

  it('la preview cambia solo la presentazione, senza alterare i dati server', () => {
    const preview = { ...cloudTrack, preview: { trimStart: 2, trimEnd: 4, markers: cloudTrack.markers } };
    const endpoints = buildTrackFeatures(preview, 0).filter((feature) => feature.properties?.kind === 'start' || feature.properties?.kind === 'end');
    expect(endpoints.map((feature) => feature.geometry)).toEqual([
      { type: 'Point', coordinates: [11.02, 46.02] },
      { type: 'Point', coordinates: [11.04, 46.04] },
    ]);
    expect(serverTrack.trim_start_point_index).toBe(1);
  });
});
