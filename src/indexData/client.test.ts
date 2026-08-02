import { zlibSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OutsideCoverageError } from '../pointDetails/errors';
import { clearIndexDataCaches, loadIndexPoint } from './client';
import type { IndexCurrent, IndexManifest } from './types';

function compressedCell(score: number): Uint8Array {
  const raw = new Uint8Array(30);
  const view = new DataView(raw.buffer);
  view.setFloat32(0, score, true);
  view.setFloat32(4, score / 2, true);
  return zlibSync(raw);
}

function current(version: string): IndexCurrent {
  return {
    contract_version: 1,
    dataset_sha256: `sha-${version}`,
    index_date: '2026-07-26',
    manifest_path: `${version}/manifest.json`,
    version,
  };
}

function manifest(version: string, compressedLength: number): IndexManifest {
  return {
    contract_version: 1,
    version,
    index_date: '2026-07-26',
    dataset_sha256: `sha-${version}`,
    rows: 1,
    cols: 1,
    origin_lat: 46,
    origin_lon: 11,
    step_deg: 0.003,
    bbox: { west: 10.9985, south: 45.9985, east: 11.0015, north: 46.0015 },
    compression: { codec: 'zlib' },
    chunk_size: { rows: 50, cols: 50 },
    chunks: [
      {
        byte_length: compressedLength,
        raw_byte_length: 30,
        col: 0,
        col_offset: 0,
        cols: 1,
        path: `${version}/chunks/r00_c00.bin.zlib`,
        row: 0,
        row_offset: 0,
        rows: 1,
      },
    ],
    binary_layout: {
      bytes_per_cell_uncompressed: 30,
      endianness: 'little',
      layout: 'row-major interleaved cells',
      fields: [
        { name: 'porcini_score', dtype: 'float32', offset_bytes: 0, nodata: 'NaN' },
        { name: 'finferli_score', dtype: 'float32', offset_bytes: 4, nodata: 'NaN' },
      ],
    },
    labels: {},
    porcini_diagnostics: {},
  };
}

describe('client index-data', () => {
  beforeEach(() => {
    clearIndexDataCaches();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-26T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('usa current, manifest e solo il chunk necessario, poi invalida alla nuova versione', async () => {
    const v1Chunk = compressedCell(70);
    const v2Chunk = compressedCell(82);
    let currentReads = 0;
    const requests: string[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      requests.push(url);
      if (url.endsWith('/index-data/current.json')) {
        currentReads += 1;
        return new Response(JSON.stringify(current(currentReads === 1 ? 'v1' : 'v2')), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/index-data/v1/manifest.json')) {
        return new Response(JSON.stringify(manifest('v1', v1Chunk.byteLength)), { status: 200 });
      }
      if (url.endsWith('/index-data/v2/manifest.json')) {
        return new Response(JSON.stringify(manifest('v2', v2Chunk.byteLength)), { status: 200 });
      }
      if (url.endsWith('/index-data/v1/chunks/r00_c00.bin.zlib')) {
        return new Response(v1Chunk.buffer.slice(0) as ArrayBuffer, { status: 200 });
      }
      if (url.endsWith('/index-data/v2/chunks/r00_c00.bin.zlib')) {
        return new Response(v2Chunk.buffer.slice(0) as ArrayBuffer, { status: 200 });
      }
      throw new Error(`URL inatteso: ${url}`);
    });

    const point = { latitude: 46, longitude: 11 };
    await expect(loadIndexPoint(point)).resolves.toMatchObject({
      version: 'v1',
      porciniScore: 70,
    });
    await expect(loadIndexPoint(point)).resolves.toMatchObject({
      version: 'v1',
      porciniScore: 70,
    });
    expect(requests).toHaveLength(3);
    expect(requests.some((url) => url.includes('/storage/v1/object/list/'))).toBe(false);

    vi.setSystemTime(new Date('2026-07-26T10:01:01Z'));
    await expect(loadIndexPoint(point)).resolves.toMatchObject({
      version: 'v2',
      porciniScore: 82,
    });
    expect(requests).toHaveLength(6);

    await expect(
      loadIndexPoint({ latitude: 46, longitude: 12 }),
    ).rejects.toBeInstanceOf(OutsideCoverageError);
    expect(requests).toHaveLength(6);
  });
});
