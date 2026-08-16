import { gzip, gunzip } from 'fflate';
import { AccountArchiveError, type ArchiveConfig, type GpxMapData, type PreparedGpxUpload } from './types';

const EARTH_RADIUS_M = 6_371_000;

function compress(bytes: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => gzip(bytes, { level: 6 }, (error, result) => error ? reject(error) : resolve(result)));
}
function decompress(bytes: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => gunzip(bytes, (error, result) => error ? reject(error) : resolve(result)));
}
function radians(value: number) { return value * Math.PI / 180; }
function segmentDistance(points: number[][]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const [lon1, lat1] = points[index - 1]; const [lon2, lat2] = points[index];
    const dLat = radians(lat2 - lat1); const dLon = radians(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
    total += EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}
function species(value: string): 'porcino' | 'finferlo' | null {
  const normalized = value.toLowerCase();
  if (normalized.includes('porcin')) return 'porcino';
  if (normalized.includes('finferl') || normalized.includes('gallinacc')) return 'finferlo';
  return null;
}
function coordinates(node: Element): [number, number] | null {
  const latitude = Number(node.getAttribute('lat')); const longitude = Number(node.getAttribute('lon'));
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? [longitude, latitude] : null;
}

function parseGpx(raw: Uint8Array, filename: string) {
  const document = new DOMParser().parseFromString(new TextDecoder().decode(raw), 'application/xml');
  if (document.querySelector('parsererror')) throw new AccountArchiveError('invalid_gpx', 'Il file GPX non è valido.');
  const trackGroups = [...document.querySelectorAll('trkseg')].map((segment) => [...segment.querySelectorAll('trkpt')]);
  const usesTrackPoints = trackGroups.length > 0;
  const groups = usesTrackPoints ? trackGroups : [[...document.querySelectorAll('rte > rtept')]];
  const times: number[] = [];
  let rawPointIndex = 0;
  const indexedSegments = groups.map((nodes) => nodes.flatMap((node) => {
    const pointIndex = rawPointIndex; rawPointIndex += 1;
    const point = coordinates(node); if (!point) return [];
    const time = Date.parse(node.querySelector('time')?.textContent ?? ''); if (Number.isFinite(time)) times.push(time);
    return [{ pointIndex, coordinate: point }];
  })).filter((segment) => segment.length > 0);
  const segments = indexedSegments.map((segment) => segment.map((point) => point.coordinate));
  const points = segments.flat();
  if (points.length === 0) throw new AccountArchiveError('invalid_gpx', 'La traccia non contiene punti GPS validi.');
  const findings = [...document.querySelectorAll('gpx > wpt, wpt')].flatMap((node, index) => {
    const point = coordinates(node); if (!point) return [];
    const name = node.querySelector('name')?.textContent?.trim() || `Punto_${index + 1}`;
    const kind = species(`${node.querySelector('type')?.textContent ?? ''} ${name}`);
    return kind ? [{ point, name, species: kind }] : [];
  });
  const longitudes = points.map(([longitude]) => longitude); const latitudes = points.map(([, latitude]) => latitude);
  const fallback = filename.replace(/\.gpx(?:\.gz)?$/i, '').trim() || 'Traccia GPX';
  const suggestedName = document.querySelector('trk > name, rte > name, metadata > name')?.textContent?.trim() || fallback;
  const mapData: GpxMapData = {
    lines: { type: 'FeatureCollection', features: segments.filter((segment) => segment.length > 1).map((line) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } })) },
    findings: { type: 'FeatureCollection', features: findings.map((item) => ({ type: 'Feature', properties: { species: item.species, name: item.name }, geometry: { type: 'Point', coordinates: item.point } })) },
    start: points[0] as [number, number], end: points[points.length - 1] as [number, number],
    bbox: [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)],
    porciniCount: findings.filter((item) => item.species === 'porcino').length,
    finferliCount: findings.filter((item) => item.species === 'finferlo').length,
    rawPointCount: rawPointIndex,
    trackPoints: indexedSegments.flat(),
    trackSegments: indexedSegments.map((segment) => ({ points: segment })),
    usesTrackPoints,
  };
  return { pointCount: points.length, distanceM: segments.reduce((sum, segment) => sum + segmentDistance(segment), 0), bbox: { west: mapData.bbox[0], south: mapData.bbox[1], east: mapData.bbox[2], north: mapData.bbox[3] }, startedAt: times.length ? new Date(Math.min(...times)).toISOString() : null, endedAt: times.length ? new Date(Math.max(...times)).toISOString() : null, suggestedName, mapData };
}
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (!crypto.subtle) throw new AccountArchiveError('unknown', 'Il browser non supporta la verifica SHA-256 richiesta.');
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function prepareImportedGpx(file: File, config: ArchiveConfig): Promise<PreparedGpxUpload> {
  if (!/\.gpx(?:\.gz)?$/i.test(file.name)) throw new AccountArchiveError('invalid_gpx', 'Seleziona un file .gpx o .gpx.gz.');
  const input = new Uint8Array(await file.arrayBuffer()); let raw: Uint8Array; let compressed: Uint8Array;
  try { if (/\.gz$/i.test(file.name)) { compressed = input; raw = await decompress(input); } else { raw = input; compressed = await compress(raw); } }
  catch (cause) { throw new AccountArchiveError('invalid_gpx', 'Il file compresso non è un GPX valido.', { cause }); }
  if (raw.byteLength > config.max_uncompressed_bytes) throw new AccountArchiveError('size_exceeded', 'Il GPX non compresso supera il limite configurato.');
  if (compressed.byteLength > config.max_compressed_bytes) throw new AccountArchiveError('size_exceeded', 'Il file compresso supera il limite configurato.');
  return { bytes: compressed, compressedSizeBytes: compressed.byteLength, uncompressedSizeBytes: raw.byteLength, contentSha256: await sha256Hex(compressed), ...parseGpx(raw, file.name) };
}
export async function decodeCloudGpx(blob: Blob, filename: string): Promise<GpxMapData> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const gzipEncoded = /\.gz$/i.test(filename) || blob.type === 'application/gzip' || (bytes[0] === 0x1f && bytes[1] === 0x8b);
  return parseGpx(gzipEncoded ? await decompress(bytes) : bytes, filename).mapData;
}