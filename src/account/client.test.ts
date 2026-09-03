import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { deleteTrack, deleteTrackMarker, loadArchiveData, saveTrackMarker, setTrackTrim, renameTrack, requestPasswordReset, signUp, uploadPreparedTrack } from './client';
import type { GpxTrack, PreparedGpxUpload } from './types';
import { LEGACY_LIFECYCLE_CONFIG } from './lifecycle';

const track: GpxTrack = {
  id: '9656ae68-e657-42b0-8f15-c956b6c4d55d',
  storage_path: 'user-id/9656ae68-e657-42b0-8f15-c956b6c4d55d.gpx.gz',
  status: 'ready',
  display_name: 'Bosco',
  original_filename: 'bosco.gpx',
  compressed_size_bytes: 1024,
  uncompressed_size_bytes: 4096,
  started_at: null,
  ended_at: null,
  point_count: null,
  distance_m: null,
  trim_start_point_index: null,
  trim_end_point_index: null,
  ready_at: '2026-08-06T10:00:00Z',
  created_at: '2026-08-06T10:00:00Z',
};

describe('account Supabase client', () => {
  it('invia tutti i consensi obbligatori e lo username lowercase al signup', async () => {
    const signUpMock = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
    const supabase = { auth: { signUp: signUpMock } } as unknown as SupabaseClient;

    await signUp({ email: 'mario@example.test', password: 'password', username: 'Mario_Rossi', lifecycleConfig: LEGACY_LIFECYCLE_CONFIG }, supabase);

    expect(signUpMock).toHaveBeenCalledWith(expect.objectContaining({
      options: {
        emailRedirectTo: 'http://localhost:5173/auth/confirm',
        data: {
          username: 'mario_rossi',
          terms_accepted: true,
          privacy_accepted: true,
          raw_gpx_research_consent: true,
        },
      },
    }));
  });

  it('usa le versioni lifecycle correnti nel signup senza consenso ricerca legacy', async () => {
    const signUpMock = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
    const supabase = { auth: { signUp: signUpMock } } as unknown as SupabaseClient;

    await signUp({
      email: 'mario@example.test',
      password: 'password',
      username: 'Mario_Rossi',
      lifecycleConfig: {
        api_available: true,
        lifecycle_enabled: true,
        current_terms_version: '0.2',
        current_privacy_version: '0.3',
        reaccept_days: 30,
      },
    }, supabase);

    expect(signUpMock).toHaveBeenCalledWith(expect.objectContaining({
      options: {
        emailRedirectTo: 'http://localhost:5173/auth/confirm',
        data: {
          username: 'mario_rossi',
          terms_accepted: true,
          privacy_acknowledged: true,
          terms_version: '0.2',
          privacy_version: '0.3',
          terms_acceptance_source: 'web',
        },
      },
    }));
  });

  it('passa sempre il callback esplicito al recupero password', async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: null });
    const supabase = { auth: { resetPasswordForEmail } } as unknown as SupabaseClient;

    await requestPasswordReset('  mario@example.test  ', supabase);

    expect(resetPasswordForEmail).toHaveBeenCalledWith('mario@example.test', {
      redirectTo: 'http://localhost:5173/auth/recovery',
    });
  });
  it('cancella prima Storage e poi i metadati tramite RPC', async () => {
    const order: string[] = [];
    const remove = vi.fn().mockImplementation(async () => {
      order.push('storage');
      return { error: null };
    });
    const rpc = vi.fn().mockImplementation(async () => {
      order.push('metadata');
      return { error: null };
    });
    const supabase = {
      storage: { from: vi.fn(() => ({ remove })) },
      rpc,
    } as unknown as SupabaseClient;

    await deleteTrack(track, supabase);

    expect(remove).toHaveBeenCalledWith([track.storage_path]);
    expect(rpc).toHaveBeenCalledWith('delete_my_gpx_track_metadata', { p_track_id: track.id });
    expect(order).toEqual(['storage', 'metadata']);
  });

  it('se la RPC fallisce segnala una cancellazione parziale ritentabile', async () => {
    const supabase = {
      storage: { from: vi.fn(() => ({ remove: vi.fn().mockResolvedValue({ error: null }) })) },
      rpc: vi.fn().mockResolvedValue({ error: { message: 'metadata unavailable' } }),
    } as unknown as SupabaseClient;

    await expect(deleteTrack(track, supabase)).rejects.toMatchObject({
      code: 'partial_delete',
      partial: true,
    });
  });
  it('legge i limiti dal singleton e filtra esclusivamente le tracce ready', async () => {
    const readyFilter = vi.fn();
    const from = vi.fn((table: string) => {
      if (table === 'gpx_archive_config') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { singleton_id: 1, max_tracks_per_user: 7 }, error: null }) }) }) };
      }
      if (table === 'user_profiles') {
        return { select: () => ({ single: async () => ({ data: { user_id: 'user-id', username: 'mario' }, error: null }) }) };
      }
      return {
        select: () => ({
          eq: (column: string, value: string) => {
            readyFilter(column, value);
            return { order: async () => ({ data: [track], error: null }) };
          },
        }),
      };
    });
    const supabase = { from } as unknown as SupabaseClient;

    const result = await loadArchiveData(supabase);

    expect(from).toHaveBeenCalledWith('gpx_archive_config');
    expect(readyFilter).toHaveBeenCalledWith('status', 'ready');
    expect(result.config.max_tracks_per_user).toBe(7);
    expect(result.tracks).toEqual([track]);
  });
  it('prenota, carica senza upsert e finalizza la traccia', async () => {
    const calls: string[] = [];
    const rpc = vi.fn(async (name: string) => {
      calls.push(name);
      return name === 'reserve_my_gpx_track'
        ? { data: { id: track.id, storage_path: track.storage_path }, error: null }
        : { data: track, error: null };
    });
    const upload = vi.fn(async () => { calls.push('storage.upload'); return { error: null }; });
    const supabase = { rpc, storage: { from: vi.fn(() => ({ upload })) } } as unknown as SupabaseClient;
    const prepared: PreparedGpxUpload = {
      bytes: new Uint8Array([1, 2, 3]), compressedSizeBytes: 3, uncompressedSizeBytes: 10,
      contentSha256: 'a'.repeat(64), startedAt: null, endedAt: null, pointCount: 2,
      distanceM: 12, bbox: { west: 11, south: 46, east: 11.1, north: 46.1 },
      suggestedName: 'Bosco', mapData: { lines: { type: 'FeatureCollection', features: [] }, findings: { type: 'FeatureCollection', features: [] }, start: [0, 0], end: [0, 0], bbox: [0, 0, 0, 0], porciniCount: 0, finferliCount: 0, rawPointCount: 0, trackPoints: [], trackSegments: [], usesTrackPoints: true },
    };
    await uploadPreparedTrack({ displayName: 'Bosco', originalFilename: 'bosco.gpx', prepared }, supabase);
    expect(calls).toEqual(['reserve_my_gpx_track', 'storage.upload', 'finalize_my_gpx_track']);
    expect(upload).toHaveBeenCalledWith(track.storage_path, expect.any(ArrayBuffer), { contentType: 'application/gzip', upsert: false });
  });
  it('rinomina solo i metadati tramite RPC senza modificare il path Storage', async () => {
    const renamed = { ...track, display_name: 'Bosco serale' };
    const rpc = vi.fn().mockResolvedValue({ data: renamed, error: null });
    const supabase = { rpc } as unknown as SupabaseClient;

    const result = await renameTrack(track, '  Bosco serale  ', supabase);

    expect(rpc).toHaveBeenCalledWith('rename_my_gpx_track', {
      p_track_id: track.id,
      p_new_name: 'Bosco serale',
    });
    expect(result.storage_path).toBe(track.storage_path);
    expect(result.display_name).toBe('Bosco serale');
  });

  it('rifiuta nomi non validi prima di chiamare la RPC', async () => {
    const rpc = vi.fn();
    const supabase = { rpc } as unknown as SupabaseClient;
    await expect(renameTrack(track, 'cartella/bosco', supabase)).rejects.toMatchObject({ code: 'invalid_track_name' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('usa le RPC del contratto per trim e marker senza modificare Storage', async () => {
    const marker = { track_id: track.id, track_point_index: 7, latitude: 46.1, longitude: 11.2, species: 'porcini' as const, count: 3 };
    const trimmed = { ...track, trim_start_point_index: 2, trim_end_point_index: 8 };
    const rpc = vi.fn(async (name: string) => {
      if (name === 'set_my_gpx_track_trim') return { data: trimmed, error: null };
      if (name === 'save_my_gpx_mushroom_marker') return { data: marker, error: null };
      return { data: null, error: null };
    });
    const supabase = { rpc } as unknown as SupabaseClient;

    await setTrackTrim(track.id, 2, 8, supabase);
    await saveTrackMarker(marker, supabase);
    await deleteTrackMarker(track.id, 7, 'porcini', supabase);

    expect(rpc).toHaveBeenNthCalledWith(1, 'set_my_gpx_track_trim', {
      p_track_id: track.id,
      p_trim_start_point_index: 2,
      p_trim_end_point_index: 8,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'save_my_gpx_mushroom_marker', {
      p_track_id: track.id,
      p_track_point_index: 7,
      p_latitude: 46.1,
      p_longitude: 11.2,
      p_species: 'porcini',
      p_count: 3,
    });
    expect(rpc).toHaveBeenNthCalledWith(3, 'delete_my_gpx_mushroom_marker', {
      p_track_id: track.id,
      p_track_point_index: 7,
      p_species: 'porcini',
    });
  });
});
