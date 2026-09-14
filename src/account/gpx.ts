import { Gunzip, gzip } from 'fflate';
import { AccountArchiveError, type ArchiveConfig, type GpxMapData, type PreparedGpxUpload } from './types';

const EARTH_RADIUS_M = 6_371_000;
const INPUT_CHUNK_BYTES = 4 * 1024;
const RAW_INPUT_CHUNK_BYTES = 64 * 1024;
const MAX_XML_ELEMENTS = 350_000;
const MAX_TRACK_POINTS = 250_000;
const MAX_WAYPOINTS = 50_000;
const MAX_XML_DEPTH = 128;
const MAX_XML_TOKEN_CHARS = 64 * 1024;
const MAX_XML_TEXT_CHARS = 1024 * 1024;
const PARSE_TIME_BUDGET_MS = 5_000;
type GpxLimits = Pick<ArchiveConfig, 'max_compressed_bytes' | 'max_uncompressed_bytes'>;
const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function assertLimits(limits: GpxLimits): void {
  if (!Number.isSafeInteger(limits.max_compressed_bytes) || limits.max_compressed_bytes <= 0
    || !Number.isSafeInteger(limits.max_uncompressed_bytes) || limits.max_uncompressed_bytes <= 0) {
    throw new AccountArchiveError('invalid_gpx', 'I limiti GPX ricevuti dal server non sono validi.');
  }
}

function assertSize(size: number, maximum: number, message: string): void {
  if (size > maximum) throw new AccountArchiveError('size_exceeded', message);
}

function compress(bytes: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => gzip(bytes, { level: 6 }, (error, result) => error ? reject(error) : resolve(result)));
}

class GpxXmlPreflight {
  private readonly decoder = new TextDecoder('utf-8', { fatal: true });
  private pending = '';
  private textRun = 0;
  private elementCount = 0;
  private trackPointCount = 0;
  private waypointCount = 0;
  private depth = 0;
  private rootSeen = false;

  push(bytes: Uint8Array, final = false): void {
    let text: string;
    try {
      text = this.decoder.decode(bytes, { stream: !final });
    } catch (cause) {
      throw new AccountArchiveError('invalid_gpx', 'Il GPX non usa una codifica UTF-8 valida.', { cause });
    }
    this.inspect(text, final);
  }

  private inspect(text: string, final: boolean): void {
    this.pending += text;
    while (this.pending.length > 0) {
      if (this.pending[0] !== '<') {
        const next = this.pending.indexOf('<');
        const consumed = next === -1 ? this.pending.length : next;
        this.textRun += consumed;
        if (this.textRun > MAX_XML_TEXT_CHARS) this.rejectComplexity();
        this.pending = this.pending.slice(consumed);
        if (next === -1) break;
      }

      this.textRun = 0;
      const end = this.findMarkupEnd(this.pending);
      if (end === null) {
        if (this.pending.length > MAX_XML_TOKEN_CHARS) this.rejectComplexity();
        break;
      }
      const markup = this.pending.slice(0, end);
      this.pending = this.pending.slice(end);
      this.inspectMarkup(markup);
    }

    if (final) {
      if (this.pending.trim()) {
        throw new AccountArchiveError('invalid_gpx', 'Il contenuto XML del GPX è incompleto o non valido.');
      }
      if (!this.rootSeen || this.depth !== 0) {
        throw new AccountArchiveError('invalid_gpx', 'Il file non contiene un documento GPX valido.');
      }
    }
  }

  private findMarkupEnd(value: string): number | null {
    if (value.startsWith('<!--')) {
      const end = value.indexOf('-->');
      return end === -1 ? null : end + 3;
    }
    if (value.startsWith('<![CDATA[')) {
      const end = value.indexOf(']]>');
      return end === -1 ? null : end + 3;
    }
    if (value.startsWith('<?')) {
      const end = value.indexOf('?>');
      return end === -1 ? null : end + 2;
    }
    if (value.length < 2) return null;

    let quote: '"' | "'" | null = null;
    for (let index = 1; index < value.length; index += 1) {
      const character = value[index];
      if (quote) {
        if (character === quote) quote = null;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === '>') {
        return index + 1;
      }
    }
    return null;
  }

  private inspectMarkup(markup: string): void {
    if (/^<!\s*(?:DOCTYPE|ENTITY)\b/i.test(markup)) {
      throw new AccountArchiveError('invalid_gpx', 'Il GPX contiene una dichiarazione DTD o ENTITY non consentita.');
    }
    if (markup.startsWith('<!--') || markup.startsWith('<?')) return;
    if (markup.startsWith('<![CDATA[')) {
      if (!this.rootSeen) throw new AccountArchiveError('invalid_gpx', 'Il file non contiene un documento GPX valido.');
      return;
    }
    if (markup.startsWith('<!')) {
      throw new AccountArchiveError('invalid_gpx', 'Il GPX contiene una dichiarazione XML non consentita.');
    }

    const closing = /^<\s*\//.test(markup);
    const selfClosing = /\/\s*>$/.test(markup);
    const name = markup.match(/^<\s*\/?\s*(?:[\w.-]+:)?([\w.-]+)/)?.[1]?.toLowerCase();
    if (!name) throw new AccountArchiveError('invalid_gpx', 'Il contenuto XML del GPX non è valido.');

    if (closing) {
      this.depth -= 1;
      if (this.depth < 0) throw new AccountArchiveError('invalid_gpx', 'Il contenuto XML del GPX non è valido.');
      return;
    }

    if (!this.rootSeen) {
      if (name !== 'gpx') throw new AccountArchiveError('invalid_gpx', 'Il file non contiene un documento GPX valido.');
      this.rootSeen = true;
    }
    this.elementCount += 1;
    if (this.elementCount > MAX_XML_ELEMENTS) this.rejectComplexity('Il GPX contiene troppi elementi.');
    if (name === 'trkpt' || name === 'rtept') {
      this.trackPointCount += 1;
      if (this.trackPointCount > MAX_TRACK_POINTS) this.rejectComplexity('La traccia contiene troppi punti GPS.');
    } else if (name === 'wpt') {
      this.waypointCount += 1;
      if (this.waypointCount > MAX_WAYPOINTS) this.rejectComplexity('Il GPX contiene troppi ritrovamenti.');
    }
    if (!selfClosing) {
      this.depth += 1;
      if (this.depth > MAX_XML_DEPTH) this.rejectComplexity();
    }
  }

  private rejectComplexity(message = 'Il GPX è troppo complesso da elaborare nel browser.'): never {
    throw new AccountArchiveError('invalid_gpx', message);
  }
}

async function preflightRawBlob(blob: Blob): Promise<void> {
  const scanner = new GpxXmlPreflight();
  for (let offset = 0; offset < blob.size; offset += RAW_INPUT_CHUNK_BYTES) {
    const end = Math.min(blob.size, offset + RAW_INPUT_CHUNK_BYTES);
    scanner.push(new Uint8Array(await blob.slice(offset, end).arrayBuffer()));
  }
  scanner.push(new Uint8Array(), true);
}

async function readRawBlob(blob: Blob, maximum: number): Promise<Uint8Array> {
  assertSize(blob.size, maximum, 'Il GPX non compresso supera il limite configurato.');
  await preflightRawBlob(blob);
  return new Uint8Array(await blob.arrayBuffer());
}

async function decompressBlob(blob: Blob, limits: GpxLimits): Promise<Uint8Array> {
  assertSize(blob.size, limits.max_compressed_bytes, 'Il file compresso supera il limite configurato.');
  if (blob.size < 18) throw new AccountArchiveError('invalid_gpx', 'Il file gzip è troncato o non valido.');
  const header = new Uint8Array(await blob.slice(0, 10).arrayBuffer());
  if (header[0] !== 0x1f || header[1] !== 0x8b || header[2] !== 8 || (header[3] & 0xe0) !== 0) {
    throw new AccountArchiveError('invalid_gpx', 'Il file non contiene un archivio gzip valido.');
  }
  const trailer = new DataView(await blob.slice(blob.size - 8).arrayBuffer());
  const expectedCrc = trailer.getUint32(0, true);
  const expectedSize = trailer.getUint32(4, true);
  assertSize(expectedSize, limits.max_uncompressed_bytes, 'Il GPX compresso dichiara una dimensione oltre il limite oppure è danneggiato.');

  const chunks: Uint8Array[] = [];
  const scanner = new GpxXmlPreflight();
  let outputBytes = 0;
  let crc32 = 0xffffffff;
  let extraMember = false;
  const stream = new Gunzip((chunk) => {
    if (extraMember) throw new AccountArchiveError('invalid_gpx', 'Gli archivi gzip con più contenuti non sono supportati.');
    const nextOutputBytes = outputBytes + chunk.byteLength;
    assertSize(nextOutputBytes, limits.max_uncompressed_bytes, 'Il GPX non compresso supera il limite configurato.');
    if (nextOutputBytes > expectedSize) {
      throw new AccountArchiveError('invalid_gpx', 'Il file gzip dichiara una dimensione non coerente con il contenuto.');
    }
    scanner.push(chunk);
    for (const byte of chunk) crc32 = CRC32_TABLE[(crc32 ^ byte) & 0xff] ^ (crc32 >>> 8);
    chunks.push(chunk);
    outputBytes = nextOutputBytes;
  });
  stream.onmember = () => { extraMember = true; };

  try {
    for (let offset = 0; offset < blob.size; offset += INPUT_CHUNK_BYTES) {
      const end = Math.min(blob.size, offset + INPUT_CHUNK_BYTES);
      stream.push(new Uint8Array(await blob.slice(offset, end).arrayBuffer()), end === blob.size);
      if (extraMember) throw new AccountArchiveError('invalid_gpx', 'Gli archivi gzip con più contenuti non sono supportati.');
    }
  } catch (cause) {
    if (cause instanceof AccountArchiveError) throw cause;
    throw new AccountArchiveError('invalid_gpx', 'Il file gzip è troncato o non valido.', { cause });
  }

  if (extraMember) throw new AccountArchiveError('invalid_gpx', 'Gli archivi gzip con più contenuti non sono supportati.');
  scanner.push(new Uint8Array(), true);
  if (((crc32 ^ 0xffffffff) >>> 0) !== expectedCrc || outputBytes !== expectedSize) {
    throw new AccountArchiveError('invalid_gpx', 'Il file gzip è troncato o non supera il controllo di integrità.');
  }
  const result = new Uint8Array(outputBytes);
  let cursor = 0;
  for (const chunk of chunks) {
    result.set(chunk, cursor);
    cursor += chunk.byteLength;
  }
  return result;
}

async function isGzipBlob(blob: Blob, filename: string): Promise<boolean> {
  if (/\.gz$/i.test(filename) || blob.type === 'application/gzip' || blob.type === 'application/x-gzip') return true;
  if (blob.size < 2) return false;
  const prefix = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  return prefix[0] === 0x1f && prefix[1] === 0x8b;
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
  let xml: string;
  try { xml = new TextDecoder('utf-8', { fatal: true }).decode(raw); }
  catch (cause) { throw new AccountArchiveError('invalid_gpx', 'Il GPX non usa una codifica UTF-8 valida.', { cause }); }
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) {
    throw new AccountArchiveError('invalid_gpx', 'Il GPX contiene una dichiarazione DTD o ENTITY non consentita.');
  }
  if (xml.includes('\0')) throw new AccountArchiveError('invalid_gpx', 'Il GPX contiene dati binari non validi.');

  const started = performance.now();
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror') || document.documentElement.localName.toLowerCase() !== 'gpx') {
    throw new AccountArchiveError('invalid_gpx', 'Il file non contiene un documento GPX valido.');
  }
  if (document.getElementsByTagName('*').length > MAX_XML_ELEMENTS) {
    throw new AccountArchiveError('invalid_gpx', 'Il GPX contiene troppi elementi.');
  }

  const trackGroups = [...document.querySelectorAll('trkseg')].map((segment) => [...segment.querySelectorAll('trkpt')]);
  const usesTrackPoints = trackGroups.length > 0;
  const groups = usesTrackPoints ? trackGroups : [[...document.querySelectorAll('rte > rtept')]];
  const totalTrackPoints = groups.reduce((sum, nodes) => sum + nodes.length, 0);
  if (totalTrackPoints > MAX_TRACK_POINTS) throw new AccountArchiveError('invalid_gpx', 'La traccia contiene troppi punti GPS.');
  const waypointNodes = [...document.querySelectorAll('wpt')];
  if (waypointNodes.length > MAX_WAYPOINTS) throw new AccountArchiveError('invalid_gpx', 'Il GPX contiene troppi ritrovamenti.');

  const times: number[] = [];
  let rawPointIndex = 0;
  let invalidPoints = 0;
  let west = Number.POSITIVE_INFINITY; let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY; let north = Number.NEGATIVE_INFINITY;
  const indexedSegments = groups.map((nodes) => nodes.flatMap((node) => {
    const pointIndex = rawPointIndex; rawPointIndex += 1;
    const point = coordinates(node);
    if (!point) { invalidPoints += 1; return []; }
    west = Math.min(west, point[0]); east = Math.max(east, point[0]);
    south = Math.min(south, point[1]); north = Math.max(north, point[1]);
    const time = Date.parse(node.querySelector('time')?.textContent ?? ''); if (Number.isFinite(time)) times.push(time);
    return [{ pointIndex, coordinate: point }];
  })).filter((segment) => segment.length > 0);
  if (invalidPoints > 0) throw new AccountArchiveError('invalid_gpx', 'La traccia contiene coordinate mancanti o fuori intervallo.');
  const segments = indexedSegments.map((segment) => segment.map((point) => point.coordinate));
  const points = segments.flat();
  if (points.length < 2) throw new AccountArchiveError('invalid_gpx', 'La traccia deve contenere almeno due punti GPS validi.');
  const findings = waypointNodes.flatMap((node, index) => {
    const point = coordinates(node);
    if (!point) throw new AccountArchiveError('invalid_gpx', 'Un ritrovamento contiene coordinate mancanti o fuori intervallo.');
    const name = node.querySelector('name')?.textContent?.trim() || `Punto_${index + 1}`;
    const kind = species(`${node.querySelector('type')?.textContent ?? ''} ${name}`);
    return kind ? [{ point, name, species: kind }] : [];
  });
  if (performance.now() - started > PARSE_TIME_BUDGET_MS) {
    throw new AccountArchiveError('invalid_gpx', 'Il GPX è troppo complesso da elaborare nel browser.');
  }
  const fallback = filename.replace(/\.gpx(?:\.gz)?$/i, '').trim() || 'Traccia GPX';
  const suggestedName = document.querySelector('trk > name, rte > name, metadata > name')?.textContent?.trim() || fallback;
  const mapData: GpxMapData = {
    lines: { type: 'FeatureCollection', features: segments.filter((segment) => segment.length > 1).map((line) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } })) },
    findings: { type: 'FeatureCollection', features: findings.map((item) => ({ type: 'Feature', properties: { species: item.species, name: item.name }, geometry: { type: 'Point', coordinates: item.point } })) },
    start: points[0] as [number, number], end: points[points.length - 1] as [number, number],
    bbox: [west, south, east, north],
    porciniCount: findings.filter((item) => item.species === 'porcino').length,
    finferliCount: findings.filter((item) => item.species === 'finferlo').length,
    rawPointCount: rawPointIndex,
    trackPoints: indexedSegments.flat(),
    trackSegments: indexedSegments.map((segment) => ({ points: segment })),
    usesTrackPoints,
  };
  return { pointCount: points.length, distanceM: segments.reduce((sum, segment) => sum + segmentDistance(segment), 0), bbox: { west, south, east, north }, startedAt: times.length ? new Date(Math.min(...times)).toISOString() : null, endedAt: times.length ? new Date(Math.max(...times)).toISOString() : null, suggestedName, mapData };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (!crypto.subtle) throw new AccountArchiveError('unknown', 'Il browser non supporta la verifica SHA-256 richiesta.');
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function prepareImportedGpx(file: File, config: ArchiveConfig): Promise<PreparedGpxUpload> {
  if (!/\.gpx(?:\.gz)?$/i.test(file.name)) throw new AccountArchiveError('invalid_gpx', 'Seleziona un file .gpx o .gpx.gz.');
  assertLimits(config);
  assertSize(
    file.size,
    /\.gz$/i.test(file.name) ? config.max_compressed_bytes : config.max_uncompressed_bytes,
    /\.gz$/i.test(file.name) ? 'Il file compresso supera il limite configurato.' : 'Il GPX non compresso supera il limite configurato.',
  );
  const gzipEncoded = await isGzipBlob(file, file.name);
  let raw: Uint8Array;
  let compressed: Uint8Array;
  try {
    if (gzipEncoded) {
      raw = await decompressBlob(file, config);
      compressed = new Uint8Array(await file.arrayBuffer());
    } else {
      raw = await readRawBlob(file, config.max_uncompressed_bytes);
      compressed = await compress(raw);
    }
  } catch (cause) {
    if (cause instanceof AccountArchiveError) throw cause;
    throw new AccountArchiveError('invalid_gpx', 'Il file compresso non è un GPX valido.', { cause });
  }
  assertSize(raw.byteLength, config.max_uncompressed_bytes, 'Il GPX non compresso supera il limite configurato.');
  assertSize(compressed.byteLength, config.max_compressed_bytes, 'Il file compresso supera il limite configurato.');
  return { bytes: compressed, compressedSizeBytes: compressed.byteLength, uncompressedSizeBytes: raw.byteLength, contentSha256: await sha256Hex(compressed), ...parseGpx(raw, file.name) };
}

export async function decodeCloudGpx(blob: Blob, filename: string, config: ArchiveConfig): Promise<GpxMapData> {
  assertLimits(config);
  const gzipEncoded = await isGzipBlob(blob, filename);
  const raw = gzipEncoded
    ? await decompressBlob(blob, config)
    : await readRawBlob(blob, config.max_uncompressed_bytes);
  return parseGpx(raw, filename).mapData;
}
