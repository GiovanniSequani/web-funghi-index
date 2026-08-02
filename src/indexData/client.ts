import { DataUnavailableError, OutsideCoverageError } from '../pointDetails/errors';
import { coordinateToTerrainCell } from '../pointDetails/geo';
import { fetchJson, throwIfAborted } from '../pointDetails/http';
import { getSupabasePublicConfig, supabaseHeaders } from '../pointDetails/supabaseConfig';
import type { MapPoint } from '../pointDetails/types';
import { decodeIndexCell, decompressIndexChunk } from './decoder';
import type { IndexChunk, IndexCurrent, IndexManifest, IndexPointData } from './types';

const INDEX_BUCKET = 'index-data';
const CURRENT_CACHE_MS = 60_000;

let activeVersion: string | null = null;
let currentCache: { value: IndexCurrent; fetchedAt: number } | null = null;
const manifestCache = new Map<string, IndexManifest>();
const chunkCache = new Map<string, ArrayBuffer>();

function storageObjectUrl(path: string): string {
  const { url } = getSupabasePublicConfig();
  const encodedPath = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${url}/storage/v1/object/public/${INDEX_BUCKET}/${encodedPath}`;
}

function activateVersion(version: string): void {
  if (activeVersion !== null && activeVersion !== version) {
    manifestCache.clear();
    chunkCache.clear();
  }
  activeVersion = version;
}

async function getCurrent(signal?: AbortSignal): Promise<IndexCurrent> {
  throwIfAborted(signal);
  if (currentCache && Date.now() - currentCache.fetchedAt < CURRENT_CACHE_MS) {
    activateVersion(currentCache.value.version);
    return currentCache.value;
  }

  const config = getSupabasePublicConfig();
  const current = await fetchJson<IndexCurrent>(
    storageObjectUrl('current.json'),
    {
      method: 'GET',
      headers: supabaseHeaders(config),
      signal,
      cache: 'no-cache',
    },
    'Versione corrente dell’indice non disponibile.',
  );
  if (
    current.contract_version !== 1 ||
    !current.version ||
    !current.index_date ||
    !current.manifest_path
  ) {
    throw new DataUnavailableError('Pointer current index-data non valido.');
  }

  activateVersion(current.version);
  currentCache = { value: current, fetchedAt: Date.now() };
  return current;
}

async function getManifest(
  current: IndexCurrent,
  signal?: AbortSignal,
): Promise<IndexManifest> {
  throwIfAborted(signal);
  const cached = manifestCache.get(current.version);
  if (cached) return cached;

  const config = getSupabasePublicConfig();
  const manifest = await fetchJson<IndexManifest>(
    storageObjectUrl(current.manifest_path),
    {
      method: 'GET',
      headers: supabaseHeaders(config),
      signal,
      cache: 'force-cache',
    },
    'Manifest index-data non disponibile.',
  );
  if (
    manifest.contract_version !== current.contract_version ||
    manifest.version !== current.version ||
    manifest.dataset_sha256 !== current.dataset_sha256 ||
    manifest.compression?.codec !== 'zlib' ||
    !Array.isArray(manifest.chunks) ||
    !Array.isArray(manifest.binary_layout?.fields) ||
    manifest.rows <= 0 ||
    manifest.cols <= 0 ||
    manifest.chunk_size?.rows <= 0 ||
    manifest.chunk_size?.cols <= 0
  ) {
    throw new DataUnavailableError('Manifest index-data incompatibile.');
  }

  manifestCache.set(current.version, manifest);
  return manifest;
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function getChunk(
  current: IndexCurrent,
  chunk: IndexChunk,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  throwIfAborted(signal);
  const cacheKey = `${current.version}/${chunk.row}/${chunk.col}/${chunk.path}`;
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
    throw new DataUnavailableError(`Chunk index-data non disponibile (${response.status}).`);
  }

  const compressed = await response.arrayBuffer();
  if (compressed.byteLength !== chunk.byte_length) {
    throw new DataUnavailableError('Lunghezza compressa del chunk index-data non valida.');
  }
  if (chunk.sha256) {
    const digest = await sha256Hex(compressed);
    throwIfAborted(signal);
    if (digest && digest.toLowerCase() !== chunk.sha256.toLowerCase()) {
      throw new DataUnavailableError('Verifica SHA-256 del chunk index-data fallita.');
    }
  }

  const raw = decompressIndexChunk(compressed, chunk.raw_byte_length);
  throwIfAborted(signal);
  chunkCache.set(cacheKey, raw);
  return raw;
}

export async function loadIndexPoint(
  point: MapPoint,
  signal?: AbortSignal,
): Promise<IndexPointData> {
  const current = await getCurrent(signal);
  const manifest = await getManifest(current, signal);
  const cell = coordinateToTerrainCell(
    point,
    manifest,
    manifest.chunk_size.rows,
    manifest.chunk_size.cols,
  );
  if (!cell) {
    throw new OutsideCoverageError('Il punto è fuori dalla griglia dell’indice.');
  }

  const chunk = manifest.chunks.find(
    (candidate) => candidate.row === cell.chunkRow && candidate.col === cell.chunkCol,
  );
  if (!chunk) {
    throw new DataUnavailableError('Chunk index-data della cella non presente nel manifest.');
  }

  const localRow = cell.row - chunk.row_offset;
  const localCol = cell.col - chunk.col_offset;
  const raw = await getChunk(current, chunk, signal);
  return decodeIndexCell(raw, manifest, chunk, localRow, localCol, current);
}

export function clearIndexDataCaches(): void {
  activeVersion = null;
  currentCache = null;
  manifestCache.clear();
  chunkCache.clear();
}
