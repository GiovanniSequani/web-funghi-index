import React from 'react';
import { AccountRightsPanel } from './AccountRightsPanel';
import { AlertTriangle, Clock3, FileText, LockKeyhole, RefreshCw, Trash2 } from 'lucide-react';
import {
  bundledDocumentsMatch,
  LegalDocument,
  LEGAL_DOCUMENTS,
} from '../legal/LegalDocument';
import {
  canChangeLegalAcceptance,
  type AccountAccess,
  type AccountLifecyclePublicConfig,
} from './lifecycle';

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateFormatter.format(date);
}

function stateCopy(access: AccountAccess | null): {
  eyebrow: string;
  title: string;
  description: string;
  tone: string;
} {
  if (!access) {
    return {
      eyebrow: 'Stato non verificabile',
      title: 'Accesso temporaneamente limitato',
      description: 'Non è stato possibile verificare lo stato dell’account. Le funzioni riservate restano bloccate finché il server non risponde.',
      tone: 'unknown',
    };
  }
  if (access.account_state === 'deletion_pending') {
    return {
      eyebrow: 'Eliminazione richiesta',
      title: 'Account in eliminazione',
      description: 'La richiesta è in lavorazione. Le funzioni riservate non sono disponibili e questa schermata non indica che la cancellazione sia già completata.',
      tone: 'danger',
    };
  }
  switch (access.restriction_reason) {
    case 'terms_outdated':
      return {
        eyebrow: 'Documenti aggiornati',
        title: 'È richiesta una nuova accettazione',
        description: 'Leggi i Termini correnti e l’Informativa privacy. L’accesso completo torna disponibile dopo l’accettazione registrata dal server.',
        tone: 'warning',
      };
    case 'terms_refused':
      return {
        eyebrow: 'Condizioni rifiutate',
        title: 'Account con accesso limitato',
        description: 'Hai rifiutato i Termini correnti. Puoi leggerli nuovamente e riattivare l’account accettando la versione corrente.',
        tone: 'warning',
      };
    case 'inactive':
      return {
        eyebrow: 'Account inattivo',
        title: 'Accesso limitato per inattività',
        description: 'Il server ha limitato l’account per inattività. Se i documenti sono correnti, una nuova attività esplicita può riattivarlo; altrimenti è richiesta l’accettazione.',
        tone: 'warning',
      };
    case 'security':
      return {
        eyebrow: 'Verifica necessaria',
        title: 'Accesso limitato per sicurezza',
        description: 'La riattivazione automatica non è disponibile. Consulta i documenti e contatta l’assistenza senza inviare password, percorsi o coordinate.',
        tone: 'danger',
      };
    default:
      return {
        eyebrow: 'Accesso limitato',
        title: 'Funzioni riservate non disponibili',
        description: 'Lo stato restituito dal server non consente l’accesso completo.',
        tone: 'unknown',
      };
  }
}

export function AccountLifecyclePanel(props: {
  config: AccountLifecyclePublicConfig | null;
  access: AccountAccess | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  onNoticeSeen: () => Promise<void>;
  onAccept: () => Promise<void>;
  onRefuse: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [termsAccepted, setTermsAccepted] = React.useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const noticeKeyRef = React.useRef<string | null>(null);
  const copy = stateCopy(props.access);
  const documentsMatch = bundledDocumentsMatch(
    props.config?.current_terms_version ?? null,
    props.config?.current_privacy_version ?? null,
  );
  const canReactivate = canChangeLegalAcceptance(props.access);
  const shouldRecordNotice = Boolean(
    props.access?.needs_terms_action
    && canReactivate
    && documentsMatch,
  );

  React.useEffect(() => {
    if (!shouldRecordNotice) return;
    const key = String(props.config?.current_terms_version) + ':' + String(props.config?.current_privacy_version);
    if (noticeKeyRef.current === key) return;
    noticeKeyRef.current = key;
    const frame = window.requestAnimationFrame(() => {
      void props.onNoticeSeen().catch((cause) => {
        noticeKeyRef.current = null;
        setLocalError(cause instanceof Error ? cause.message : 'Non è stato possibile registrare la visualizzazione dei documenti.');
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    props.config?.current_privacy_version ?? null,
    props.config?.current_terms_version ?? null,
    props.onNoticeSeen,
    shouldRecordNotice,
  ]);

  const run = async (action: () => Promise<void>) => {
    setLocalError(null);
    try {
      await action();
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Operazione non riuscita. Riprova.');
    }
  };

  const refuse = async () => {
    if (!window.confirm('Rifiutare i Termini correnti? L’account resterà con accesso limitato.')) return;
    await run(props.onRefuse);
  };

  const deadline = formatDate(props.access?.legal_reaccept_deadline_at ?? null);
  const inactivityDeleteAfter = formatDate(props.access?.inactivity_delete_after ?? null);

  return (
    <section className={'lifecycle-panel tone-' + copy.tone} aria-labelledby="lifecycle-title">
      <header>
        <span className="lifecycle-state-icon" aria-hidden="true">
          {props.access?.account_state === 'deletion_pending' ? <Trash2 /> : copy.tone === 'danger' ? <LockKeyhole /> : <AlertTriangle />}
        </span>
        <div>
          <p>{copy.eyebrow}</p>
          <h2 id="lifecycle-title">{copy.title}</h2>
        </div>
      </header>

      <p className="lifecycle-description">{copy.description}</p>
      {deadline && <p className="lifecycle-deadline"><Clock3 size={16} aria-hidden="true" /> Accetta entro il {deadline}.</p>}
      {inactivityDeleteAfter && <p className="lifecycle-deadline"><Clock3 size={16} aria-hidden="true" /> Eliminazione prevista non prima del {inactivityDeleteAfter}, salvo nuova attività valida.</p>}
      {(props.error || localError) && <p className="account-message error" role="alert">{localError ?? props.error}</p>}

      {!documentsMatch && (
        <div className="lifecycle-version-error" role="alert">
          <strong>Documenti correnti non disponibili in questa versione del sito</strong>
          <p>Il server richiede Termini {props.config?.current_terms_version ?? '—'} e Privacy {props.config?.current_privacy_version ?? '—'}. Per sicurezza non è possibile accettare documenti diversi.</p>
        </div>
      )}

      {documentsMatch && (
        <div className="lifecycle-documents">
          <details>
            <summary><FileText size={16} aria-hidden="true" /> Termini · versione {LEGAL_DOCUMENTS.terms.version}</summary>
            <div className="lifecycle-document-scroll"><LegalDocument kind="terms" compact /></div>
            <a href="/termini" target="_blank" rel="noreferrer">Apri i Termini in una pagina separata</a>
          </details>
          <details>
            <summary><FileText size={16} aria-hidden="true" /> Privacy · versione {LEGAL_DOCUMENTS.privacy.version}</summary>
            <div className="lifecycle-document-scroll"><LegalDocument kind="privacy" compact /></div>
            <a href="/privacy/" target="_blank" rel="noreferrer">Apri l’Informativa privacy in una pagina separata</a>
          </details>
        </div>
      )}

      {documentsMatch && canReactivate && props.access?.needs_terms_action && (
        <div className="lifecycle-actions">
          <label>
            <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
            <span>Accetto i Termini correnti e dichiaro di avere almeno 18 anni.</span>
          </label>
          <label>
            <input type="checkbox" checked={privacyAcknowledged} onChange={(event) => setPrivacyAcknowledged(event.target.checked)} />
            <span>Dichiaro di aver letto l’Informativa privacy corrente.</span>
          </label>
          <button
            className="account-primary"
            type="button"
            disabled={props.busy || !termsAccepted || !privacyAcknowledged}
            onClick={() => void run(props.onAccept)}
          >
            {props.busy ? 'Salvataggio…' : 'Accetta e riattiva'}
          </button>
          <button className="lifecycle-refuse" type="button" disabled={props.busy} onClick={() => void refuse()}>
            Rifiuta e mantieni l’accesso limitato
          </button>
        </div>
      )}

      {!canReactivate && (
        <p className="lifecycle-support">
          Assistenza: <a href="mailto:funghitracker@gmail.com">funghitracker@gmail.com</a>
        </p>
      )}

      {props.access && <AccountRightsPanel accountState={props.access.account_state} compact />}

      <footer>
        <button type="button" disabled={props.loading || props.busy} onClick={() => void run(props.onRefresh)}>
          <RefreshCw size={16} aria-hidden="true" /> Aggiorna stato
        </button>
        <button type="button" disabled={props.busy} onClick={() => void run(props.onSignOut)}>Esci</button>
      </footer>
    </section>
  );
}