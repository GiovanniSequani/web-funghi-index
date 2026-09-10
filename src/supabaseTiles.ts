import type { Species, TileSet } from './types';

import { backoffDelay, parseRetryAfter, waitForDelay, waitUntilOnline } from './networkRetry';

const DEFAULT_SUPABASE_URL = 'https://ovdfsehovsrdzcoqdlfh.supabase.co';
const SUPABASE_BUCKET = 'tiles';
const TILE_SET_REGEX = /^(\d{4})([-_])(\d{2})\2(\d{2})_v(\d+)$/;
const TILE_SET_MANIFEST = 'tile_sets.json';
const TILE_MANIFEST_MAX_ATTEMPTS = 4;
const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;

function normalizeSupabaseUrl(value: string | undefined): string {
  const candidate = (value ?? '').trim().replace(/\/+$/, '');
  if (/^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(candidate) && !candidate.includes('your-project')) {
    return candidate;
  }
  return DEFAULT_SUPABASE_URL;
}

export const SUPABASE_URL = normalizeSupabaseUrl(envSupabaseUrl);

export const DEFAULT_TILE_SET: TileSet = { date: '2026-05-05', version: '1' };

type ManifestTileSet = {
  date?: unknown;
  version?: unknown;
};

type TileSetManifest = {
  tileSets?: unknown;
};

type ParsedTileSet = TileSet & {
  year: number;
  month: number;
  day: number;
  versionNum: number;
};

function parseTileSetName(name: string): ParsedTileSet | null {
  const match = name.match(TILE_SET_REGEX);
  if (!match) return null;

  const [, year, separator, month, day, version] = match;
  return {
    date: `${year}${separator}${month}${separator}${day}`,
    version,
    year: Number(year),
    month: Number(month),
    day: Number(day),
    versionNum: Number(version),
  };
}

function parseManifestTileSet(item: ManifestTileSet): ParsedTileSet | null {
  if (typeof item.date !== 'string' || typeof item.version !== 'string') return null;
  return parseTileSetName(`${item.date}_v${item.version}`);
}

function sortTileSets(items: ParsedTileSet[]): TileSet[] {
  return items
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.month !== b.month) return b.month - a.month;
      if (a.day !== b.day) return b.day - a.day;
      return b.versionNum - a.versionNum;
    })
    .map(({ date, version }) => ({ date, version }));
}

async function getAvailableTileSetsFromManifest(signal?: AbortSignal): Promise<TileSet[]> {
  const url = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${TILE_SET_MANIFEST}?t=${Date.now()}`;
  let response: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < TILE_MANIFEST_MAX_ATTEMPTS; attempt += 1) {
    await waitUntilOnline(signal);
    try {
      response = await fetch(url, { method: 'GET', signal, cache: 'no-store' });
      if (response.ok || !TRANSIENT_STATUS.has(response.status)) break;
      lastError = new Error(`Tile manifest failed: ${response.status}`);
      if (attempt + 1 >= TILE_MANIFEST_MAX_ATTEMPTS) break;
      await waitForDelay(backoffDelay(attempt, { baseDelayMs: 1_000, maxDelayMs: 15_000 }, parseRetryAfter(response.headers.get('Retry-After'))), signal);
    } catch (cause) {
      if (signal?.aborted) throw cause;
      lastError = cause;
      if (attempt + 1 >= TILE_MANIFEST_MAX_ATTEMPTS) break;
      await waitForDelay(backoffDelay(attempt, { baseDelayMs: 1_000, maxDelayMs: 15_000 }), signal);
    }
  }

  if (!response?.ok) {
    throw lastError instanceof Error ? lastError : new Error(`Tile manifest failed: ${response?.status ?? 'network'}`);
  }

  const manifest = (await response.json()) as TileSetManifest;
  if (!Array.isArray(manifest.tileSets)) {
    throw new Error('Tile manifest format is invalid');
  }

  return sortTileSets(
    manifest.tileSets
      .map((item) => parseManifestTileSet(item as ManifestTileSet))
      .filter((item): item is ParsedTileSet => item !== null),
  );
}

export async function getAvailableTileSets(signal?: AbortSignal): Promise<TileSet[]> {
  const tileSets = await getAvailableTileSetsFromManifest(signal);
  if (tileSets.length === 0) {
    throw new Error('Tile manifest does not contain available tile sets');
  }
  return tileSets;
}

export function tileUrl(species: Species, tileSet: TileSet): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${tileSet.date}_v${tileSet.version}/${species}/{z}/{x}/{y}.png`;
}
