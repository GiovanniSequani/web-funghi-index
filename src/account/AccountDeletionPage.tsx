import React from 'react';
import { ArrowLeft, CheckCircle2, Mail, ShieldAlert, Trash2 } from 'lucide-react';
import type { DeletionTokenCallback } from './deletionToken';
import {
  confirmAccountDeletion,
  requestExternalAccountDeletion,
} from './rightsClient';
import { getAccountSupabaseClient } from './client';
import { toAccountError } from './validation';
import '../legal/legal.css';
import './account.css';

async function clearLocalSession(): Promise<void> {
  const { error } = await getAccountSupabaseClient().auth.signOut({ scope: 'local' });
  if (error) throw toAccountError(error);
}

export default function AccountDeletionPage(props: {
  callback: DeletionTokenCallback | null;
  requestDeletion?: (email: string) => Promise<void>;
  confirmDeletion?: (token: string) => Promise<unknown>;
  clearSession?: () => Promise<void>;
}) {
  const requestDeletion = props.requestDeletion ?? requestExternalAccountDeletion;
  const confirmDeletion = props.confirmDeletion ?? confirmAccountDeletion;
  const clearSession = props.clearSession ?? clearLocalSession;
  const [email, setEmail] = React.useState('');
  const [requestBusy, setRequestBusy] = React.useState(false);
  const [requestSent, setRequestSent] = React.useState(false);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const [understood, setUnderstood] = React.useState(false);
  const [confirmState, setConfirmState] = React.useState<'idle' | 'busy' | 'confirmed' | 'error'>(
    props.callback?.invalid ? 'error' : 'idle',
  );
  const [confirmError, setConfirmError] = React.useState<string | null>(
    props.callback?.invalid ? 'Il link non è valido, è scaduto oppure è già stato usato. Richiedi una nuova email.' : null,
  );
  const [logoutWarning, setLogoutWarning] = React.useState<string | null>(null);
  const submittedRef = React.useRef(false);

  const submitExternalRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setRequestBusy(true);
    setRequestError(null);
    try {
      await requestDeletion(email);
      setEmail('');
      setRequestSent(true);
    } catch (cause) {
      setRequestError(toAccountError(cause).message);
    } finally {
      setRequestBusy(false);
    }
  };

  const submitConfirmation = async () => {
    const token = props.callback?.token;
    if (!token || !understood || submittedRef.current) return;
    submittedRef.current = true;
    setConfirmState('busy');
    setConfirmError(null);
    try {
      await confirmDeletion(token);
      setConfirmState('confirmed');
      try {
        await clearSession();
      } catch {
        setLogoutWarning('La cancellazione è stata confermata, ma non è stato possibile chiudere la sessione locale. Chiudi questa pagina e usa “Esci” se il profilo risulta ancora aperto.');
      }
    } catch (cause) {
      const normalized = toAccountError(cause);
      if (normalized.code !== 'deletion_token_invalid') submittedRef.current = false;
      setConfirmState('error');
      setConfirmError(normalized.message);
    }
  };

  return (
    <main className="legal-page account-deletion-page">
      <nav aria-label="Navigazione account">
        <a href="/"><ArrowLeft size={15} aria-hidden="true" /> Mappa</a>
        <a href="/account-e-dati">Account e dati</a>
        <a href="/privacy">Privacy</a>
      </nav>

      <div className="deletion-page-shell">
        <div className="legal-page-heading">
          <p>Funghi Tracker</p>
          <span>Diritti account</span>
        </div>

        {props.callback?.token && confirmState !== 'confirmed' ? (
          <section className="public-deletion-card danger" aria-labelledby="confirm-deletion-title">
            <span className="public-deletion-icon"><ShieldAlert aria-hidden="true" /></span>
            <h1 id="confirm-deletion-title">Conferma eliminazione</h1>
            <p>Stai per avviare l’eliminazione definitiva dell’account e dei dati associati.</p>
            <ul>
              <li>account, profilo e accettazioni;</li>
              <li>percorsi GPX, modifiche e ritrovamenti;</li>
              <li>export temporanei ed email automatiche riconducibili all’account.</li>
            </ul>
            <p>La rimozione avviene appena possibile; eventuali residui tecnici entro 30 giorni. Esporta prima ciò che vuoi conservare.</p>
            <label className="public-deletion-confirm">
              <input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} />
              <span>Ho compreso che l’operazione è definitiva e voglio avviare la cancellazione.</span>
            </label>
            {confirmError && (
              <>
                <p className="account-message error" role="alert">{confirmError}</p>
                {submittedRef.current && <a href="/elimina-account">Richiedi un nuovo link</a>}
              </>
            )}
            <button className="public-danger-button" type="button" disabled={!understood || confirmState === 'busy' || submittedRef.current} onClick={() => void submitConfirmation()}>
              <Trash2 size={17} aria-hidden="true" /> {confirmState === 'busy' ? 'Conferma in corso…' : 'Conferma eliminazione definitiva'}
            </button>
          </section>
        ) : confirmState === 'confirmed' ? (
          <section className="public-deletion-card success" aria-labelledby="deletion-confirmed-title">
            <span className="public-deletion-icon"><CheckCircle2 aria-hidden="true" /></span>
            <h1 id="deletion-confirmed-title">Richiesta confermata</h1>
            <p>L’account è ora in eliminazione. Il backend procederà in modo riprendibile e invaliderà definitivamente l’accesso al termine.</p>
            <p>Gli eventuali residui tecnici vengono rimossi entro 30 giorni. Questa conferma non significa che il job sia già completato.</p>
            {logoutWarning && <p className="account-message warning" role="alert">{logoutWarning}</p>}
            <a className="public-primary-link" href="/">Torna alla mappa</a>
          </section>
        ) : (
          <section className="public-deletion-card" aria-labelledby="request-deletion-title">
            <span className="public-deletion-icon"><Mail aria-hidden="true" /></span>
            <h1 id="request-deletion-title">Richiedi l’eliminazione dell’account</h1>
            <p>Inserisci l’email usata per FunghiTracker. Se può essere elaborata, riceverai un link monouso per confermare la richiesta.</p>
            <p>Per proteggere la privacy mostriamo sempre la stessa risposta: non confermiamo se un account esiste. Non inviare password, percorsi, coordinate o documenti.</p>
            {confirmError && <p className="account-message error" role="alert">{confirmError}</p>}
            {requestSent ? (
              <p className="account-message success" role="status">Controlla la posta. Se la richiesta può essere elaborata, riceverai un link di conferma.</p>
            ) : (
              <form onSubmit={(event) => void submitExternalRequest(event)}>
                <label>
                  Email account
                  <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </label>
                {requestError && <p className="account-message error" role="alert">{requestError}</p>}
                <button className="public-primary-button" type="submit" disabled={requestBusy}>
                  {requestBusy ? 'Invio…' : 'Invia richiesta'}
                </button>
              </form>
            )}
          </section>
        )}
      </div>
    </main>
  );
}