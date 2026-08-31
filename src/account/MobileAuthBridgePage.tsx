import React from 'react';
import { ExternalLink, Smartphone } from 'lucide-react';
import {
  buildMobileConfirmDeepLink,
  type MobileConfirmCallback,
} from './mobileAuthBridge';
import './auth-callback.css';

export default function MobileAuthBridgePage(props: {
  callback: MobileConfirmCallback;
  openApp?: (deepLink: string) => void;
}) {
  const [attempted, setAttempted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleOpen = () => {
    if (!props.callback.valid) return;
    setError(null);
    setAttempted(true);
    try {
      const deepLink = buildMobileConfirmDeepLink(props.callback);
      (props.openApp ?? ((url: string) => window.location.assign(url)))(deepLink);
    } catch {
      setError('Non è stato possibile aprire Funghi Tracker. Verifica che l’app sia installata e riprova.');
    }
  };

  return (
    <main className="auth-callback-page">
      <section className="auth-callback-card" aria-labelledby="mobile-confirm-title">
        <div className="auth-callback-icon" aria-hidden="true"><Smartphone /></div>
        <p className="auth-callback-brand">Funghi Tracker</p>
        <h1 id="mobile-confirm-title">Continua nell’app</h1>

        {!props.callback.valid ? (
          <>
            <p className="auth-callback-message error" role="alert">{props.callback.message}</p>
            <p>Richiedi una nuova email di conferma dall’app.</p>
          </>
        ) : (
          <>
            <p>Il link è pronto. Premi il pulsante per aprire Funghi Tracker e confermare il tuo account.</p>
            <button type="button" onClick={handleOpen}>
              <ExternalLink size={18} aria-hidden="true" />
              Apri Funghi Tracker
            </button>
            {attempted && !error && (
              <p className="auth-callback-message bridge-note" role="status">
                Se l’app non si è aperta, verifica che sia installata e premi nuovamente il pulsante.
              </p>
            )}
            {error && <p className="auth-callback-message error" role="alert">{error}</p>}
          </>
        )}

        <a className="auth-callback-secondary" href="/">Vai al sito web</a>
      </section>
    </main>
  );
}