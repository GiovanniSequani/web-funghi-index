import React from 'react';
import ReactDOM from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import App from './App';
import AuthCallbackPage from './account/AuthCallbackPage';
import { resolveAuthCallbackMode } from './account/authCallback';

const authCallbackMode = resolveAuthCallbackMode(window.location.pathname, window.location.search);
const content = authCallbackMode
  ? <AuthCallbackPage mode={authCallbackMode} />
  : <App />;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {content}
  </React.StrictMode>,
);
