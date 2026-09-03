import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { AccountExportJob } from './rights';
import {
  confirmAccountDeletion,
  downloadAccountExport,
  loadLatestAccountExport,
  requestExternalAccountDeletion,
  requestMyAccountDeletionVerification,
  requestMyDataExport,
} from './rightsClient';

const job: AccountExportJob = {
  id: 'job-1',
  status: 'ready',
  storage_path: 'user-1/job-1.zip',
  requested_at: '2026-09-01T08:00:00Z',
  ready_at: '2026-09-01T08:10:00Z',
  expires_at: '2099-09-02T08:10:00Z',
  size_bytes: 4096,
  last_error_code: null,
  updated_at: '2026-09-01T08:10:00Z',
};

describe('account rights client', () => {
  it('legge soltanto il job più recente protetto da RLS', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [job], error: null });
    const order = vi.fn(() => ({ limit }));
    const select = vi.fn(() => ({ order }));
    const from = vi.fn(() => ({ select }));
    const supabase = { from } as unknown as SupabaseClient;

    await expect(loadLatestAccountExport(supabase)).resolves.toEqual(job);
    expect(from).toHaveBeenCalledWith('account_export_jobs');
    expect(order).toHaveBeenCalledWith('requested_at', { ascending: false });
    expect(limit).toHaveBeenCalledWith(1);
  });

  it('richiede export e verifica cancellazione usando solo le RPC pubblicate', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'request_my_data_export') return { data: job, error: null };
      return { data: { accepted: true, expires_in_minutes: 2880 }, error: null };
    });
    const supabase = { rpc } as unknown as SupabaseClient;

    await expect(requestMyDataExport(supabase)).resolves.toEqual(job);
    await expect(requestMyAccountDeletionVerification(supabase)).resolves.toEqual({
      accepted: true,
      expires_in_minutes: 2880,
    });
    expect(rpc).toHaveBeenNthCalledWith(1, 'request_my_data_export');
    expect(rpc).toHaveBeenNthCalledWith(2, 'request_my_account_deletion_verification');
  });

  it('scarica dal bucket privato senza creare URL firmati', async () => {
    const blob = new Blob(['zip'], { type: 'application/zip' });
    const download = vi.fn().mockResolvedValue({ data: blob, error: null });
    const from = vi.fn(() => ({ download }));
    const supabase = { storage: { from } } as unknown as SupabaseClient;

    await expect(downloadAccountExport(job, supabase)).resolves.toBe(blob);
    expect(from).toHaveBeenCalledWith('user-data-exports');
    expect(download).toHaveBeenCalledWith(job.storage_path);
  });

  it('non contatta Storage per un export scaduto', async () => {
    const from = vi.fn();
    const supabase = { storage: { from } } as unknown as SupabaseClient;
    await expect(downloadAccountExport({ ...job, expires_at: '2020-01-01T00:00:00Z' }, supabase))
      .rejects.toMatchObject({ code: 'export_expired' });
    expect(from).not.toHaveBeenCalled();
  });

  it('usa il token soltanto come argomento della conferma e la richiesta esterna resta generica', async () => {
    const rpc = vi.fn(async (name: string) => name === 'confirm_account_deletion'
      ? { data: { confirmed: true, job_id: 'delete-1' }, error: null }
      : { data: { accepted: true }, error: null });
    const supabase = { rpc } as unknown as SupabaseClient;

    await requestExternalAccountDeletion('  user@example.test  ', supabase);
    await confirmAccountDeletion('a'.repeat(64), supabase);

    expect(rpc).toHaveBeenNthCalledWith(1, 'request_external_account_deletion', { p_email: 'user@example.test' });
    expect(rpc).toHaveBeenNthCalledWith(2, 'confirm_account_deletion', { p_verification_token: 'a'.repeat(64) });
  });
});