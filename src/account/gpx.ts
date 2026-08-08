import { gzip, gunzip } from 'fflate';
import { AccountArchiveError, type ArchiveConfig, type GpxMapData, type PreparedGpxUpload } from './types';

const EARTH_RADIUS_M = 6_371_000;

function transform(bytes: Uint8Array, operation: typeof gzip): Promise<Uint8Array> {
  return new Promise((resolve, reject) => operation(bytes, { level: 6 }, (error, result) => error ? reject(error) : resolve(result)));
}

function unzip(bytes: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => gunzip(bytes, (error, result) => error ? reject(error) : resolve(result)));
}

function radians(value: number) { return value * Math.PI / 180; }

function segmentDistance(points: number[][]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const [lon1, lat1] = points[index - 1];
    const [lon2, lat2] = points[index];
    const dLat = radians(lat2 - lat1);
    const dLon = radians(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
    total += EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}

function parseGpx(raw: Uint8Array, filename: string) {
  const xml = new TextDecoder().decode(raw);
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) throw new AccountArchiveError('invalid_gpx', 'Il file GPX non è valido.');
  const elements = [...document.querySelectorAll('trkseg')].map((segment) => [...segment.querySelectorAll('trkpt')]);
  if (elements.length === 0) elements.push([...document.querySelectorAll('rte > rtept')]);
  const times: number[] = [];
  const segments = elements.map((nodes) => nodes.flatMap((node) => {
    const latitude = Number(node.getAttribute('lat'));
    const longitude = Number(node.getAttribute('lon'));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return [];
    const time = Date.parse(node.querySelector('time')?.textContent ?? '');
    if (Number.isFinite(time)) times.push(time);
    return [[longitude, latitude]];
  })).filter((segment) => segment.length > 0);
  const points = segments.flat();
  if (points.length === 0) throw new AccountArchiveError('invalid_gpx', 'La traccia non contiene punti GPS validi.');
  const longitudes = points.map(([longitude]) => longitude);
  const latitudes = points.map(([, latitude]) => latitude);
  const fallback = filename.replace(/\.gpx(?:\.gz)?$/i, '').trim() || 'Traccia GPX';
  const suggestedName = document.querySelector('trk > name, rte > name')?.textContent?.trim() || fallback;
  const mapData: GpxMapData = {
    type: 'FeatureCollection',
    features: segments.filter((segment) => segment.length > 1).map((coordinates) => ({
      type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates },
    })),
  };
  return {
    pointCount: points.length,
    distanceM: segments.reduce((sum, segment) => sum + segmentDistance(segment), 0),
    bbox: { west: Math.min(...longitudes), south: Math.min(...latitudes), east: Math.max(...longitudes), north: Math.max(...latitudes) },
    startedAt: times.length ? new Date(Math.min(...times)).toISOString() : null,
    endedAt: times.length ? new Date(Math.max(...times)).toISOString() : null,
    suggestedName,
    mapData,
  };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (!crypto.subtle) throw new AccountArchiveError('unknown', 'Il browser non supporta la verifica SHA-256 richiesta.');
  const exact = bytes.slice().buffer;
  const digest = await crypto.subtle.digest('SHA-256', exact);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function prepareImportedGpx(file: File, config: ArchiveConfig): Promise<PreparedGpxUpload> {
  if (!/\.gpx(?:\.gz)?$/i.test(file.name)) throw new AccountArchiveError('invalid_gpx', 'Seleziona un file .gpx o .gpx.gz.');
  const input = new Uint8Array(await file.arrayBuffer());
  let raw: Uint8Array;
  let compressed: Uint8Array;
  try {
    if (/\.gz$/i.test(file.name)) {
      compressed = input;
      raw = await unzip(input);
    } else {
      raw = input;
      compressed = await transform(raw, gzip);
    }
  } catch (cause) {
    throw new AccountArchiveError('invalid_gpx', 'Il file compresso non è un GPX valido.', { cause });
  }
  if (raw.byteLength > config.max_uncompressed_bytes) throw new AccountArchiveError('size_exceeded', 'Il GPX non compresso supera il limite configurato.');
  if (compressed.byteLength > config.max_compressed_bytes) throw new AccountArchiveError('size_exceeded', 'Il file compresso supera il limite configurato.');
  const parsed = parseGpx(raw, file.name);
  return {
    bytes: compressed,
    compressedSizeBytes: compressed.byteLength,
    uncompressedSizeBytes: raw.byteLength,
    contentSha256: await sha256Hex(compressed),
    ...parsed,
  };
}

export async function decodeCloudGpx(blob: Blob, filename: string): Promise<GpxMapData> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const raw = /\.gz$/i.test(filename) || blob.type === 'application/gzip' ? await unzip(bytes) : bytes;
  return parseGpx(raw, filename).mapData;
}
