import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabasePublicConfig } from '../pointDetails/supabaseConfig';
import { AccountArchiveError, type ArchiveConfig, type ArchiveData, type GpxTrack, type UserProfile } from './types';
import { normalizeUsername, toAccountError } from './validation';

const TRACK_COLUMNS = [
  'id',
  'storage_path',
  'status',
  'display_name',
  'original_filename',
  'compressed_size_bytes',
  'uncompressed_size_bytes',
  'started_at',
  'ended_at',
  'point_count',
  'distance_m',
  'ready_at',
  'created_at',
].join(',');

let client: SupabaseClient | null = null;

export function getAccountSupabaseClient(): SupabaseClient {
  if (client) return client;
  const config = getSupabasePublicConfig();
  client = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

export async function getArchiveConfig(): Promise<ArchiveConfig> {
  const { data, error } = await getAccountSupabaseClient()
    .from('gpx_archive_config')
    .select('*')
    .eq('singleton_id', 1)
    .single();
  if (error) throw toAccountError(error);
  return data as ArchiveConfig;
}

export async function getMyProfile(): Promise<UserProfile> {
  const { data, error } = await getAccountSupabaseClient()
    .from('user_profiles')
    .select('*')
    .single();
  if (error) throw toAccountError(error);
  return data as UserProfile;
}
export async function signIn(email: string, password: string): Promise<Session> {
  const { data, error } = await getAccountSupabaseClient().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw toAccountError(error);
  if (!data.session) throw new AccountArchiveError('session_expired', 'Accesso non completato. Riprova.');
  return data.session;
}

export async function signUp(input: {
  email: string;
  password: string;
  username: string;
}, supabase: SupabaseClient = getAccountSupabaseClient()): Promise<{ session: Session | null }> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        username: normalizeUsername(input.username),
        terms_accepted: true,
        privacy_accepted: true,
        raw_gpx_research_consent: true,
      },
    },
  });
  if (error) throw toAccountError(error);
  return { session: data.session };
}

export async function signOut(): Promise<void> {
  const { error } = await getAccountSupabaseClient().auth.signOut();
  if (error) throw toAccountError(error);
}

export async function loadArchiveData(
  supabase: SupabaseClient = getAccountSupabaseClient(),
): Promise<ArchiveData> {
  const [configResult, profileResult, tracksResult] = await Promise.all([
    supabase.from('gpx_archive_config').select('*').eq('singleton_id', 1).single(),
    supabase.from('user_profiles').select('*').single(),
    supabase
      .from('user_gpx_tracks')
      .select(TRACK_COLUMNS)
      .eq('status', 'ready')
      .order('created_at', { ascending: false }),
  ]);

  const error = configResult.error ?? profileResult.error ?? tracksResult.error;
  if (error) throw toAccountError(error);

  return {
    config: configResult.data as ArchiveConfig,
    profile: profileResult.data as UserProfile,
    tracks: (tracksResult.data ?? []) as unknown as GpxTrack[],
  };
}

export async function downloadTrack(track: GpxTrack): Promise<Blob> {
  const { data, error } = await getAccountSupabaseClient().storage.from('user-gpx').download(track.storage_path);
  if (error) throw toAccountError(error);
  return data;
}

function isMissingStorageObject(error: unknown): boolean {
  const candidate = error as { statusCode?: string | number; status?: number; message?: string };
  return candidate?.status === 404
    || String(candidate?.statusCode) === '404'
    || /not found|does not exist/i.test(candidate?.message ?? '');
}

export async function deleteTrack(
  track: GpxTrack,
  supabase: SupabaseClient = getAccountSupabaseClient(),
): Promise<void> {
  const { error: storageError } = await supabase.storage.from('user-gpx').remove([track.storage_path]);
  if (storageError && !isMissingStorageObject(storageError)) throw toAccountError(storageError);

  const { error: metadataError } = await supabase.rpc('delete_my_gpx_track_metadata', { p_track_id: track.id });
  if (metadataError) {
    const normalized = toAccountError(metadataError);
    throw new AccountArchiveError(
      'partial_delete',
      'Il file è stato eliminato, ma la cancellazione dei metadati non è completa. Riprova per terminarla.',
      { cause: normalized, partial: true },
    );
  }
}
