import React from 'react';
import ReactDOM from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import App from './App';
import AuthCallbackPage from './account/AuthCallbackPage';
import MobileAuthBridgePage from './account/MobileAuthBridgePage';
import { resolveAuthCallbackMode } from './account/authCallback';
import { consumeMobileConfirmCallback } from './account/mobileAuthBridge';

const mobileConfirmCallback = consumeMobileConfirmCallback(
  window.location.pathname,
  window.location.search,
  (cleanPath) => window.history.replaceState(null, document.title, cleanPath),
);
const authCallbackMode = mobileConfirmCallback
  ? null
  : resolveAuthCallbackMode(window.location.pathname, window.location.search);
const content = mobileConfirmCallback
  ? <MobileAuthBridgePage callback={mobileConfirmCallback} />
  : authCallbackMode
    ? <AuthCallbackPage mode={authCallbackMode} />
    : <App />;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {content}
  </React.StrictMode>,
);