import { decodeTerrainCell } from './decoders';
import { DataUnavailableError, OutsideCoverageError } from './errors';
import { coordinateToTerrainCell } from './geo';
import { fetchJson, throwIfAborted } from './http';
import { getSupabasePublicConfig, supabaseHeaders } from './supabaseConfig';
import type {
  MapPoint,
  TerrainChunk,
  TerrainCurrent,
  TerrainManifest,
  TerrainPointData,
} from './types';

const CURRENT_CACHE_MS = 5 * 60_000;
const TERRAIN_BUCKET = 'terrain';

let currentCache: { value: TerrainCurrent; fetchedAt: number } | null = null;
const manifestCache = new Map<string, TerrainManifest>();
const chunkCache = new Map<string, ArrayBuffer>();

function storageObjectUrl(path: string): string {
  const { url } = getSupabasePublicConfig();
  const encodedPath = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${url}/storage/v1/object/public/${TERRAIN_BUCKET}/${encodedPath}`;
}

async function getTerrainCurrent(signal?: AbortSignal): Promise<TerrainCurrent> {
  throwIfAborted(signal);
  if (currentCache && Date.now() - currentCache.fetchedAt < CURRENT_CACHE_MS) {
    return currentCache.value;
  }

  const config = getSupabasePublicConfig();
  const current = await fetchJson<TerrainCurrent>(
    storageObjectUrl('current.json'),
    {
      method: 'GET',
      headers: supabaseHeaders(config),
      signal,
      cache: 'no-cache',
    },
    'Versione terreno non disponibile.',
  );

  if (!current.version || !current.manifest_path) {
    throw new DataUnavailableError('Manifest terreno corrente non valido.');
  }
  currentCache = { value: current, fetchedAt: Date.now() };
  return current;
}

async function getTerrainManifest(
  current: TerrainCurrent,
  signal?: AbortSignal,
): Promise<TerrainManifest> {
  throwIfAborted(signal);
  const cacheKey = `${current.version}/${current.manifest_path}`;
  const cached = manifestCache.get(cacheKey);
  if (cached) return cached;

  const config = getSupabasePublicConfig();
  const manifest = await fetchJson<TerrainManifest>(
    storageObjectUrl(current.manifest_path),
    {
      method: 'GET',
      headers: supabaseHeaders(config),
      signal,
      cache: 'force-cache',
    },
    'Manifest terreno non disponibile.',
  );

  if (
    manifest.version !== current.version ||
    manifest.rows !== 500 ||
    manifest.cols !== 700 ||
    manifest.chunk_size?.rows !== 50 ||
    manifest.chunk_size?.cols !== 50 ||
    !Array.isArray(manifest.chunks)
  ) {
    throw new DataUnavailableError('Manifest terreno incompatibile.');
  }
  manifestCache.set(cacheKey, manifest);
  return manifest;
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function getTerrainChunk(
  version: string,
  chunk: TerrainChunk,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  throwIfAborted(signal);
  const cacheKey = `${version}/${chunk.row}/${chunk.col}/${chunk.path}`;
  const cached = chunkCache.get(cacheKey);
  if (cached) return cached;

  const config = getSupabasePublicConfig();
  const response = await fetch(storageObjectUrl(chunk.path), {
    method: 'GET',
    headers: supabaseHeaders(config),
    signal,
    cache: 'force-cache',
  });
  if (!response.ok) {
    throw new DataUnavailableError(`Chunk terreno non disponibile (${response.status}).`);
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength !== chunk.byte_length) {
    throw new DataUnavailableError('Lunghezza del chunk terreno non valida.');
  }

  if (chunk.sha256) {
    const digest = await sha256Hex(buffer);
    throwIfAborted(signal);
    if (digest && digest.toLowerCase() !== chunk.sha256.toLowerCase()) {
      throw new DataUnavailableError('Verifica SHA-256 del chunk terreno fallita.');
    }
  }

  chunkCache.set(cacheKey, buffer);
  return buffer;
}

export async function loadTerrainPoint(
  point: MapPoint,
  signal?: AbortSignal,
): Promise<TerrainPointData> {
  const current = await getTerrainCurrent(signal);
  const manifest = await getTerrainManifest(current, signal);
  const cell = coordinateToTerrainCell(
    point,
    manifest,
    manifest.chunk_size.rows,
    manifest.chunk_size.cols,
  );
  if (!cell) {
    throw new OutsideCoverageError('Il punto è fuori dalla copertura del terreno.');
  }

  const chunk = manifest.chunks.find(
    (candidate) => candidate.row === cell.chunkRow && candidate.col === cell.chunkCol,
  );
  if (!chunk) {
    throw new DataUnavailableError('Chunk terreno della cella non presente nel manifest.');
  }

  const localRow = cell.row - chunk.row_offset;
  const localCol = cell.col - chunk.col_offset;
  const buffer = await getTerrainChunk(current.version, chunk, signal);
  return decodeTerrainCell(buffer, chunk, localRow, localCol, current.version);
}

export function clearTerrainCaches(): void {
  currentCache = null;
  manifestCache.clear();
  chunkCache.clear();
}
