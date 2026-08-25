import { zlibSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OutsideCoverageError } from '../pointDetails/errors';
import { clearIndexHistoryCaches, loadIndexHistoryPoint } from './historyClient';
import type { IndexHistoryCurrent, IndexHistoryManifest } from './historyTypes';

function current(): IndexHistoryCurrent {
  return {
    contract_version: 1,
    version: 'history-v1',
    index_date: '2026-08-24',
    date_from: '2026-08-22',
    date_to: '2026-08-24',
    day_count: 3,
    manifest_path: 'history-v1/manifest.json',
    dataset_sha256: 'sha-history-v1',
  };
}

function manifest(compressedLength: number): IndexHistoryManifest {
  return {
    contract_version: 1,
    version: 'history-v1',
    index_date: '2026-08-24',
    dataset_sha256: 'sha-history-v1',
    dates: ['2026-08-22', '2026-08-23', '2026-08-24'],
    day_count: 3,
    available_dates: ['2026-08-22', '2026-08-24'],
    missing_dates: ['2026-08-23'],
    rows: 1,
    cols: 1,
    origin_lat: 46,
    origin_lon: 11,
    step_deg: 0.003,
    bbox: { west: 10.9985, south: 45.9985, east: 11.0015, north: 46.0015 },
    compression: { codec: 'zlib' },
    chunk_size: { rows: 50, cols: 50 },
    chunks: [{
      row: 0,
      col: 0,
      row_offset: 0,
      col_offset: 0,
      rows: 1,
      cols: 1,
      path: 'history-v1/chunks/r00_c00.bin.zlib',
      byte_length: compressedLength,
      raw_byte_length: 24,
    }],
    binary_layout: {
      layout: 'row-major interleaved cells',
      endianness: 'little',
      bytes_per_cell_uncompressed: 24,
      fields: [
        { name: 'porcini_score', dtype: 'float32', shape: [3], nodata: 'NaN', offset_bytes: 0 },
        { name: 'finferli_score', dtype: 'float32', shape: [3], nodata: 'NaN', offset_bytes: 12 },
      ],
    },
  };
}

describe('client index-history', () => {
  beforeEach(() => {
    clearIndexHistoryCaches();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T10:00:00Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('usa current, manifest e soltanto il chunk dichiarato, mantenendo i gap', async () => {
    const raw = new ArrayBuffer(24);
    const view = new DataView(raw);
    [20, Number.NaN, 40].forEach((value, index) => view.setFloat32(index * 4, value, true));
    [30, Number.NaN, 50].forEach((value, index) => view.setFloat32(12 + index * 4, value, true));
    const compressed = zlibSync(new Uint8Array(raw));
    const requests: string[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      requests.push(url);
      if (url.endsWith('/index-history/current.json')) {
        return new Response(JSON.stringify(current()), { status: 200 });
      }
      if (url.endsWith('/index-history/history-v1/manifest.json')) {
        return new Response(JSON.stringify(manifest(compressed.byteLength)), { status: 200 });
      }
      if (url.endsWith('/index-history/history-v1/chunks/r00_c00.bin.zlib')) {
        return new Response(
          compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength),
          { status: 200 },
        );
      }
      throw new Error('URL inatteso: ' + url);
    });

    const point = { latitude: 46, longitude: 11 };
    await expect(loadIndexHistoryPoint(point)).resolves.toMatchObject({
      version: 'history-v1',
      days: [
        { porciniScore: 20, finferliScore: 30 },
        { porciniScore: null, finferliScore: null },
        { porciniScore: 40, finferliScore: 50 },
      ],
    });
    await expect(loadIndexHistoryPoint(point)).resolves.toMatchObject({ version: 'history-v1' });
    expect(requests).toHaveLength(3);
    expect(requests.some((url) => url.includes('/storage/v1/object/list/'))).toBe(false);

    await expect(loadIndexHistoryPoint({ latitude: 46, longitude: 12 }))
      .rejects.toBeInstanceOf(OutsideCoverageError);
    expect(requests).toHaveLength(3);
  });
});