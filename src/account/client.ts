import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabasePublicConfig } from '../pointDetails/supabaseConfig';
import { AccountArchiveError, type ArchiveConfig, type ArchiveData, type GpxMushroomMarker, type GpxTrack, type PreparedGpxUpload, type ReserveTrackResult, type UserProfile } from './types';
import { normalizeTrackName, normalizeUsername, toAccountError, validateTrackName } from './validation';
import { getAuthCallbackUrl } from './authRedirects';

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
  'trim_start_point_index',
  'trim_end_point_index',
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
      emailRedirectTo: getAuthCallbackUrl('/auth/confirm'),
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

export async function requestPasswordReset(
  email: string,
  supabase: SupabaseClient = getAccountSupabaseClient(),
): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: getAuthCallbackUrl('/auth/recovery'),
  });
  if (error) throw toAccountError(error);
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

async function rollbackReservation(reservation: ReserveTrackResult, supabase: SupabaseClient, removeObject: boolean) {
  try {
    if (removeObject) {
      const { error } = await supabase.storage.from('user-gpx').remove([reservation.storage_path]);
      if (error && !isMissingStorageObject(error)) return false;
    }
    const { error } = await supabase.rpc('delete_my_gpx_track_metadata', { p_track_id: reservation.id });
    return !error;
  } catch { return false; }
}

export async function uploadPreparedTrack(
  input: { displayName: string; originalFilename: string; prepared: PreparedGpxUpload },
  supabase: SupabaseClient = getAccountSupabaseClient(),
): Promise<GpxTrack> {
  const prepared = input.prepared;
  const nameError = validateTrackName(input.displayName);
  if (nameError) throw new AccountArchiveError('invalid_track_name', nameError);
  const displayName = normalizeTrackName(input.displayName);
  const { data, error: reserveError } = await supabase.rpc('reserve_my_gpx_track', {
    p_display_name: displayName,
    p_original_filename: input.originalFilename,
    p_compressed_size_bytes: prepared.compressedSizeBytes,
    p_content_sha256: prepared.contentSha256,
    p_uncompressed_size_bytes: prepared.uncompressedSizeBytes,
    p_started_at: prepared.startedAt,
    p_ended_at: prepared.endedAt,
    p_point_count: prepared.pointCount,
    p_distance_m: prepared.distanceM,
    p_bbox: prepared.bbox,
  });
  if (reserveError) throw toAccountError(reserveError);
  const reservation = data as ReserveTrackResult;
  if (!reservation?.id || !reservation.storage_path) throw new AccountArchiveError('unknown', 'Il server non ha restituito una prenotazione valida.');
  const { error: uploadError } = await supabase.storage.from('user-gpx').upload(
    reservation.storage_path, prepared.bytes.slice().buffer, { contentType: 'application/gzip', upsert: false },
  );
  if (uploadError) {
    const released = await rollbackReservation(reservation, supabase, true);
    throw new AccountArchiveError('upload_failed', released ? 'Caricamento non riuscito. La prenotazione è stata annullata: riprova.' : 'Caricamento non riuscito e la prenotazione non è stata liberata. Riprova più tardi.', { cause: uploadError, partial: !released });
  }
  const { data: finalized, error: finalizeError } = await supabase.rpc('finalize_my_gpx_track', { p_track_id: reservation.id });
  if (finalizeError) {
    const released = await rollbackReservation(reservation, supabase, true);
    throw new AccountArchiveError('finalize_failed', released ? 'Il caricamento non è stato finalizzato ed è stato annullato. Riprova.' : 'Il file è stato caricato, ma la finalizzazione non è completa. Aggiorna l’archivio prima di riprovare.', { cause: finalizeError, partial: !released });
  }
  return finalized as GpxTrack;
}
export async function renameTrack(
  track: GpxTrack,
  newName: string,
  supabase: SupabaseClient = getAccountSupabaseClient(),
): Promise<GpxTrack> {
  const nameError = validateTrackName(newName);
  if (nameError) throw new AccountArchiveError('invalid_track_name', nameError);
  const { data, error } = await supabase.rpc('rename_my_gpx_track', {
    p_track_id: track.id,
    p_new_name: normalizeTrackName(newName),
  });
  if (error) throw toAccountError(error);
  if (!data) throw new AccountArchiveError('track_not_found', 'Traccia non trovata. Aggiorna l’archivio e riprova.');
  return data as GpxTrack;
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

export async function loadTrackMarkers(trackId: string, supabase: SupabaseClient = getAccountSupabaseClient()): Promise<GpxMushroomMarker[]> {
  const { data, error } = await supabase.from('user_gpx_mushroom_markers').select('*').eq('track_id', trackId).order('track_point_index');
  if (error) throw toAccountError(error);
  return (data ?? []) as GpxMushroomMarker[];
}

export async function setTrackTrim(trackId: string, start: number | null, end: number | null, supabase: SupabaseClient = getAccountSupabaseClient()): Promise<GpxTrack> {
  const { data, error } = await supabase.rpc('set_my_gpx_track_trim', { p_track_id: trackId, p_trim_start_point_index: start, p_trim_end_point_index: end });
  if (error) throw toAccountError(error);
  if (!data) throw new AccountArchiveError('track_not_found', 'Traccia non trovata. Aggiorna l archivio e riprova.');
  return data as GpxTrack;
}

export async function saveTrackMarker(marker: GpxMushroomMarker, supabase: SupabaseClient = getAccountSupabaseClient()): Promise<GpxMushroomMarker> {
  const { data, error } = await supabase.rpc('save_my_gpx_mushroom_marker', { p_track_id: marker.track_id, p_track_point_index: marker.track_point_index, p_latitude: marker.latitude, p_longitude: marker.longitude, p_species: marker.species, p_count: marker.count });
  if (error) throw toAccountError(error);
  return data as GpxMushroomMarker;
}

export async function deleteTrackMarker(trackId: string, pointIndex: number, species: GpxMushroomMarker['species'], supabase: SupabaseClient = getAccountSupabaseClient()): Promise<void> {
  const { error } = await supabase.rpc('delete_my_gpx_mushroom_marker', { p_track_id: trackId, p_track_point_index: pointIndex, p_species: species });
  if (error) throw toAccountError(error);
}
