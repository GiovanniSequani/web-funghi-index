import React from 'react';
import { Activity, Check, Copy, PanelRightOpen, RefreshCw, X } from 'lucide-react';
import { formatLongDate } from '../pointDetails/formatters';
import type { MapPoint } from '../pointDetails/types';
import { useIndexPoint } from './useIndexPoint';
import './popup.css';

const scoreFormatter = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function scoreLabel(value: number | null): string {
  return value === null ? 'n/d' : scoreFormatter.format(value);
}

export function IndexPopupContent(props: {
  point: MapPoint;
  onClose: () => void;
  onShowData: () => void;
  onShowAnalysis: () => void;
}) {
  const { point, onClose, onShowData, onShowAnalysis } = props;
  const { state, retry } = useIndexPoint(point, true);
  const [copied, setCopied] = React.useState(false);
  const coordinates = `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;

  const copyCoordinates = async () => {
    await navigator.clipboard.writeText(coordinates);
    setCopied(true);
  };

  return (
    <div className="coordinate-popup-card">
      <div className="coordinate-popup-header">
        <strong>Coordinate</strong>
        <button type="button" onClick={onClose} className="coordinate-popup-icon" title="Chiudi">
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="coordinate-popup-row">
        <span>{coordinates}</span>
        <button
          type="button"
          onClick={copyCoordinates}
          className="coordinate-popup-icon"
          title="Copia coordinate"
        >
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        </button>
      </div>

      <div className="coordinate-index-summary" data-status={state.status} aria-live="polite">
        {(state.status === 'loading' || state.status === 'idle') && (
          <span>Caricamento indice più recente…</span>
        )}
        {state.status === 'success' && state.data && (
          <>
            <div className="coordinate-index-date">
              <span>Indice</span>
              <strong>{formatLongDate(state.data.indexDate)}</strong>
            </div>
            <div className="coordinate-index-scores">
              <div>
                <span>Porcini</span>
                <strong>{scoreLabel(state.data.porciniScore)}</strong>
              </div>
              <div>
                <span>Finferli</span>
                <strong>{scoreLabel(state.data.finferliScore)}</strong>
              </div>
            </div>
            {state.data.porciniScore === null && state.data.finferliScore === null && (
              <p>Nessun valore disponibile per questa cella.</p>
            )}
          </>
        )}
        {!['idle', 'loading', 'success'].includes(state.status) && (
          <div className="coordinate-index-error">
            <span>{state.message ?? 'Indice non disponibile.'}</span>
            {(state.status === 'error' || state.status === 'unavailable') && (
              <button type="button" onClick={retry}>
                <RefreshCw size={13} aria-hidden="true" />
                Riprova
              </button>
            )}
          </div>
        )}
      </div>

      <div className="coordinate-popup-actions">
        <button type="button" className="coordinate-popup-weather" onClick={onShowData}>
          <PanelRightOpen size={17} aria-hidden="true" />
          <span>Mostra dati</span>
        </button>
        <button type="button" className="coordinate-popup-analysis" onClick={onShowAnalysis}>
          <Activity size={17} aria-hidden="true" />
          <span>Analisi indice</span>
        </button>
      </div>
    </div>
  );
}
