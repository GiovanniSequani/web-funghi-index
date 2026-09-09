import React from 'react';
import ReactDOM from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import App from './App';
import AuthCallbackPage from './account/AuthCallbackPage';
import { consumeAuthCallback } from './account/authCallback';
import { LegalDocumentPage } from './legal/LegalDocument';
import AccountDeletionPage from './account/AccountDeletionPage';
import { consumeDeletionToken } from './account/deletionToken';
import { MarketingSite } from './site/MarketingSite';
import { resolvePublicPage } from './site/routes';

const deletionTokenCallback = consumeDeletionToken(
  window.location.pathname,
  window.location.search,
  window.location.hash,
  (cleanUrl) => window.history.replaceState(null, document.title, cleanUrl),
);

const authCallback = consumeAuthCallback(
  window.location.pathname,
  window.location.search,
  window.location.hash,
  (cleanPath) => window.history.replaceState(null, document.title, cleanPath),
);
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
const publicPage = resolvePublicPage(window.location.pathname);
document.title = 'FunghiTracker';
const content = normalizedPath === '/elimina-account'
  ? <AccountDeletionPage callback={deletionTokenCallback} />
  : authCallback
    ? <AuthCallbackPage mode={authCallback.mode} callback={authCallback.callback} />
    : legalDocumentKind
      ? <LegalDocumentPage kind={legalDocumentKind} />
      : publicPage === 'map'
        ? <App />
        : <MarketingSite page={publicPage === 'method' || publicPage === 'archive' ? publicPage : 'home'} />;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {content}
  </React.StrictMode>,
);
