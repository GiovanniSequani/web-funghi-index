/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountLifecyclePanel } from './AccountLifecyclePanel';
import type { AccountAccess, AccountLifecyclePublicConfig } from './lifecycle';

vi.mock('./AccountRightsPanel', () => ({
  AccountRightsPanel: ({ accountState }: { accountState: string }) => <div>Diritti {accountState}</div>,
}));

const config: AccountLifecyclePublicConfig = {
  api_available: true,
  lifecycle_enabled: true,
  current_terms_version: '0.2',
  current_privacy_version: '0.3',
  reaccept_days: 30,
};

const access: AccountAccess = {
  account_state: 'restricted',
  restriction_reason: 'terms_outdated',
  terms_version: '0.1',
  privacy_version: '0.2',
  current_terms_version: '0.2',
  current_privacy_version: '0.3',
  legal_notice_first_seen_at: null,
  legal_notice_privacy_version: null,
  legal_reaccept_deadline_at: null,
  last_meaningful_activity_at: null,
  inactivity_delete_after: null,
  full_access: false,
  needs_terms_action: true,
};

afterEach(cleanup);

function renderPanel(accountAccess: AccountAccess, notice = vi.fn().mockResolvedValue(undefined)) {
  render(<AccountLifecyclePanel
    config={config}
    access={accountAccess}
    loading={false}
    error={null}
    busy={false}
    onNoticeSeen={notice}
    onAccept={vi.fn().mockResolvedValue(undefined)}
    onRefuse={vi.fn().mockResolvedValue(undefined)}
    onRefresh={vi.fn().mockResolvedValue(undefined)}
    onSignOut={vi.fn().mockResolvedValue(undefined)}
  />);
  return notice;
}

describe('AccountLifecyclePanel', () => {
  it('registra la visualizzazione solo dopo che la schermata documenti è renderizzata', async () => {
    const notice = renderPanel(access);
    expect(screen.getByText('È richiesta una nuova accettazione')).toBeTruthy();
    await waitFor(() => expect(notice).toHaveBeenCalledTimes(1));
  });

  it('non presenta la riattivazione per un account in eliminazione', () => {
    renderPanel({
      ...access,
      account_state: 'deletion_pending',
      restriction_reason: null,
      needs_terms_action: false,
    });
    expect(screen.getByText('Account in eliminazione')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Accetta e riattiva' })).toBeNull();
    expect(screen.getByText('Diritti deletion_pending')).toBeTruthy();
  });
});