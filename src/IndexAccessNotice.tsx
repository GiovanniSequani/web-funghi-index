import React from 'react';
import { Activity, CalendarClock, FolderArchive, LockKeyhole, X } from 'lucide-react';
import type { AccountAccess } from './account/lifecycle';

export function getIndexAccessNoticeCopy(authenticated: boolean, access: AccountAccess | null) {
  if (!authenticated) {
    return {
      title: 'Accedi per usare tutti i servizi',
      description: 'Stai visualizzando l’indice pubblico con 7 giorni di ritardo.',
      action: 'Accedi o registrati',
    };
  }
  if (!access) {
    return {
      title: 'Accesso completo non verificabile',
      description: 'Non è stato possibile verificare lo stato dell’account. Le funzioni riservate restano bloccate.',
      action: 'Controlla il profilo',
    };
  }
  if (access.account_state === 'deletion_pending') {
    return {
      title: 'Account in eliminazione',
      description: 'Le funzioni riservate non sono più disponibili mentre la cancellazione è in corso.',
      action: 'Controlla lo stato',
    };
  }
  switch (access.restriction_reason) {
    case 'terms_outdated':
    case 'terms_refused':
      return {
        title: 'Aggiorna i documenti del tuo account',
        description: 'Accetta i Termini correnti per riattivare l’accesso completo a FunghiTracker.',
        action: 'Leggi e accetta i documenti',
      };
    case 'inactive':
      return {
        title: 'Riattiva il tuo account',
        description: 'L’account è limitato per inattività. Apri il profilo per registrarne la riattivazione e controllare i documenti.',
        action: 'Apri il profilo',
      };
    case 'security':
      return {
        title: 'Account limitato per sicurezza',
        description: 'Le funzioni riservate sono bloccate. Apri il profilo per vedere lo stato e contattare l’assistenza.',
        action: 'Apri il profilo',
      };
    default:
      return {
        title: 'Account con accesso limitato',
        description: 'Apri il profilo per controllare lo stato dell’account e le azioni disponibili.',
        action: 'Apri il profilo',
      };
  }
}

export function IndexAccessNotice(props: {
  authenticated: boolean;
  access: AccountAccess | null;
  onClose: () => void;
  onAction: () => void;
}) {
  const closeRef = React.useRef<HTMLButtonElement | null>(null);
  const copy = getIndexAccessNoticeCopy(props.authenticated, props.access);

  React.useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [props.onClose]);

  return (
    <div className="index-access-backdrop">
      <section className="index-access-dialog" role="dialog" aria-modal="true" aria-labelledby="index-access-title">
        <header>
          <span className="index-access-icon" aria-hidden="true"><LockKeyhole /></span>
          <button ref={closeRef} type="button" onClick={props.onClose} aria-label="Chiudi avviso accesso"><X /></button>
        </header>
        <h1 id="index-access-title">{copy.title}</h1>
        <p className="index-access-description">{copy.description}</p>
        <div className="index-access-benefits">
          <p>Con l’accesso completo puoi usare:</p>
          <ul>
            <li><CalendarClock aria-hidden="true" /><span><strong>Indice aggiornato</strong>Ultimo giorno disponibile.</span></li>
            <li><Activity aria-hidden="true" /><span><strong>Analisi dell’indice</strong>Fattori favorevoli e sfavorevoli.</span></li>
            <li><FolderArchive aria-hidden="true" /><span><strong>Archivio cloud</strong>Percorsi e ritrovamenti personali.</span></li>
          </ul>
        </div>
        <div className="index-access-actions">
          <button className="index-access-primary" type="button" onClick={props.onAction}>{copy.action}<span aria-hidden="true">→</span></button>
          <button type="button" onClick={props.onClose}>Continua con l’indice pubblico</button>
        </div>
      </section>
    </div>
  );
}
