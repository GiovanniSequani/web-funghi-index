/** @vitest-environment jsdom */
import React from 'react';
import type { Session } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AccountAccess } from './lifecycle';
import { useAccountLifecycle } from './useAccountLifecycle';

const access: AccountAccess = {
  account_state: 'active',
  restriction_reason: null,
  terms_version: '0.2',
  privacy_version: '0.3',
  current_terms_version: '0.2',
  current_privacy_version: '0.3',
  legal_notice_first_seen_at: null,
  legal_notice_privacy_version: null,
  legal_reaccept_deadline_at: null,
  last_meaningful_activity_at: '2026-09-01T08:00:00Z',
  inactivity_delete_after: null,
  full_access: true,
  needs_terms_action: false,
};

const getConfig = vi.fn();
const getAccess = vi.fn();
const recordActivity = vi.fn();

vi.mock('./lifecycleClient', () => ({
  getAccountLifecyclePublicConfig: (...args: unknown[]) => getConfig(...args),
  getMyAccountAccess: (...args: unknown[]) => getAccess(...args),
  recordMyMeaningfulActivity: (...args: unknown[]) => recordActivity(...args),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useAccountLifecycle', () => {
  it('ricontrolla una sessione già aperta al ritorno in foreground senza attività background', async () => {
    getConfig.mockResolvedValue({
      api_available: true,
      lifecycle_enabled: true,
      current_terms_version: '0.2',
      current_privacy_version: '0.3',
      reaccept_days: 30,
    });
    recordActivity.mockResolvedValue(access);
    const session = { user: { id: 'user-1' } } as unknown as Session;

    renderHook(() => useAccountLifecycle(session, false));
    await waitFor(() => expect(recordActivity).toHaveBeenCalledWith('foreground_session'));

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(recordActivity).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(recordActivity).toHaveBeenCalledTimes(2));
    expect(recordActivity).toHaveBeenLastCalledWith('foreground_session');
  });
});