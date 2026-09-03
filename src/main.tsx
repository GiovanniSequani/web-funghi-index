import React from 'react';
import ReactDOM from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import App from './App';
import AuthCallbackPage from './account/AuthCallbackPage';
import MobileAuthBridgePage from './account/MobileAuthBridgePage';
import { resolveAuthCallbackMode } from './account/authCallback';
import { consumeMobileConfirmCallback } from './account/mobileAuthBridge';
import { LegalDocumentPage } from './legal/LegalDocument';
import AccountDeletionPage from './account/AccountDeletionPage';
import { consumeDeletionToken } from './account/deletionToken';

const deletionTokenCallback = consumeDeletionToken(
  window.location.pathname,
  window.location.search,
  window.location.hash,
  (cleanUrl) => window.history.replaceState(null, document.title, cleanUrl),
);

const mobileConfirmCallback = consumeMobileConfirmCallback(
  window.location.pathname,
  window.location.search,
  (cleanPath) => window.history.replaceState(null, document.title, cleanPath),
);
const authCallbackMode = mobileConfirmCallback
  ? null
  : resolveAuthCallbackMode(window.location.pathname, window.location.search);
const normalizedPath = window.location.pathname.length > 1 && window.location.pathname.endsWith('/')
  ? window.location.pathname.slice(0, -1)
  : window.location.pathname;
const legalDocumentKind = normalizedPath === '/termini'
  ? 'terms'
  : normalizedPath === '/privacy'
    ? 'privacy'
    : normalizedPath === '/account-e-dati'
      ? 'account'
      : null;
const content = normalizedPath === '/elimina-account'
  ? <AccountDeletionPage callback={deletionTokenCallback} />
  : mobileConfirmCallback
    ? <MobileAuthBridgePage callback={mobileConfirmCallback} />
  : authCallbackMode
    ? <AuthCallbackPage mode={authCallbackMode} />
    : legalDocumentKind
      ? <LegalDocumentPage kind={legalDocumentKind} />
      : <App />;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {content}
  </React.StrictMode>,
);