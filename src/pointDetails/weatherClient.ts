import { decodeWeatherDays } from './decoders';
import { DataUnavailableError, OutsideCoverageError } from './errors';
import { coordinateToGridCell } from './geo';
import { fetchJson, throwIfAborted } from './http';
import { getSupabasePublicConfig, supabaseHeaders } from './supabaseConfig';
import type {
  EncodedWeatherCell,
  MapPoint,
  WeatherDataset,
  WeatherPointData,
  WeatherStateRow,
} from './types';

const STATE_CACHE_MS = 60_000;

let stateCache: { value: WeatherStateRow; fetchedAt: number } | null = null;
const datasetCache = new Map<string, WeatherDataset>();
const cellCache = new Map<string, EncodedWeatherCell>();

function restUrl(path: string, params: Record<string, string>): string {
  const { url } = getSupabasePublicConfig();
  const requestUrl = new URL(`${url}/rest/v1/${path}`);
  Object.entries(params).forEach(([key, value]) => requestUrl.searchParams.set(key, value));
  return requestUrl.toString();
}

async function getCurrentWeatherState(signal?: AbortSignal): Promise<WeatherStateRow> {
  throwIfAborted(signal);
  if (stateCache && Date.now() - stateCache.fetchedAt < STATE_CACHE_MS) {
    return stateCache.value;
  }

  const config = getSupabasePublicConfig();
  const rows = await fetchJson<WeatherStateRow[]>(
    restUrl('public_weather_state', {
      singleton_id: 'eq.1',
      select: 'current_version',
    }),
    {
      method: 'GET',
      headers: supabaseHeaders(config),
      signal,
      cache: 'no-store',
    },
    'Stato meteo non disponibile.',
  );

  const state = rows[0];
  if (!state?.current_version) {
    throw new DataUnavailableError('Versione meteo corrente non pubblicata.');
  }
  stateCache = { value: state, fetchedAt: Date.now() };
  return state;
}

async function getWeatherDataset(version: string, signal?: AbortSignal): Promise<WeatherDataset> {
  throwIfAborted(signal);
  const cached = datasetCache.get(version);
  if (cached) return cached;

  const config = getSupabasePublicConfig();
  const rows = await fetchJson<WeatherDataset[]>(
    restUrl('public_weather_datasets', {
      version: `eq.${version}`,
      select:
        'version,dates,available_day_count,missing_dates,rows,cols,bbox,origin_lat,origin_lon,step_deg,variables',
    }),
    {
      method: 'GET',
      headers: supabaseHeaders(config),
      signal,
      cache: 'no-store',
    },
    'Metadata meteo non disponibili.',
  );

  const dataset = rows[0];
  if (!dataset || dataset.dates.length !== 20) {
    throw new DataUnavailableError('Metadata meteo incompleti o non validi.');
  }
  datasetCache.set(version, dataset);
  return dataset;
}

async function getWeatherCell(
  version: string,
  row: number,
  col: number,
  signal?: AbortSignal,
): Promise<EncodedWeatherCell> {
  throwIfAborted(signal);
  const cacheKey = `${version}/${row}/${col}`;
  const cached = cellCache.get(cacheKey);
  if (cached) return cached;

  const config = getSupabasePublicConfig();
  const rows = await fetchJson<EncodedWeatherCell[]>(
    restUrl('public_weather_cells', {
      version: `eq.${version}`,
      row_idx: `eq.${row}`,
      col_idx: `eq.${col}`,
      select: 'version,row_idx,col_idx,t2m_min,t2m_max,precip_sum,rh_mean,gust_max',
    }),
    {
      method: 'GET',
      headers: supabaseHeaders(config),
      signal,
      cache: 'no-store',
    },
    'Dati meteo della cella non disponibili.',
  );

  const cell = rows[0];
  if (!cell) {
    throw new DataUnavailableError('Dati meteo della cella non disponibili.');
  }
  cellCache.set(cacheKey, cell);
  return cell;
}

export async function loadWeatherPoint(
  point: MapPoint,
  signal?: AbortSignal,
): Promise<WeatherPointData> {
  const state = await getCurrentWeatherState(signal);
  const dataset = await getWeatherDataset(state.current_version, signal);
  const cell = coordinateToGridCell(point, dataset);
  if (!cell) {
    throw new OutsideCoverageError('Il punto è fuori dalla copertura meteorologica.');
  }

  const encoded = await getWeatherCell(dataset.version, cell.row, cell.col, signal);
  return {
    version: dataset.version,
    row: cell.row,
    col: cell.col,
    availableDayCount: dataset.available_day_count,
    missingDates: dataset.missing_dates,
    days: decodeWeatherDays(dataset, encoded),
  };
}

export function clearWeatherCaches(): void {
  stateCache = null;
  datasetCache.clear();
  cellCache.clear();
}
