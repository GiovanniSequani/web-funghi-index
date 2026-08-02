import { zlibSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { DataUnavailableError } from '../pointDetails/errors';
import { decodeIndexCell, decodeIndexField, decompressIndexChunk } from './decoder';
import type { IndexChunk, IndexCurrent, IndexManifest } from './types';

const current: IndexCurrent = {
  contract_version: 1,
  dataset_sha256: 'dataset',
  index_date: '2026-07-26',
  manifest_path: 'v1/manifest.json',
  version: 'v1',
};

const chunk: IndexChunk = {
  byte_length: 0,
  raw_byte_length: 30,
  col: 0,
  col_offset: 0,
  cols: 1,
  path: 'v1/chunks/r00_c00.bin.zlib',
  row: 0,
  row_offset: 0,
  rows: 1,
};

const manifest: IndexManifest = {
  contract_version: 1,
  version: 'v1',
  index_date: '2026-07-26',
  dataset_sha256: 'dataset',
  rows: 1,
  cols: 1,
  step_deg: 0.003,
  origin_lat: 46,
  origin_lon: 11,
  bbox: { west: 10.9985, south: 45.9985, east: 11.0015, north: 46.0015 },
  compression: { codec: 'zlib' },
  chunk_size: { rows: 50, cols: 50 },
  chunks: [chunk],
  binary_layout: {
    bytes_per_cell_uncompressed: 30,
    endianness: 'little',
    layout: 'row-major interleaved cells',
    fields: [
      { name: 'porcini_score', dtype: 'float32', offset_bytes: 0, nodata: 'NaN' },
      { name: 'finferli_score', dtype: 'float32', offset_bytes: 4, nodata: 'NaN' },
      {
        name: 'porcini_base_score',
        dtype: 'uint16',
        offset_bytes: 8,
        scale: 0.01,
        offset: 0,
        nodata: 65535,
      },
      { name: 'habitat', dtype: 'uint8', offset_bytes: 10, scale: 1 / 254, nodata: 255 },
      { name: 'temporal_phase', dtype: 'uint8', offset_bytes: 23, scale: 1, nodata: null },
      { name: 'temperature_band', dtype: 'uint8', offset_bytes: 25, scale: 1, nodata: 0 },
      {
        name: 'presence_carryover',
        dtype: 'uint16',
        offset_bytes: 26,
        scale: 0.01,
        nodata: 65535,
      },
      {
        name: 'rain_recovery_seed',
        dtype: 'uint16',
        offset_bytes: 28,
        scale: 0.01,
        nodata: 65535,
      },
    ],
  },
  labels: {
    temporal_phase: {
      '0': 'non_determinabile',
      '1': 'troppo_precoce',
      '2': 'fase_favorevole',
      '3': 'troppo_tardi',
    },
    temperature_band: {
      '0': 'nodata',
      '1': 'molto_fredda',
      '2': 'fredda',
      '3': 'ottimale',
      '4': 'calda',
      '5': 'molto_calda',
    },
  },
  porcini_diagnostics: {
    configured_lags_days: [7, 8, 9],
    dynamic_weights: { habitat: 0.28, trigger: 0.3 },
    formulas: { final_score: 'base + recovery' },
    thresholds: { temp_mean_c: [5, 10, 18, 24] },
  },
};

function rawCell(): ArrayBuffer {
  const buffer = new ArrayBuffer(30);
  const view = new DataView(buffer);
  view.setFloat32(0, 78.5, true);
  view.setFloat32(4, Number.NaN, true);
  view.setUint16(8, 6543, true);
  view.setUint8(10, 127);
  view.setUint8(23, 2);
  view.setUint8(25, 3);
  view.setUint16(26, 425, true);
  view.setUint16(28, 65535, true);
  return buffer;
}

describe('decoder index-data', () => {
  it('decomprime zlib e verifica la lunghezza raw', () => {
    const raw = new Uint8Array(rawCell());
    const compressed = zlibSync(raw);
    const compressedBuffer = compressed.buffer.slice(
      compressed.byteOffset,
      compressed.byteOffset + compressed.byteLength,
    ) as ArrayBuffer;

    expect(new Uint8Array(decompressIndexChunk(compressedBuffer, 30))).toEqual(raw);
    expect(() => decompressIndexChunk(compressedBuffer, 29)).toThrow(DataUnavailableError);
  });

  it('decodifica little-endian, scale, nodata e labels del manifest', () => {
    const data = decodeIndexCell(rawCell(), manifest, chunk, 0, 0, current);

    expect(data.porciniScore).toBeCloseTo(78.5);
    expect(data.finferliScore).toBeNull();
    expect(data.porciniBaseScore).toBeCloseTo(65.43);
    expect(data.diagnostics.habitat).toBeCloseTo(0.5);
    expect(data.diagnosticLabels.temporal_phase).toBe('fase_favorevole');
    expect(data.diagnosticLabels.temperature_band).toBe('ottimale');
    expect(data.diagnostics.presence_carryover).toBeCloseTo(4.25);
    expect(data.diagnostics.rain_recovery_seed).toBeNull();
    expect(data.context.thresholds).toEqual({ temp_mean_c: [5, 10, 18, 24] });
  });

  it('rifiuta dtype e offset non dichiarati correttamente', () => {
    const view = new DataView(rawCell());
    expect(() =>
      decodeIndexField(view, 0, 30, {
        name: 'bad',
        dtype: 'complex64',
        offset_bytes: 0,
      }),
    ).toThrow(/Dtype/);
    expect(() =>
      decodeIndexField(view, 0, 30, {
        name: 'bad',
        dtype: 'uint16',
        offset_bytes: 30,
      }),
    ).toThrow(/Offset/);
  });

  it('gestisce chunk di bordo con dimensioni ridotte', () => {
    const edgeChunk = { ...chunk, row: 9, col: 13, row_offset: 499, col_offset: 699 };
    const data = decodeIndexCell(rawCell(), manifest, edgeChunk, 0, 0, current);
    expect(data.row).toBe(499);
    expect(data.col).toBe(699);
  });
});
