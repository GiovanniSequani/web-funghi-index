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

export type AccountRightsState = {
  job: AccountExportJob | null;
  loading: boolean;
  busy: 'request_export' | 'download' | 'request_deletion' | null;
  available: boolean | null;
  error: string | null;
  deletionNotice: DeletionVerificationResponse | null;
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
  const sequenceRef = React.useRef(0);

  const refresh = React.useCallback(async () => {
    if (!enabled) return;
    const sequence = ++sequenceRef.current;
    setLoading(true);
    setError(null);
    try {
      const nextJob = await loadLatestAccountExport();
      if (sequence !== sequenceRef.current) return;
      setJob(nextJob);
      setAvailable(true);
    } catch (cause) {
      if (sequence !== sequenceRef.current) return;
      const normalized = toAccountError(cause);
      if (normalized.code === 'rights_unavailable') setAvailable(false);
      setError(normalized.message);
    } finally {
      if (sequence === sequenceRef.current) setLoading(false);
    }
  }, [enabled]);

  React.useEffect(() => {
    if (!enabled) {
      sequenceRef.current += 1;
      setJob(null);
      setLoading(false);
      setBusy(null);
      setAvailable(null);
      setError(null);
      setDeletionNotice(null);
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  React.useEffect(() => {
    if (!enabled || !job || !['pending', 'building', 'retry'].includes(job.status)) return;
    const timer = window.setTimeout(() => void refresh(), 15_000);
    return () => window.clearTimeout(timer);
  }, [enabled, job, refresh]);

  const requestExport = React.useCallback(async () => {
    setBusy('request_export');
    setError(null);
    try {
      const nextJob = await requestMyDataExport();
      setJob(nextJob);
      setAvailable(true);
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
    refresh,
    requestExport,
    downloadExport,
    requestDeletion,
  };
}