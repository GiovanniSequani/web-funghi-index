// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { prepareImportedGpx } from './gpx';
import { getTrackDateIso } from './trackDate';
import type { ArchiveConfig } from './types';

describe('data del percorso GPX cloud', () => {
  it('mantiene la data storica ricavata dai time del GPX importato', async () => {
    const xml = '<?xml version="1.0"?><gpx><trk><trkseg>'
      + '<trkpt lat="46" lon="11"><time>2017-09-16T05:20:00Z</time></trkpt>'
      + '<trkpt lat="46.01" lon="11.02"><time>2017-09-16T06:45:00Z</time></trkpt>'
      + '</trkseg></trk></gpx>';
    const config = {
      max_uncompressed_bytes: 1_000_000,
      max_compressed_bytes: 1_000_000,
    } as ArchiveConfig;
    const prepared = await prepareImportedGpx(
      new File([xml], 'percorso-storico.gpx', { type: 'application/gpx+xml' }),
      config,
    );

    expect(prepared.startedAt).toBe('2017-09-16T05:20:00.000Z');
    expect(getTrackDateIso({
      started_at: prepared.startedAt,
      ready_at: '2026-08-23T10:00:00.000Z',
      created_at: '2026-08-23T09:55:00.000Z',
    })).toBe('2017-09-16T05:20:00.000Z');
  });

  it('usa ready_at soltanto quando il GPX non contiene timestamp', () => {
    expect(getTrackDateIso({
      started_at: null,
      ready_at: '2026-08-22T10:00:00.000Z',
      created_at: '2026-08-21T10:00:00.000Z',
    })).toBe('2026-08-22T10:00:00.000Z');
  });
});