import type { Session } from '@supabase/supabase-js';

export type ArchiveConfig = {
  singleton_id: 1;
  max_tracks_per_user: number;
  max_compressed_bytes: number;
  max_uncompressed_bytes: number;
  terms_version: string;
  privacy_version: string;
  research_consent_version: string;
  updated_at: string;
};

export type UserProfile = {
  user_id: string;
  username: string;
  terms_version: string;
  privacy_version: string;
  raw_gpx_research_consent: boolean;
  raw_gpx_research_consent_version: string;
};

export type GpxTrack = {
  id: string;
  storage_path: string;
  status: 'ready';
  display_name: string;
  original_filename: string;
  compressed_size_bytes: number;
  uncompressed_size_bytes: number | null;
  started_at: string | null;
  ended_at: string | null;
  point_count: number | null;
  distance_m: number | null;
  trim_start_point_index: number | null;
  trim_end_point_index: number | null;
  ready_at: string;
  created_at: string;
};

export type GpxTrackPoint = {
  pointIndex: number;
  coordinate: [number, number];
};

export type GpxTrackSegment = { points: GpxTrackPoint[] };

export type GpxMushroomMarker = {
  track_id: string;
  track_point_index: number;
  latitude: number;
  longitude: number;
  species: 'porcini' | 'finferli';
  count: number;
  created_at?: string;
  updated_at?: string;
};

export type AccountSessionState = {
  session: Session | null;
  username: string | null;
  loading: boolean;
  error: string | null;
};

export type ArchiveData = {
  config: ArchiveConfig;
  profile: UserProfile;
  tracks: GpxTrack[];
};

export type GpxMarker = {
  latitude: number;
  longitude: number;
  name: string;
  species: 'porcino' | 'finferlo' | null;
};

export type GpxMapData = {
  lines: GeoJSON.FeatureCollection<GeoJSON.LineString>;
  findings: GeoJSON.FeatureCollection<GeoJSON.Point, { species: 'porcino' | 'finferlo'; name: string }>;
  start: [number, number];
  end: [number, number];
  bbox: [number, number, number, number];
  porciniCount: number;
  finferliCount: number;
  rawPointCount: number;
  trackPoints: GpxTrackPoint[];
  trackSegments: GpxTrackSegment[];
  usesTrackPoints: boolean;
};

export type GpxEditDraft = { trimStart: number; trimEnd: number; markers: GpxMushroomMarker[] };

export type CloudMapTrack = {
  id: string;
  name: string;
  data: GpxMapData;
  track: GpxTrack;
  markers: GpxMushroomMarker[];
  preview?: GpxEditDraft;
};

export type PreparedGpxUpload = {
  bytes: Uint8Array;
  compressedSizeBytes: number;
  uncompressedSizeBytes: number;
  contentSha256: string;
  startedAt: string | null;
  endedAt: string | null;
  pointCount: number;
  distanceM: number;
  bbox: { west: number; south: number; east: number; north: number };
  mapData: GpxMapData;
  suggestedName: string;
};

export type ReserveTrackResult = { id: string; storage_path: string };

export type AccountErrorCode =
  | 'duplicate_username'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'quota_exceeded'
  | 'session_expired'
  | 'account_restricted'
  | 'document_outdated'
  | 'lifecycle_unavailable'
  | 'rights_unavailable'
  | 'export_expired'
  | 'export_rate_limited'
  | 'deletion_token_invalid'
  | 'deletion_rate_limited'
  | 'partial_delete'
  | 'invalid_gpx'
  | 'size_exceeded'
  | 'upload_failed'
  | 'finalize_failed'
  | 'invalid_track_name'
  | 'track_not_found'
  | 'network'
  | 'unknown';

export class AccountArchiveError extends Error {
  readonly code: AccountErrorCode;
  readonly partial: boolean;

  constructor(code: AccountErrorCode, message: string, options?: { cause?: unknown; partial?: boolean }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AccountArchiveError';
    this.code = code;
    this.partial = options?.partial ?? false;
  }
}
