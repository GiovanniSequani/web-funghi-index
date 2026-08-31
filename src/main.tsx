import React from 'react';
import ReactDOM from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import App from './App';
import AuthCallbackPage from './account/AuthCallbackPage';

const routePath = window.location.pathname.replace(/\/+$/, '') || '/';
const content = routePath === '/auth/confirm'
  ? <AuthCallbackPage mode="confirm" />
  : routePath === '/auth/recovery'
    ? <AuthCallbackPage mode="recovery" />
    : <App />;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {content}
  </React.StrictMode>,
);
