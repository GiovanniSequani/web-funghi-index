import { zlibSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { decodeIndexHistoryCell, decompressIndexHistoryChunk } from './historyDecoder';
import type { IndexHistoryChunk, IndexHistoryCurrent, IndexHistoryManifest } from './historyTypes';

const current: IndexHistoryCurrent = {
  contract_version: 1,
  version: '20260824T120000Z',
  index_date: '2026-08-24',
  date_from: '2026-08-22',
  date_to: '2026-08-24',
  day_count: 3,
  manifest_path: '20260824T120000Z/manifest.json',
  dataset_sha256: 'sha',
};

const chunk: IndexHistoryChunk = {
  row: 0,
  col: 0,
  row_offset: 0,
  col_offset: 0,
  rows: 2,
  cols: 2,
  path: '20260824T120000Z/chunks/r00_c00.bin.zlib',
  byte_length: 0,
  raw_byte_length: 96,
};

const manifest: IndexHistoryManifest = {
  contract_version: 1,
  version: current.version,
  index_date: current.index_date,
  dataset_sha256: current.dataset_sha256,
  dates: ['2026-08-22', '2026-08-23', '2026-08-24'],
  day_count: 3,
  available_dates: ['2026-08-22', '2026-08-24'],
  missing_dates: ['2026-08-23'],
  rows: 2,
  cols: 2,
  origin_lat: 46,
  origin_lon: 11,
  step_deg: 0.003,
  bbox: { west: 10.9985, south: 45.9985, east: 11.0045, north: 46.0045 },
  compression: { codec: 'zlib' },
  chunk_size: { rows: 2, cols: 2 },
  chunks: [chunk],
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

describe('decoder index-history', () => {
  it('decodifica la cella di bordo, preservando NaN come gap', () => {
    const raw = new ArrayBuffer(96);
    const view = new DataView(raw);
    const cellOffset = 3 * 24;
    [21.5, Number.NaN, 48.25].forEach((value, index) =>
      view.setFloat32(cellOffset + index * 4, value, true),
    );
    [12, Number.NaN, 37.5].forEach((value, index) =>
      view.setFloat32(cellOffset + 12 + index * 4, value, true),
    );

    const result = decodeIndexHistoryCell(raw, manifest, chunk, 1, 1, current);

    expect(result).toMatchObject({ row: 1, col: 1, indexDate: '2026-08-24' });
    expect(result.days).toEqual([
      { date: '2026-08-22', porciniScore: 21.5, finferliScore: 12 },
      { date: '2026-08-23', porciniScore: null, finferliScore: null },
      { date: '2026-08-24', porciniScore: 48.25, finferliScore: 37.5 },
    ]);
  });

  it('decomprime zlib e verifica la lunghezza raw dichiarata', () => {
    const raw = new Uint8Array([1, 2, 3, 4]);
    const compressed = zlibSync(raw);
    expect(new Uint8Array(decompressIndexHistoryChunk(
      compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength),
      4,
    ))).toEqual(raw);
    expect(() => decompressIndexHistoryChunk(
      compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength),
      5,
    )).toThrow(/Lunghezza raw/);
  });
});