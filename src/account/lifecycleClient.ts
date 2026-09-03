import type { SupabaseClient } from '@supabase/supabase-js';
import { getAccountSupabaseClient } from './client';
import {
  LEGACY_LIFECYCLE_CONFIG,
  type AccountAccess,
  type AccountLifecyclePublicConfig,
  type MeaningfulActivityKind,
} from './lifecycle';
import { toAccountError } from './validation';

type RpcError = { code?: string; message?: string; details?: string };

function isMissingLifecycleApi(error: unknown): boolean {
  const candidate = error as RpcError;
  return candidate?.code === 'PGRST202'
    || candidate?.code === '42883'
    || /function .* does not exist|could not find the function|schema cache/i.test(
      (candidate?.message ?? '') + ' ' + (candidate?.details ?? ''),
    );
}

function requireAccess(data: unknown): AccountAccess {
  if (!data || typeof data !== 'object') throw new Error('Risposta lifecycle account non valida.');
  return data as AccountAccess;
}

export async function getAccountLifecyclePublicConfig(
  supabase: SupabaseClient = getAccountSupabaseClient(),
): Promise<AccountLifecyclePublicConfig> {
  const { data, error } = await supabase.rpc('get_account_lifecycle_public_config');
  if (error) {
    if (isMissingLifecycleApi(error)) return LEGACY_LIFECYCLE_CONFIG;
    throw toAccountError(error);
  }
  const config = data as Partial<AccountLifecyclePublicConfig> | null;
  if (!config || typeof config.lifecycle_enabled !== 'boolean') {
    throw new Error('Configurazione lifecycle account non valida.');
  }
  return {
    api_available: true,
    lifecycle_enabled: config.lifecycle_enabled,
    current_terms_version: typeof config.current_terms_version === 'string' ? config.current_terms_version : null,
    current_privacy_version: typeof config.current_privacy_version === 'string' ? config.current_privacy_version : null,
    reaccept_days: typeof config.reaccept_days === 'number' ? config.reaccept_days : 365,
  };
}

export async function getMyAccountAccess(
  supabase: SupabaseClient = getAccountSupabaseClient(),
): Promise<AccountAccess> {
  const { data, error } = await supabase.rpc('get_my_account_access');
  if (error) throw toAccountError(error);
  return requireAccess(data);
}

export async function recordMyLegalNoticeSeen(
  termsVersion: string,
  privacyVersion: string,
  supabase: SupabaseClient = getAccountSupabaseClient(),
): Promise<AccountAccess> {
  const { data, error } = await supabase.rpc('record_my_legal_notice_seen', {
    p_terms_version: termsVersion,
    p_privacy_version: privacyVersion,
    p_source: 'web',
  });
  if (error) throw toAccountError(error);
  return requireAccess(data);
}

export async function acceptCurrentContributorTerms(
  termsVersion: string,
  privacyVersion: string,
  supabase: SupabaseClient = getAccountSupabaseClient(),
): Promise<AccountAccess> {
  const { data, error } = await supabase.rpc('accept_current_contributor_terms', {
    p_terms_version: termsVersion,
    p_privacy_version: privacyVersion,
    p_source: 'web',
  });
  if (error) throw toAccountError(error);
  return requireAccess(data);
}

export async function refuseCurrentContributorTerms(
  termsVersion: string,
  privacyVersion: string,
  supabase: SupabaseClient = getAccountSupabaseClient(),
): Promise<AccountAccess> {
  const { data, error } = await supabase.rpc('refuse_current_contributor_terms', {
    p_terms_version: termsVersion,
    p_privacy_version: privacyVersion,
    p_source: 'web',
  });
  if (error) throw toAccountError(error);
  return requireAccess(data);
}

export async function recordMyMeaningfulActivity(
  activityKind: MeaningfulActivityKind,
  supabase: SupabaseClient = getAccountSupabaseClient(),
): Promise<AccountAccess> {
  const { data, error } = await supabase.rpc('record_my_meaningful_activity', {
    p_activity_kind: activityKind,
  });
  if (error) throw toAccountError(error);
  return requireAccess(data);
}