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
  if (/account access is restricted|account state does not permit/.test(message)) {
    return new AccountArchiveError('account_restricted', 'L’account ha accesso limitato. Consulta lo stato e i documenti del profilo.', { cause: error });
  }
  if (/document version is not current/.test(message)) {
    return new AccountArchiveError('document_outdated', 'È disponibile una nuova versione dei documenti. Ricarica la schermata prima di continuare.', { cause: error });
  }
  if (/account lifecycle is not enabled|configurazione lifecycle|versioni correnti dei documenti/.test(message)) {
    return new AccountArchiveError('lifecycle_unavailable', 'La gestione dello stato account non è temporaneamente disponibile. Riprova più tardi.', { cause: error });
  }
  if (/account rights are not enabled|account_export_jobs|schema cache.*account_export_jobs|could not find the table.*account_export_jobs|could not find the function.*(?:request_my_data_export|request_my_account_deletion_verification|request_external_account_deletion|confirm_account_deletion)|schema cache.*(?:request_my_data_export|request_my_account_deletion_verification|request_external_account_deletion|confirm_account_deletion)/.test(message)) {
    return new AccountArchiveError('rights_unavailable', 'Export ed eliminazione account non sono ancora disponibili. Riprova più tardi.', { cause: error });
  }
  if (/data export rate limit exceeded/.test(message)) {
    return new AccountArchiveError('export_rate_limited', 'Hai già richiesto un export di recente. Controlla lo stato del job corrente o riprova più tardi.', { cause: error });
  }
  if (/export must be requested before deletion is confirmed/.test(message)) {
    return new AccountArchiveError('account_restricted', 'L’export deve essere richiesto prima di confermare la cancellazione dell’account.', { cause: error });
  }
  if (/verification token is invalid or expired/.test(message)) {
    return new AccountArchiveError('deletion_token_invalid', 'Il link non è valido, è scaduto oppure è già stato usato. Richiedi una nuova email.', { cause: error });
  }
  if (/deletion verification rate limit exceeded/.test(message)) {
    return new AccountArchiveError('deletion_rate_limited', 'Controlla l’email: se la richiesta può essere elaborata riceverai il link di conferma.', { cause: error });
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
