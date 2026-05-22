import type { Species, TileSet } from './types';

const DEFAULT_SUPABASE_URL = 'https://ovdfsehovsrdzcoqdlfh.supabase.co';
const SUPABASE_BUCKET = 'tiles';
const TILE_SET_REGEX = /^(\d{4})([-_])(\d{2})\2(\d{2})_v(\d+)$/;
const TILE_SET_MANIFEST = 'tile_sets.json';

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
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${TILE_SET_MANIFEST}?t=${Date.now()}`,
    { method: 'GET', signal, cache: 'no-store' },
  );

  if (!response.ok) {
    throw new Error(`Tile manifest failed: ${response.status}`);
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
