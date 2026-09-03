export type AccountExportStatus =
  | 'pending'
  | 'building'
  | 'retry'
  | 'ready'
  | 'expired'
  | 'cleaning';

export type AccountExportJob = {
  id: string;
  status: AccountExportStatus;
  storage_path: string;
  requested_at: string;
  ready_at: string | null;
  expires_at: string | null;
  size_bytes: number | null;
  last_error_code: string | null;
  updated_at: string;
};

export type DeletionVerificationResponse = {
  accepted: true;
  expires_in_minutes?: number;
};

export type DeletionConfirmationResponse = {
  confirmed: true;
  job_id: string;
};

export function isExportDownloadable(job: AccountExportJob, now = Date.now()): boolean {
  if (job.status !== 'ready' || !job.expires_at) return false;
  const expiresAt = new Date(job.expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
}
