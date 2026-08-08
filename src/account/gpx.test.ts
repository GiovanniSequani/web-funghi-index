// @vitest-environment jsdom
import { gzipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { decodeCloudGpx } from './gpx';

describe('GPX cloud map data', () => {
  it('estrae percorso, ritrovamenti, conteggi e estremi', async () => {
    const xml = `<?xml version="1.0"?><gpx>
      <trk><name>Bosco</name><trkseg>
        <trkpt lat="46" lon="11"/><trkpt lat="46.01" lon="11.02"/>
      </trkseg></trk>
      <wpt lat="46.002" lon="11.003"><name>Porcino_1</name><type>Porcino</type></wpt>
      <wpt lat="46.004" lon="11.006"><name>Gallinaccio_1</name><type>Finferlo</type></wpt>
      <wpt lat="46.005" lon="11.007"><name>Sosta</name></wpt>
    </gpx>`;
    const data = await decodeCloudGpx(new Blob([gzipSync(strToU8(xml))], { type: 'application/gzip' }), 'bosco.gpx');

    expect(data.lines.features).toHaveLength(1);
    expect(data.findings.features).toHaveLength(2);
    expect(data.porciniCount).toBe(1);
    expect(data.finferliCount).toBe(1);
    expect(data.start).toEqual([11, 46]);
    expect(data.end).toEqual([11.02, 46.01]);
    expect(data.bbox).toEqual([11, 46, 11.02, 46.01]);
  });
});
