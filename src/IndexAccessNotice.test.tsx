/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AccountAccess } from './account/lifecycle';
import { IndexAccessNotice, getIndexAccessNoticeCopy } from './IndexAccessNotice';

const restricted: AccountAccess = {
  account_state: 'restricted', restriction_reason: 'terms_outdated',
  terms_version: '0.9', privacy_version: '1.0', current_terms_version: '1.0', current_privacy_version: '1.0',
  legal_notice_first_seen_at: null, legal_notice_privacy_version: null, legal_reaccept_deadline_at: null,
  last_meaningful_activity_at: null, inactivity_delete_after: null, full_access: false, needs_terms_action: true,
};

afterEach(cleanup);

describe('IndexAccessNotice', () => {
  it('indica login e registrazione ai visitatori', () => {
    render(<IndexAccessNotice authenticated={false} access={null} onClose={() => undefined} onAction={() => undefined} />);
    expect(screen.getByRole('heading').textContent).toContain('Accedi');
    expect(screen.getByRole('button', { name: /Accedi o registrati/ })).toBeTruthy();
  });

  it('indirizza gli account con termini obsoleti alla riaccettazione', () => {
    expect(getIndexAccessNoticeCopy(true, restricted)).toEqual(expect.objectContaining({
      title: 'Aggiorna i documenti del tuo account',
      action: 'Leggi e accetta i documenti',
    }));
  });
});
