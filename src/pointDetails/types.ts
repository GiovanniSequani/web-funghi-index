export type MapPoint = {
  longitude: number;
  latitude: number;
};

export type BoundingBox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type GridDefinition = {
  rows: number;
  cols: number;
  origin_lat: number;
  origin_lon: number;
  step_deg: number;
  bbox: BoundingBox;
};

export type GridCell = {
  row: number;
  col: number;
};

export type TerrainGridCell = GridCell & {
  chunkRow: number;
  chunkCol: number;
  localRow: number;
  localCol: number;
};

export type WeatherStateRow = {
  current_version: string;
};

export type WeatherVariableMetadata = {
  unit: string;
  dtype: string;
  scale: number;
  nodata: number;
  offset: number;
  description: string;
};

export type WeatherDataset = GridDefinition & {
  version: string;
  dates: string[];
  available_day_count: number;
  missing_dates: string[];
  variables: Record<string, WeatherVariableMetadata>;
};

export type EncodedWeatherCell = {
  version: string;
  row_idx: number;
  col_idx: number;
  t2m_min: number[] | null;
  t2m_max: number[] | null;
  precip_sum: number[] | null;
  rh_mean: number[] | null;
  gust_max: number[] | null;
};

export type WeatherDay = {
  date: string;
  missing: boolean;
  temperatureMin: number | null;
  temperatureMax: number | null;
  precipitation: number | null;
  humidity: number | null;
  gust: number | null;
};

export type WeatherPointData = {
  version: string;
  row: number;
  col: number;
  availableDayCount: number;
  missingDates: string[];
  days: WeatherDay[];
};

export type TerrainCurrent = {
  contract_version: number;
  dataset_sha256: string;
  manifest_path: string;
  version: string;
};

export type TerrainChunk = {
  byte_length: number;
  col: number;
  col_offset: number;
  cols: number;
  path: string;
  row: number;
  row_offset: number;
  rows: number;
  sha256?: string;
};

export type TerrainManifest = GridDefinition & {
  version: string;
  chunk_size: {
    rows: number;
    cols: number;
  };
  chunks: TerrainChunk[];
};

export type TerrainPointData = {
  version: string;
  row: number;
  col: number;
  elevation: number | null;
  forestPercent: number | null;
  aspectDegrees: number | null;
  tpiCategory: number;
};

export type ResourceStatus = 'idle' | 'loading' | 'success' | 'outside' | 'unavailable' | 'error';

export type ResourceState<T> = {
  status: ResourceStatus;
  data: T | null;
  message: string | null;
};

export type PointDetailsState = {
  weather: ResourceState<WeatherPointData>;
  terrain: ResourceState<TerrainPointData>;
};
