import { DataUnavailableError } from './errors';
import type {
  EncodedWeatherCell,
  TerrainChunk,
  TerrainPointData,
  WeatherDataset,
  WeatherDay,
} from './types';

export const WEATHER_NODATA = -32768;
export const WEATHER_SCALE = 0.1;
export const TERRAIN_BYTES_PER_CELL = 6;

export function decodeWeatherSeries(
  encoded: number[] | null,
  length: number,
): Array<number | null> {
  return Array.from({ length }, (_, index) => {
    const value = encoded?.[index];
    if (typeof value !== 'number' || value === WEATHER_NODATA) return null;
    return value * WEATHER_SCALE;
  });
}

export function decodeWeatherDays(dataset: WeatherDataset, cell: EncodedWeatherCell): WeatherDay[] {
  const length = dataset.dates.length;
  const missingDates = new Set(dataset.missing_dates);
  const temperatureMin = decodeWeatherSeries(cell.t2m_min, length);
  const temperatureMax = decodeWeatherSeries(cell.t2m_max, length);
  const precipitation = decodeWeatherSeries(cell.precip_sum, length);
  const humidity = decodeWeatherSeries(cell.rh_mean, length);
  const gust = decodeWeatherSeries(cell.gust_max, length);

  return dataset.dates.map((date, index) => ({
    date,
    missing: missingDates.has(date),
    temperatureMin: temperatureMin[index],
    temperatureMax: temperatureMax[index],
    precipitation: precipitation[index],
    humidity: humidity[index],
    gust: gust[index],
  }));
}

export function decodeTerrainCell(
  buffer: ArrayBuffer,
  chunk: TerrainChunk,
  localRow: number,
  localCol: number,
  version: string,
): TerrainPointData {
  if (buffer.byteLength !== chunk.byte_length) {
    throw new DataUnavailableError(
      `Chunk terreno incompleto: ${buffer.byteLength} byte ricevuti, ${chunk.byte_length} attesi.`,
    );
  }

  const expectedLength = chunk.rows * chunk.cols * TERRAIN_BYTES_PER_CELL;
  if (chunk.byte_length !== expectedLength) {
    throw new DataUnavailableError('Metadata del chunk terreno non coerenti.');
  }

  if (localRow < 0 || localRow >= chunk.rows || localCol < 0 || localCol >= chunk.cols) {
    throw new DataUnavailableError('Cella locale fuori dai limiti del chunk terreno.');
  }

  const byteOffset = (localRow * chunk.cols + localCol) * TERRAIN_BYTES_PER_CELL;
  if (byteOffset + TERRAIN_BYTES_PER_CELL > buffer.byteLength) {
    throw new DataUnavailableError('Offset della cella terreno fuori dal chunk.');
  }

  const view = new DataView(buffer);
  const elevation = view.getInt16(byteOffset, true);
  const forestPercent = view.getUint8(byteOffset + 2);
  const aspectDegrees = view.getUint16(byteOffset + 3, true);
  const tpiCategory = view.getUint8(byteOffset + 5);

  return {
    version,
    row: chunk.row_offset + localRow,
    col: chunk.col_offset + localCol,
    elevation: elevation === -32768 ? null : elevation,
    forestPercent: forestPercent === 255 ? null : forestPercent,
    aspectDegrees: aspectDegrees === 65535 ? null : aspectDegrees,
    tpiCategory: tpiCategory >= 0 && tpiCategory <= 3 ? tpiCategory : 0,
  };
}

export function lastAvailableDayIndex(days: WeatherDay[]): number {
  for (let index = days.length - 1; index >= 0; index -= 1) {
    const day = days[index];
    if (
      !day.missing &&
      [
        day.temperatureMin,
        day.temperatureMax,
        day.precipitation,
        day.humidity,
        day.gust,
      ].some((value) => value !== null)
    ) {
      return index;
    }
  }
  return Math.max(0, days.length - 1);
}
