import { describe, expect, it } from 'vitest';
import { DataUnavailableError } from './errors';
import {
  decodeTerrainCell,
  decodeWeatherDays,
  decodeWeatherSeries,
  TERRAIN_BYTES_PER_CELL,
} from './decoders';
import type { EncodedWeatherCell, TerrainChunk, WeatherDataset } from './types';

const dataset: WeatherDataset = {
  version: '2026-07-24',
  dates: ['2026-07-05', '2026-07-06', '2026-07-07'],
  available_day_count: 2,
  missing_dates: ['2026-07-06'],
  rows: 84,
  cols: 117,
  origin_lat: 45.6015,
  origin_lon: 10.4015,
  step_deg: 0.018,
  bbox: { west: 10.4, south: 45.6, east: 12.5, north: 47.1 },
  variables: {},
};

const encodedCell: EncodedWeatherCell = {
  version: dataset.version,
  row_idx: 0,
  col_idx: 0,
  t2m_min: [123, -32768, 141],
  t2m_max: [201, -32768, 220],
  precip_sum: [0, -32768, 18],
  rh_mean: [655, -32768, 801],
  gust_max: [123, -32768, 456],
};

describe('decodifica meteo', () => {
  it('trasforma nodata in null e applica la scala 0,1', () => {
    expect(decodeWeatherSeries([123, -32768, 0], 3)).toEqual([12.3, null, 0]);
  });

  it('mantiene l’allineamento array[i] con dates[i]', () => {
    const days = decodeWeatherDays(dataset, encodedCell);
    expect(days).toHaveLength(3);
    expect(days[0]).toMatchObject({
      date: '2026-07-05',
      temperatureMin: 12.3,
      temperatureMax: 20.1,
      precipitation: 0,
    });
    expect(days[1].missing).toBe(true);
    expect(days[1].humidity).toBeNull();
    expect(days[2].gust).toBe(45.6);
  });
});

describe('decodifica binaria terreno', () => {
  const edgeChunk: TerrainChunk = {
    row: 9,
    col: 13,
    row_offset: 450,
    col_offset: 650,
    rows: 50,
    cols: 50,
    path: 'v1/chunks/r09_c13.bin',
    byte_length: 50 * 50 * TERRAIN_BYTES_PER_CELL,
  };

  it('decodifica little-endian e l’ultima cella di un chunk di bordo', () => {
    const buffer = new ArrayBuffer(edgeChunk.byte_length);
    const offset = (49 * edgeChunk.cols + 49) * TERRAIN_BYTES_PER_CELL;
    const view = new DataView(buffer);
    view.setInt16(offset, 1875, true);
    view.setUint8(offset + 2, 82);
    view.setUint16(offset + 3, 225, true);
    view.setUint8(offset + 5, 3);

    expect(decodeTerrainCell(buffer, edgeChunk, 49, 49, 'v1')).toEqual({
      version: 'v1',
      row: 499,
      col: 699,
      elevation: 1875,
      forestPercent: 82,
      aspectDegrees: 225,
      tpiCategory: 3,
    });
  });

  it('decodifica tutti i valori nodata', () => {
    const chunk = { ...edgeChunk, rows: 1, cols: 1, byte_length: 6 };
    const buffer = new ArrayBuffer(6);
    const view = new DataView(buffer);
    view.setInt16(0, -32768, true);
    view.setUint8(2, 255);
    view.setUint16(3, 65535, true);
    view.setUint8(5, 0);

    expect(decodeTerrainCell(buffer, chunk, 0, 0, 'v1')).toMatchObject({
      elevation: null,
      forestPercent: null,
      aspectDegrees: null,
      tpiCategory: 0,
    });
  });

  it('rifiuta un chunk con byte_length non coerente', () => {
    expect(() => decodeTerrainCell(new ArrayBuffer(5), { ...edgeChunk, rows: 1, cols: 1, byte_length: 6 }, 0, 0, 'v1'))
      .toThrow(DataUnavailableError);
  });
});
