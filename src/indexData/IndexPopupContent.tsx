import React from 'react';
import { Activity, Check, Copy, PanelRightOpen, RefreshCw, X } from 'lucide-react';
import { formatLongDate } from '../pointDetails/formatters';
import type { MapPoint } from '../pointDetails/types';
import { selectLimitedIndexDay } from '../indexAccess';
import { useIndexHistory } from './useIndexHistory';
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
  onShowAccessNotice: () => void;
  fullIndexAccess: boolean;
}) {
  const { point, onClose, onShowData, onShowAnalysis, onShowAccessNotice } = props;
  const current = useIndexPoint(point, props.fullIndexAccess);
  const history = useIndexHistory(point, !props.fullIndexAccess);
  const limitedDay = history.state.status === 'success' && history.state.data
    ? selectLimitedIndexDay(history.state.data)
    : null;
  const state = props.fullIndexAccess ? current.state : history.state;
  const retry = props.fullIndexAccess ? current.retry : history.retry;
  const indexDate = props.fullIndexAccess && current.state.status === 'success'
    ? current.state.data?.indexDate ?? null
    : limitedDay?.date ?? null;
  const porciniScore = props.fullIndexAccess && current.state.status === 'success'
    ? current.state.data?.porciniScore ?? null
    : limitedDay?.porciniScore ?? null;
  const finferliScore = props.fullIndexAccess && current.state.status === 'success'
    ? current.state.data?.finferliScore ?? null
    : limitedDay?.finferliScore ?? null;
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
          <span>Caricamento indice{props.fullIndexAccess ? ' più recente' : ' pubblico'}…</span>
        )}
        {state.status === 'success' && indexDate && (
          <>
            <div className="coordinate-index-date">
              <span>Indice</span>
              <strong>{formatLongDate(indexDate)}</strong>
            </div>
            <div className="coordinate-index-scores">
              <div>
                <span>Porcini</span>
                <strong>{scoreLabel(porciniScore)}</strong>
              </div>
              <div>
                <span>Finferli</span>
                <strong>{scoreLabel(finferliScore)}</strong>
              </div>
            </div>
            {!props.fullIndexAccess && <p className="coordinate-index-access-note">Indice pubblico con 7 giorni di ritardo.</p>}
            {porciniScore === null && finferliScore === null && (
              <p>Nessun valore disponibile per questa cella.</p>
            )}
          </>
        )}
        {state.status === 'success' && !indexDate && (
          <div className="coordinate-index-error"><span>Nessuna data pubblica disponibile nella finestra consentita.</span></div>
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
        <button
          type="button"
          className="coordinate-popup-analysis"
          onClick={props.fullIndexAccess ? onShowAnalysis : onShowAccessNotice}
        >
          <Activity size={17} aria-hidden="true" />
          <span>Analisi indice</span>
        </button>
      </div>
    </div>
  );
}
