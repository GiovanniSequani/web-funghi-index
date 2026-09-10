import React from 'react';
import {
  downloadAccountExport,
  loadLatestAccountExport,
  requestMyAccountDeletionVerification,
  requestMyDataExport,
} from './rightsClient';
import type { AccountExportJob, DeletionVerificationResponse } from './rights';
import { isExportDownloadable } from './rights';
import { toAccountError } from './validation';
import { AccountArchiveError } from './types';
import { backoffDelay, browserIsOnline, retryAfterFromError } from '../networkRetry';

const EXPORT_POLL_MAX_ATTEMPTS = 7;
const EXPORT_POLL_BASE_DELAY_MS = 15_000;
const EXPORT_POLL_MAX_DELAY_MS = 120_000;

export type AccountRightsState = {
  job: AccountExportJob | null;
  loading: boolean;
  busy: 'request_export' | 'download' | 'request_deletion' | null;
  available: boolean | null;
  error: string | null;
  deletionNotice: DeletionVerificationResponse | null;
  pollingPaused: boolean;
  refresh: () => Promise<void>;
  requestExport: () => Promise<void>;
  downloadExport: () => Promise<void>;
  requestDeletion: () => Promise<void>;
};

function saveBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'funghitracker-export.zip';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function useAccountRights(enabled: boolean): AccountRightsState {
  const [job, setJob] = React.useState<AccountExportJob | null>(null);
  const [loading, setLoading] = React.useState(enabled);
  const [busy, setBusy] = React.useState<AccountRightsState['busy']>(null);
  const [available, setAvailable] = React.useState<boolean | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [deletionNotice, setDeletionNotice] = React.useState<DeletionVerificationResponse | null>(null);
  const [pollAttempt, setPollAttempt] = React.useState(0);
  const [online, setOnline] = React.useState(browserIsOnline);
  const sequenceRef = React.useRef(0);
  const inFlightRef = React.useRef(false);
  const retryAfterRef = React.useRef<number | null>(null);

  const loadJob = React.useCallback(async (automatic: boolean) => {
    if (!enabled || inFlightRef.current) return;
    inFlightRef.current = true;
    const sequence = ++sequenceRef.current;
    setLoading(true);
    setError(null);
    try {
      const nextJob = await loadLatestAccountExport();
      if (sequence !== sequenceRef.current) return;
      setJob(nextJob);
      setAvailable(true);
      retryAfterRef.current = null;
      setPollAttempt((current) => automatic ? current + 1 : 0);
    } catch (cause) {
      if (sequence !== sequenceRef.current) return;
      retryAfterRef.current = retryAfterFromError(cause);
      const normalized = toAccountError(cause);
      if (normalized.code === 'rights_unavailable') setAvailable(false);
      setError(normalized.message);
      setPollAttempt((current) => automatic ? current + 1 : 0);
    } finally {
      if (sequence === sequenceRef.current) setLoading(false);
      inFlightRef.current = false;
    }
  }, [enabled]);

  const refresh = React.useCallback(async () => {
    retryAfterRef.current = null;
    setPollAttempt(0);
    await loadJob(false);
  }, [loadJob]);

  React.useEffect(() => {
    const updateOnline = () => setOnline(browserIsOnline());
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  React.useEffect(() => {
    if (!enabled) {
      sequenceRef.current += 1;
      setJob(null);
      setLoading(false);
      setBusy(null);
      setAvailable(null);
      setError(null);
      setDeletionNotice(null);
      setPollAttempt(0);
      retryAfterRef.current = null;
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  React.useEffect(() => {
    if (!enabled || !online || !job || !['pending', 'building', 'retry'].includes(job.status)
      || pollAttempt >= EXPORT_POLL_MAX_ATTEMPTS) return;
    const delay = backoffDelay(pollAttempt, {
      baseDelayMs: EXPORT_POLL_BASE_DELAY_MS,
      maxDelayMs: EXPORT_POLL_MAX_DELAY_MS,
    }, retryAfterRef.current);
    const timer = window.setTimeout(() => void loadJob(true), delay);
    return () => window.clearTimeout(timer);
  }, [enabled, job, loadJob, online, pollAttempt]);

  const requestExport = React.useCallback(async () => {
    setBusy('request_export');
    setError(null);
    try {
      const nextJob = await requestMyDataExport();
      setJob(nextJob);
      setAvailable(true);
      setPollAttempt(0);
      retryAfterRef.current = null;
    } catch (cause) {
      const normalized = toAccountError(cause);
      if (normalized.code === 'rights_unavailable') setAvailable(false);
      setError(normalized.message);
      throw normalized;
    } finally {
      setBusy(null);
    }
  }, []);

  const downloadExport = React.useCallback(async () => {
    if (!job || !isExportDownloadable(job)) {
      const normalized = new AccountArchiveError('export_expired', 'Questo export non è più disponibile. Richiedine uno nuovo.');
      setError(normalized.message);
      throw normalized;
    }
    setBusy('download');
    setError(null);
    try {
      saveBlob(await downloadAccountExport(job));
    } catch (cause) {
      const normalized = toAccountError(cause);
      setError(normalized.message);
      throw normalized;
    } finally {
      setBusy(null);
    }
  }, [job]);

  const requestDeletion = React.useCallback(async () => {
    setBusy('request_deletion');
    setError(null);
    try {
      const result = await requestMyAccountDeletionVerification();
      setDeletionNotice(result);
      setAvailable(true);
    } catch (cause) {
      const normalized = toAccountError(cause);
      if (normalized.code === 'deletion_rate_limited') {
        setDeletionNotice({ accepted: true });
        return;
      }
      if (normalized.code === 'rights_unavailable') setAvailable(false);
      setError(normalized.message);
      throw normalized;
    } finally {
      setBusy(null);
    }
  }, []);

  return {
    job,
    loading,
    busy,
    available,
    error,
    deletionNotice,
    pollingPaused: Boolean(job && ['pending', 'building', 'retry'].includes(job.status)
      && (!online || pollAttempt >= EXPORT_POLL_MAX_ATTEMPTS)),
    refresh,
    requestExport,
    downloadExport,
    requestDeletion,
  };
}
