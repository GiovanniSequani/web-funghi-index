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
  ready_at: string;
  created_at: string;
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

export type AccountErrorCode =
  | 'duplicate_username'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'quota_exceeded'
  | 'session_expired'
  | 'partial_delete'
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
