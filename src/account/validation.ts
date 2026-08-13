import { AccountArchiveError } from './types';

export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string): string | null {
  return USERNAME_PATTERN.test(normalizeUsername(value))
    ? null
    : 'Usa 3-24 caratteri: lettere minuscole, numeri o underscore.';
}

export function normalizeTrackName(value: string): string {
  return value.trim();
}

export function validateTrackName(value: string): string | null {
  const normalized = normalizeTrackName(value);
  if (normalized.length < 1 || normalized.length > 120) return 'Il nome deve contenere da 1 a 120 caratteri.';
  if(/[\u0000-\u001f\u007f/\\]/.test(normalized)) return 'Il nome non può contenere caratteri di controllo, / o \\.';
  return null;
}
type ErrorLike = {
  message?: string;
  status?: number;
  code?: string;
};

export function toAccountError(error: unknown): AccountArchiveError {
  if (error instanceof AccountArchiveError) return error;

  const candidate = (error ?? {}) as ErrorLike;
  const message = candidate.message?.toLowerCase() ?? '';
  const status = candidate.status;

  if (status === 401 || status === 403 || /jwt|session.*expired|refresh token/.test(message)) {
    return new AccountArchiveError('session_expired', 'La sessione è scaduta. Accedi di nuovo.', { cause: error });
  }
  if (/invalid login credentials/.test(message)) {
    return new AccountArchiveError('invalid_credentials', 'Email o password non corretti.', { cause: error });
  }
  if (/email not confirmed/.test(message)) {
    return new AccountArchiveError('email_not_confirmed', 'Conferma l’email prima di accedere.', { cause: error });
  }
  if (/quota.*exceed/.test(message)) {
    return new AccountArchiveError('quota_exceeded', 'Hai raggiunto il limite di tracce configurato.', { cause: error });
  }
  if (/track.*not found|traccia.*non trovata|no rows|not found/.test(message)) {
    return new AccountArchiveError('track_not_found', 'Traccia non trovata. Aggiorna l’archivio e riprova.', { cause: error });
  }
  if (/display.?name|track.?name|invalid.*name|nome.*non valid/.test(message)) {
    return new AccountArchiveError('invalid_track_name', 'Il nome della traccia non è valido.', { cause: error });
  }
  if (/username|duplicate|unique|database error saving new user/.test(message)) {
    return new AccountArchiveError('duplicate_username', 'Username già in uso. Scegline un altro.', { cause: error });
  }
  if (error instanceof TypeError || /fetch|network|failed to fetch/.test(message)) {
    return new AccountArchiveError('network', 'Errore di rete. Controlla la connessione e riprova.', { cause: error });
  }

  return new AccountArchiveError('unknown', candidate.message || 'Operazione non riuscita. Riprova.', { cause: error });
}

export function safeDownloadName(trackName: string): string {
  const clean = trackName.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'traccia';
  if (/\.gpx\.gz$/i.test(clean)) return clean;
  if (/\.gpx$/i.test(clean)) return `${clean}.gz`;
  return `${clean}.gpx.gz`;
}
