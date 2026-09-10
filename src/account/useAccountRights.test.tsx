/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AccountExportJob } from './rights';

const mocks = vi.hoisted(() => ({
  loadLatestAccountExport: vi.fn(),
  requestMyDataExport: vi.fn(),
  downloadAccountExport: vi.fn(),
  requestMyAccountDeletionVerification: vi.fn(),
}));

vi.mock('./rightsClient', () => mocks);

import { useAccountRights } from './useAccountRights';

const pendingJob: AccountExportJob = {
  id: 'job-1',
  status: 'pending',
  storage_path: '',
  requested_at: '2026-09-10T10:00:00Z',
  ready_at: null,
  expires_at: null,
  size_bytes: null,
  last_error_code: null,
  updated_at: '2026-09-10T10:00:00Z',
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('polling export account', () => {
  it('ricarica il job RLS quando il login abilita l area account', async () => {
    mocks.loadLatestAccountExport.mockResolvedValue(pendingJob);
    const { result, rerender } = renderHook(
      ({ enabled }) => useAccountRights(enabled),
      { initialProps: { enabled: false } },
    );
    expect(mocks.loadLatestAccountExport).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.job).toEqual(pendingJob));
    expect(mocks.loadLatestAccountExport).toHaveBeenCalledTimes(1);
  });

  it('usa backoff e non sovrappone richieste', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    mocks.loadLatestAccountExport.mockResolvedValue(pendingJob);
    const { result } = renderHook(() => useAccountRights(true));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(mocks.loadLatestAccountExport).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(14_999); });
    expect(mocks.loadLatestAccountExport).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(mocks.loadLatestAccountExport).toHaveBeenCalledTimes(2);
    expect(result.current.pollingPaused).toBe(false);
  });

  it('sospende il polling offline e riparte al ritorno della rete', async () => {
    vi.useFakeTimers();
    let online = true;
    vi.spyOn(window.navigator, 'onLine', 'get').mockImplementation(() => online);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    mocks.loadLatestAccountExport.mockResolvedValue(pendingJob);
    const { result } = renderHook(() => useAccountRights(true));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(mocks.loadLatestAccountExport).toHaveBeenCalledTimes(1);

    online = false;
    act(() => window.dispatchEvent(new Event('offline')));
    expect(result.current.pollingPaused).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(mocks.loadLatestAccountExport).toHaveBeenCalledTimes(1);

    online = true;
    act(() => window.dispatchEvent(new Event('online')));
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(mocks.loadLatestAccountExport).toHaveBeenCalledTimes(2);
  });
});
