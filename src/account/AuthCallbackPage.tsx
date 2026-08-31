import React from 'react';
import { CheckCircle2, KeyRound, MailCheck } from 'lucide-react';
import {
  isUsedOrExpiredTokenError,
  parseAuthCallback,
  updateRecoveryPassword,
  verifyAuthCallback,
  type AuthCallbackMode,
  type ParsedAuthCallback,
} from './authCallback';
import './auth-callback.css';

type ValidCallback = Extract<ParsedAuthCallback, { valid: true }>;

export default function AuthCallbackPage(props: {
  mode: AuthCallbackMode;
  verify?: (callback: ValidCallback) => Promise<void>;
  updatePassword?: (password: string) => Promise<void>;
}) {
  const [callback] = React.useState(() => parseAuthCallback(window.location.search, props.mode));
  const [status, setStatus] = React.useState<'ready' | 'verifying' | 'verified' | 'saving' | 'complete' | 'error'>('ready');
  const [message, setMessage] = React.useState<string | null>(callback.valid ? null : callback.message);
  const [password, setPassword] = React.useState('');
  const [passwordRepeat, setPasswordRepeat] = React.useState('');
  const verify = props.verify ?? verifyAuthCallback;
  const updatePassword = props.updatePassword ?? updateRecoveryPassword;

  const handleVerify = async () => {
    if (!callback.valid || status === 'verifying') return;
    setStatus('verifying');
    setMessage(null);
    window.history.replaceState(null, document.title, window.location.pathname);
    try {
      await verify(callback);
      setStatus(props.mode === 'confirm' ? 'complete' : 'verified');
    } catch (error) {
      setStatus('error');
      setMessage(isUsedOrExpiredTokenError(error)
        ? 'Questo link è già stato usato oppure è scaduto. Richiedine uno nuovo.'
        : 'Non è stato possibile verificare il link. Controlla la rete e riprova.');
    }
  };

  const handlePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (password.length < 6) {
      setMessage('La password deve contenere almeno 6 caratteri.');
      return;
    }
    if (password !== passwordRepeat) {
      setMessage('Le password non coincidono.');
      return;
    }
    setStatus('saving');
    try {
      await updatePassword(password);
      setPassword('');
      setPasswordRepeat('');
      setStatus('complete');
    } catch (error) {
      setStatus('verified');
      setMessage(isUsedOrExpiredTokenError(error)
        ? 'La sessione di recupero è scaduta. Richiedi un nuovo link.'
        : 'Non è stato possibile aggiornare la password. Controlla la rete e riprova.');
    }
  };

  const isConfirm = props.mode === 'confirm';
  const invalid = !callback.valid;
  const complete = status === 'complete';

  return (
    <main className="auth-callback-page">
      <section className="auth-callback-card" aria-labelledby="auth-callback-title">
        <div className="auth-callback-icon" aria-hidden="true">
          {complete ? <CheckCircle2 /> : isConfirm ? <MailCheck /> : <KeyRound />}
        </div>
        <p className="auth-callback-brand">Funghi Tracker</p>
        <h1 id="auth-callback-title">
          {isConfirm ? 'Conferma il tuo account' : 'Recupera la password'}
        </h1>

        {invalid && <p className="auth-callback-message error" role="alert">{message}</p>}

        {!invalid && status === 'ready' && (
          <>
            <p>{isConfirm
              ? 'Premi il pulsante per confermare il tuo indirizzo email.'
              : 'Premi il pulsante per verificare il link e scegliere una nuova password.'}</p>
            <button type="button" onClick={() => void handleVerify()}>
              {isConfirm ? 'Conferma email' : 'Verifica link'}
            </button>
          </>
        )}

        {status === 'verifying' && <p role="status">Verifica in corso…</p>}

        {status === 'error' && (
          <>
            <p className="auth-callback-message error" role="alert">{message}</p>
            <button type="button" onClick={() => void handleVerify()}>Riprova</button>
          </>
        )}

        {!isConfirm && (status === 'verified' || status === 'saving') && (
          <form onSubmit={(event) => void handlePassword(event)}>
            <p>Il link è valido. Scegli la nuova password.</p>
            <label>
              Nuova password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={6} required />
            </label>
            <label>
              Ripeti password
              <input type="password" value={passwordRepeat} onChange={(event) => setPasswordRepeat(event.target.value)} autoComplete="new-password" minLength={6} required />
            </label>
            {message && <p className="auth-callback-message error" role="alert">{message}</p>}
            <button type="submit" disabled={status === 'saving'}>{status === 'saving' ? 'Salvataggio…' : 'Salva nuova password'}</button>
          </form>
        )}

        {complete && (
          <>
            <p className="auth-callback-message success" role="status">
              {isConfirm ? 'Email confermata. Ora puoi accedere al tuo account.' : 'Password aggiornata. Ora puoi accedere con la nuova password.'}
            </p>
            <a className="auth-callback-home" href="/">Torna alla mappa</a>
          </>
        )}

        {(invalid || status === 'error') && <a className="auth-callback-secondary" href="/">Torna alla mappa</a>}
      </section>
    </main>
  );
}
