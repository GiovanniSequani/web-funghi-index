import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { deleteTrack, loadArchiveData, signUp } from './client';
import type { GpxTrack } from './types';

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
  ready_at: '2026-08-06T10:00:00Z',
  created_at: '2026-08-06T10:00:00Z',
};

describe('account Supabase client', () => {
  it('invia tutti i consensi obbligatori e lo username lowercase al signup', async () => {
    const signUpMock = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
    const supabase = { auth: { signUp: signUpMock } } as unknown as SupabaseClient;

    await signUp({ email: 'mario@example.test', password: 'password', username: 'Mario_Rossi' }, supabase);

    expect(signUpMock).toHaveBeenCalledWith(expect.objectContaining({
      options: {
        data: {
          username: 'mario_rossi',
          terms_accepted: true,
          privacy_accepted: true,
          raw_gpx_research_consent: true,
        },
      },
    }));
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
});
