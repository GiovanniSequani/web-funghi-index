/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountRightsPanel, getExportStatusCopy } from './AccountRightsPanel';
import type { AccountExportJob } from './rights';

const mocks = vi.hoisted(() => ({
  state: {
    job: null,
    loading: false,
    busy: null,
    available: true,
    error: null,
    deletionNotice: null,
    refresh: vi.fn(),
    requestExport: vi.fn(),
    downloadExport: vi.fn(),
    requestDeletion: vi.fn(),
  } as Record<string, unknown>,
}));

vi.mock('./useAccountRights', () => ({
  useAccountRights: () => mocks.state,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  Object.assign(mocks.state, {
    job: null,
    loading: false,
    busy: null,
    available: true,
    error: null,
    deletionNotice: null,
  });
});

const expired: AccountExportJob = {
  id: 'job-1',
  status: 'expired',
  storage_path: 'user/job.zip',
  requested_at: '2026-09-01T08:00:00Z',
  ready_at: '2026-09-01T09:00:00Z',
  expires_at: '2020-09-02T09:00:00Z',
  size_bytes: 1000,
  last_error_code: null,
  updated_at: '2026-09-02T09:00:00Z',
};

describe('AccountRightsPanel', () => {
  it('mantiene export ed eliminazione visibili per un account sospeso', () => {
    mocks.state.job = expired;
    render(<AccountRightsPanel accountState="restricted" />);
    expect(screen.getByText(/restano disponibili anche con account sospeso/)).toBeTruthy();
    expect(screen.getByText('Download scaduto')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Richiedi export/ })).toBeTruthy();
  });

  it('descrive deletion_pending senza simulare il completamento', () => {
    render(<AccountRightsPanel accountState="deletion_pending" />);
    expect(screen.getByText('Eliminazione in corso')).toBeTruthy();
    expect(screen.getByText(/non indica che il processo sia già completato/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Richiedi export/ })).toBeNull();
  });

  it('tratta un ready oltre scadenza come gap non scaricabile', () => {
    const copy = getExportStatusCopy({ ...expired, status: 'ready' });
    expect(copy.label).toBe('Download scaduto');
    expect(copy.tone).toBe('warning');
  });

  it('mostra chiaramente quando lo switch backend non è attivo', () => {
    mocks.state.available = false;
    render(<AccountRightsPanel accountState="active" />);
    expect(screen.getByText(/API di export e cancellazione non sono ancora attive/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Richiedi export/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
