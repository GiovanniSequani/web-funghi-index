import { unzlibSync } from 'fflate';
import { DataUnavailableError } from '../pointDetails/errors';
import type {
  IndexHistoryChunk,
  IndexHistoryCurrent,
  IndexHistoryField,
  IndexHistoryManifest,
  IndexHistoryPointData,
} from './historyTypes';

export function decompressIndexHistoryChunk(
  compressed: ArrayBuffer,
  expectedRawLength: number,
): ArrayBuffer {
  let uncompressed: Uint8Array;
  try {
    uncompressed = unzlibSync(new Uint8Array(compressed));
  } catch {
    throw new DataUnavailableError('Il chunk index-history non è un flusso zlib valido.');
  }
  if (uncompressed.byteLength !== expectedRawLength) {
    throw new DataUnavailableError(
      'Lunghezza raw del chunk index-history non valida.',
    );
  }
  return uncompressed.buffer.slice(
    uncompressed.byteOffset,
    uncompressed.byteOffset + uncompressed.byteLength,
  ) as ArrayBuffer;
}

function historyField(
  manifest: IndexHistoryManifest,
  name: string,
): IndexHistoryField {
  const field = manifest.binary_layout.fields.find((candidate) => candidate.name === name);
  if (
    !field ||
    field.dtype !== 'float32' ||
    !Array.isArray(field.shape) ||
    field.shape.length !== 1 ||
    field.shape[0] !== manifest.day_count ||
    !Number.isInteger(field.offset_bytes) ||
    field.offset_bytes < 0 ||
    field.offset_bytes + manifest.day_count * 4 > manifest.binary_layout.bytes_per_cell_uncompressed
  ) {
    throw new DataUnavailableError('Campo ' + name + ' di index-history incompatibile.');
  }
  return field;
}

function decodeSeries(
  view: DataView,
  field: IndexHistoryField,
  cellOffset: number,
  dayCount: number,
): Array<number | null> {
  return Array.from({ length: dayCount }, (_, index) => {
    const value = view.getFloat32(cellOffset + field.offset_bytes + index * 4, true);
    if (Number.isNaN(value)) return null;
    if (!Number.isFinite(value)) {
      throw new DataUnavailableError('Valore index-history non finito non dichiarato nodata.');
    }
    return value;
  });
}

export function decodeIndexHistoryCell(
  rawBuffer: ArrayBuffer,
  manifest: IndexHistoryManifest,
  chunk: IndexHistoryChunk,
  localRow: number,
  localCol: number,
  current: IndexHistoryCurrent,
): IndexHistoryPointData {
  const bytesPerCell = manifest.binary_layout.bytes_per_cell_uncompressed;
  if (
    manifest.binary_layout.endianness !== 'little' ||
    manifest.binary_layout.layout !== 'row-major interleaved cells' ||
    !Number.isInteger(bytesPerCell) ||
    bytesPerCell <= 0 ||
    manifest.dates.length !== manifest.day_count
  ) {
    throw new DataUnavailableError('Layout binario index-history non supportato.');
  }
  if (
    rawBuffer.byteLength !== chunk.raw_byte_length ||
    chunk.raw_byte_length !== chunk.rows * chunk.cols * bytesPerCell
  ) {
    throw new DataUnavailableError('Metadata del chunk index-history non coerenti.');
  }
  if (localRow < 0 || localRow >= chunk.rows || localCol < 0 || localCol >= chunk.cols) {
    throw new DataUnavailableError('Cella locale fuori dai limiti del chunk index-history.');
  }

  const cellOffset = (localRow * chunk.cols + localCol) * bytesPerCell;
  if (cellOffset + bytesPerCell > rawBuffer.byteLength) {
    throw new DataUnavailableError('Offset della cella index-history fuori dal chunk.');
  }

  const porcini = historyField(manifest, 'porcini_score');
  const finferli = historyField(manifest, 'finferli_score');
  const view = new DataView(rawBuffer);
  const porciniScores = decodeSeries(view, porcini, cellOffset, manifest.day_count);
  const finferliScores = decodeSeries(view, finferli, cellOffset, manifest.day_count);

  return {
    version: current.version,
    indexDate: current.index_date || manifest.index_date,
    row: chunk.row_offset + localRow,
    col: chunk.col_offset + localCol,
    missingDates: [...manifest.missing_dates],
    days: manifest.dates.map((date, index) => ({
      date,
      porciniScore: porciniScores[index],
      finferliScore: finferliScores[index],
    })),
  };
}