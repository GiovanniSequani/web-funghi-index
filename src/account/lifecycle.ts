export type AccountState = 'active' | 'restricted' | 'deletion_pending';
export type RestrictionReason = 'terms_outdated' | 'terms_refused' | 'inactive' | 'security';
export type MeaningfulActivityKind = 'interactive_login' | 'foreground_session' | 'account_action';

export type AccountLifecyclePublicConfig = {
  api_available: boolean;
  lifecycle_enabled: boolean;
  current_terms_version: string | null;
  current_privacy_version: string | null;
  reaccept_days: number;
};

export type AccountAccess = {
  account_state: AccountState;
  restriction_reason: RestrictionReason | null;
  terms_version: string | null;
  privacy_version: string | null;
  current_terms_version: string;
  current_privacy_version: string;
  legal_notice_first_seen_at: string | null;
  legal_notice_privacy_version: string | null;
  legal_reaccept_deadline_at: string | null;
  last_meaningful_activity_at: string | null;
  inactivity_delete_after: string | null;
  full_access: boolean;
  needs_terms_action: boolean;
};

export const LEGACY_LIFECYCLE_CONFIG: AccountLifecyclePublicConfig = {
  api_available: false,
  lifecycle_enabled: false,
  current_terms_version: null,
  current_privacy_version: null,
  reaccept_days: 365,
};

export function hasLifecycleFullAccess(
  authenticated: boolean,
  config: AccountLifecyclePublicConfig | null,
  access: AccountAccess | null,
): boolean {
  if (!authenticated || !config) return false;
  if (!config.api_available || !config.lifecycle_enabled) return true;
  return access?.full_access === true;
}

export function canChangeLegalAcceptance(access: AccountAccess | null): boolean {
  return Boolean(
    access
    && access.account_state !== 'deletion_pending'
    && access.restriction_reason !== 'security',
  );
}