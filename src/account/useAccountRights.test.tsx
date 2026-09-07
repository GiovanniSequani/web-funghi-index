/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AccountExportJob } from './rights';
import { useAccountRights } from './useAccountRights';

const mocks = vi.hoisted(() => ({
  loadLatest: vi.fn(),
  requestExport: vi.fn(),
  downloadExport: vi.fn(),
  requestDeletion: vi.fn(),
}));

vi.mock('./rightsClient', () => ({
  loadLatestAccountExport: (...args: unknown[]) => mocks.loadLatest(...args),
  requestMyDataExport: (...args: unknown[]) => mocks.requestExport(...args),
  downloadAccountExport: (...args: unknown[]) => mocks.downloadExport(...args),
  requestMyAccountDeletionVerification: (...args: unknown[]) => mocks.requestDeletion(...args),
}));

const pendingJob: AccountExportJob = {
  id: 'job-1', status: 'pending', storage_path: 'private/job.zip',
  requested_at: '2026-09-06T10:00:00Z', ready_at: null, expires_at: null,
  size_bytes: null, last_error_code: null, updated_at: '2026-09-06T10:00:00Z',
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useAccountRights', () => {
  it('ricarica il job RLS quando il login abilita l’area account', async () => {
    mocks.loadLatest.mockResolvedValue(pendingJob);
    const { result, rerender } = renderHook(
      ({ enabled }) => useAccountRights(enabled),
      { initialProps: { enabled: false } },
    );

    expect(mocks.loadLatest).not.toHaveBeenCalled();
    rerender({ enabled: true });

    await waitFor(() => expect(result.current.job).toEqual(pendingJob));
    expect(mocks.loadLatest).toHaveBeenCalledTimes(1);
  });
});
