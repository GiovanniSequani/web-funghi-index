// @vitest-environment jsdom
import { gzipSync, strToU8 } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { decodeCloudGpx, prepareImportedGpx } from './gpx';
import type { ArchiveConfig } from './types';

const limits = {
  max_compressed_bytes: 100_000,
  max_uncompressed_bytes: 500_000,
} as ArchiveConfig;

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
    const data = await decodeCloudGpx(new Blob([gzipSync(strToU8(xml))], { type: 'application/gzip' }), 'bosco.gpx', limits);

    expect(data.lines.features).toHaveLength(1);
    expect(data.findings.features).toHaveLength(2);
    expect(data.porciniCount).toBe(1);
    expect(data.finferliCount).toBe(1);
    expect(data.start).toEqual([11, 46]);
    expect(data.end).toEqual([11.02, 46.01]);
    expect(data.bbox).toEqual([11, 46, 11.02, 46.01]);
    expect(data.rawPointCount).toBe(2);
    expect(data.trackPoints.map((point) => point.pointIndex)).toEqual([0, 1]);
    expect(data.usesTrackPoints).toBe(true);
  });

  it('mantiene il normale flusso di upload per un GPX gzip valido', async () => {
    const xml = '<gpx><trk><name>Uscita</name><trkseg><trkpt lat="46" lon="11"/><trkpt lat="46.1" lon="11.1"/></trkseg></trk></gpx>';
    const compressed = gzipSync(strToU8(xml));
    const prepared = await prepareImportedGpx(
      new File([compressed], 'uscita.gpx.gz', { type: 'application/gzip' }),
      limits,
    );

    expect(prepared.pointCount).toBe(2);
    expect(prepared.uncompressedSizeBytes).toBe(strToU8(xml).byteLength);
    expect(prepared.compressedSizeBytes).toBe(compressed.byteLength);
    expect(prepared.suggestedName).toBe('Uscita');
  });

  it('rifiuta il file locale oltre il limite prima di leggerlo', async () => {
    const file = new File(['0123456789'], 'troppo-grande.gpx', { type: 'application/gpx+xml' });
    const read = vi.spyOn(file, 'arrayBuffer');
    await expect(prepareImportedGpx(file, { ...limits, max_uncompressed_bytes: 5 }))
      .rejects.toMatchObject({ code: 'size_exceeded' });
    expect(read).not.toHaveBeenCalled();
  });

  it('rifiuta anche un gzip locale oltre soglia prima di leggerne il contenuto', async () => {
    const file = new File([new Uint8Array(20)], 'troppo-grande.gpx.gz', { type: 'application/gzip' });
    const read = vi.spyOn(file, 'arrayBuffer');
    const slice = vi.spyOn(file, 'slice');
    await expect(prepareImportedGpx(file, { ...limits, max_compressed_bytes: 10 }))
      .rejects.toMatchObject({ code: 'size_exceeded' });
    expect(read).not.toHaveBeenCalled();
    expect(slice).not.toHaveBeenCalled();
  });

  it('usa ISIZE per rifiutare una forte espansione prima della decompressione', async () => {
    const valid = gzipSync(strToU8('<gpx><trk><trkseg><trkpt lat="46" lon="11"/><trkpt lat="46.1" lon="11.1"/></trkseg></trk></gpx>'));
    const forged = valid.slice();
    new DataView(forged.buffer, forged.byteOffset + forged.byteLength - 4, 4).setUint32(0, 50_000, true);
    const blob = new Blob([forged], { type: 'application/gzip' });
    const slice = vi.spyOn(blob, 'slice');

    await expect(decodeCloudGpx(blob, 'espansione.gpx.gz', { ...limits, max_uncompressed_bytes: 1_000 }))
      .rejects.toMatchObject({ code: 'size_exceeded' });
    expect(slice).toHaveBeenCalledTimes(2);
  });

  it('interrompe una decompressione che supera il limite non compresso', async () => {
    const xml = `<?xml version="1.0"?><gpx><trk><trkseg>${'<trkpt lat="46" lon="11"/>'.repeat(500)}</trkseg></trk></gpx>`;
    const blob = new Blob([gzipSync(strToU8(xml))], { type: 'application/gzip' });
    await expect(decodeCloudGpx(blob, 'bomb.gpx.gz', { ...limits, max_uncompressed_bytes: 1_000 }))
      .rejects.toMatchObject({ code: 'size_exceeded' });
  });

  it.each([
    ['DOCTYPE', '<!DOCTYPE gpx><gpx><trk><trkseg><trkpt lat="46" lon="11"/><trkpt lat="46.1" lon="11.1"/></trkseg></trk></gpx>'],
    ['ENTITY', '<!DOCTYPE gpx [<!ENTITY x "test">]><gpx><trk><trkseg><trkpt lat="46" lon="11"/><trkpt lat="46.1" lon="11.1"/></trkseg></trk></gpx>'],
  ])('rifiuta dichiarazioni XML %s', async (_label, xml) => {
    const parse = vi.spyOn(DOMParser.prototype, 'parseFromString');
    try {
      await expect(decodeCloudGpx(new Blob([xml]), 'input.gpx', limits))
        .rejects.toThrow(/DTD o ENTITY/);
      expect(parse).not.toHaveBeenCalled();
    } finally {
      parse.mockRestore();
    }
  });

  it('rifiuta XML con profondità anomala prima di costruire il DOM', async () => {
    const xml = `<gpx>${'<extensions>'.repeat(129)}${'</extensions>'.repeat(129)}</gpx>`;
    const parse = vi.spyOn(DOMParser.prototype, 'parseFromString');
    try {
      await expect(decodeCloudGpx(new Blob([xml]), 'profondo.gpx', limits))
        .rejects.toThrow(/troppo complesso/);
      expect(parse).not.toHaveBeenCalled();
    } finally {
      parse.mockRestore();
    }
  });

  it('rifiuta un falso gzip dalla sola intestazione', async () => {
    const invalid = new Uint8Array(18);
    invalid[0] = 0x1f;
    invalid[1] = 0x8b;
    invalid[2] = 0;
    await expect(decodeCloudGpx(new Blob([invalid], { type: 'application/gzip' }), 'corrotto.gpx.gz', limits))
      .rejects.toThrow(/archivio gzip valido/);
  });

  it('rifiuta gzip concatenati e archivi troncati', async () => {
    const valid = strToU8('<gpx><trk><trkseg><trkpt lat="46" lon="11"/><trkpt lat="46.1" lon="11.1"/></trkseg></trk></gpx>');
    const first = gzipSync(valid);
    const second = gzipSync(valid);
    const joined = new Uint8Array(first.length + second.length);
    joined.set(first); joined.set(second, first.length);
    await expect(decodeCloudGpx(new Blob([joined], { type: 'application/gzip' }), 'multi.gpx.gz', limits))
      .rejects.toThrow(/più contenuti/);
    await expect(decodeCloudGpx(new Blob([first.slice(0, -5)], { type: 'application/gzip' }), 'troncato.gpx.gz', limits))
      .rejects.toThrow(/limite|danneggiato|troncato/);
  });

  it('rifiuta root e coordinate anomale', async () => {
    await expect(decodeCloudGpx(new Blob(['<html/>']), 'input.gpx', limits))
      .rejects.toThrow(/documento GPX/);
    const invalidCoordinate = '<gpx><trk><trkseg><trkpt lat="999" lon="11"/><trkpt lat="46" lon="11"/></trkseg></trk></gpx>';
    await expect(decodeCloudGpx(new Blob([invalidCoordinate]), 'input.gpx', limits))
      .rejects.toThrow(/coordinate/);
  });
});
