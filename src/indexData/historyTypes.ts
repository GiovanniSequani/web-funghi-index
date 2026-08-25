import type { GridDefinition } from '../pointDetails/types';

export type IndexHistoryCurrent = {
  contract_version: number;
  version: string;
  index_date: string;
  date_from: string;
  date_to: string;
  day_count: number;
  manifest_path: string;
  dataset_sha256: string;
};

export type IndexHistoryField = {
  name: 'porcini_score' | 'finferli_score' | string;
  dtype: string;
  shape: number[];
  nodata?: number | string | null;
  exact?: boolean;
  offset_bytes: number;
};

export type IndexHistoryChunk = {
  byte_length: number;
  raw_byte_length: number;
  col: number;
  col_offset: number;
  cols: number;
  path: string;
  row: number;
  row_offset: number;
  rows: number;
  sha256?: string;
};

export type IndexHistoryManifest = GridDefinition & {
  contract_version: number;
  version: string;
  index_date: string;
  dataset_sha256: string;
  dates: string[];
  day_count: number;
  available_dates: string[];
  missing_dates: string[];
  compression: { codec: string; level?: number };
  chunk_size: { rows: number; cols: number };
  chunks: IndexHistoryChunk[];
  binary_layout: {
    bytes_per_cell_uncompressed: number;
    endianness: string;
    layout: string;
    fields: IndexHistoryField[];
  };
};

export type IndexHistoryDay = {
  date: string;
  porciniScore: number | null;
  finferliScore: number | null;
};

export type IndexHistoryPointData = {
  version: string;
  indexDate: string;
  row: number;
  col: number;
  missingDates: string[];
  days: IndexHistoryDay[];
};