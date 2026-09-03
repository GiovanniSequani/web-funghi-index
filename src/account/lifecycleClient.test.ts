import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  acceptCurrentContributorTerms,
  getAccountLifecyclePublicConfig,
  recordMyLegalNoticeSeen,
  recordMyMeaningfulActivity,
  refuseCurrentContributorTerms,
} from './lifecycleClient';
import {
  hasLifecycleFullAccess,
  LEGACY_LIFECYCLE_CONFIG,
  type AccountAccess,
  type AccountLifecyclePublicConfig,
} from './lifecycle';

const enabledConfig: AccountLifecyclePublicConfig = {
  api_available: true,
  lifecycle_enabled: true,
  current_terms_version: '0.2',
  current_privacy_version: '0.3',
  reaccept_days: 30,
};

const restrictedAccess: AccountAccess = {
  account_state: 'restricted',
  restriction_reason: 'terms_outdated',
  terms_version: '0.1',
  privacy_version: '0.2',
  current_terms_version: '0.2',
  current_privacy_version: '0.3',
  legal_notice_first_seen_at: null,
  legal_notice_privacy_version: null,
  legal_reaccept_deadline_at: '2026-10-01T00:00:00Z',
  last_meaningful_activity_at: null,
  inactivity_delete_after: null,
  full_access: false,
  needs_terms_action: true,
};

describe('account lifecycle contract', () => {
  it('usa il fallback legacy solo quando la RPC non esiste', async () => {
    const missing = { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'not found' } }) } as unknown as SupabaseClient;
    await expect(getAccountLifecyclePublicConfig(missing)).resolves.toEqual(LEGACY_LIFECYCLE_CONFIG);

    const network = { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: '503', message: 'network unavailable' } }) } as unknown as SupabaseClient;
    await expect(getAccountLifecyclePublicConfig(network)).rejects.toBeTruthy();
  });

  it('non concede accesso riservato senza full_access autorevole', () => {
    expect(hasLifecycleFullAccess(true, enabledConfig, null)).toBe(false);
    expect(hasLifecycleFullAccess(true, enabledConfig, restrictedAccess)).toBe(false);
    expect(hasLifecycleFullAccess(true, enabledConfig, { ...restrictedAccess, account_state: 'active', restriction_reason: null, full_access: true })).toBe(true);
    expect(hasLifecycleFullAccess(true, LEGACY_LIFECYCLE_CONFIG, null)).toBe(true);
    expect(hasLifecycleFullAccess(false, LEGACY_LIFECYCLE_CONFIG, null)).toBe(false);
  });

  it('invia versioni e source web alle RPC legali e registra solo attività esplicite', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: restrictedAccess, error: null });
    const supabase = { rpc } as unknown as SupabaseClient;

    await recordMyLegalNoticeSeen('0.2', '0.3', supabase);
    await acceptCurrentContributorTerms('0.2', '0.3', supabase);
    await refuseCurrentContributorTerms('0.2', '0.3', supabase);
    await recordMyMeaningfulActivity('account_action', supabase);

    const legalArgs = { p_terms_version: '0.2', p_privacy_version: '0.3', p_source: 'web' };
    expect(rpc).toHaveBeenNthCalledWith(1, 'record_my_legal_notice_seen', legalArgs);
    expect(rpc).toHaveBeenNthCalledWith(2, 'accept_current_contributor_terms', legalArgs);
    expect(rpc).toHaveBeenNthCalledWith(3, 'refuse_current_contributor_terms', legalArgs);
    expect(rpc).toHaveBeenNthCalledWith(4, 'record_my_meaningful_activity', { p_activity_kind: 'account_action' });
  });
});