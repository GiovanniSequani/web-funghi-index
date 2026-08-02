import React from 'react';
import { ArrowLeft, CircleCheckBig, RefreshCw, TriangleAlert, X } from 'lucide-react';
import { formatLongDate } from '../pointDetails/formatters';
import type { MapPoint } from '../pointDetails/types';
import type { Species } from '../types';
import { buildPorciniAnalysis, type IndexAnalysisFactor } from './analysis';
import { useIndexPoint } from './useIndexPoint';
import './analysis.css';

const scoreFormatter = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatScore(value: number | null): string {
  return value === null ? 'n/d' : scoreFormatter.format(value);
}

function FactorList(props: {
  title: string;
  tone: 'favorable' | 'unfavorable';
  factors: IndexAnalysisFactor[];
}) {
  const { title, tone, factors } = props;
  const SectionIcon = tone === 'favorable' ? CircleCheckBig : TriangleAlert;
  return (
    <section className="index-factor-section" data-tone={tone}>
      <div className="details-section-heading">
        <div className="index-factor-section-title">
          <SectionIcon size={17} aria-hidden="true" />
          <h2>{title}</h2>
        </div>
        <span>{factors.length}</span>
      </div>
      {factors.length === 0 ? (
        <p className="index-empty-factors">Nessun fattore disponibile in questa categoria.</p>
      ) : (
        <ol className="index-factor-list">
          {factors.map((factor) => {
            const helpId = `index-factor-help-${factor.id}`;
            return (
              <li key={factor.id}>
                <div className="index-factor-heading">
                  <div className="index-factor-title">
                    <strong>{factor.title}</strong>
                    <details className="index-factor-help">
                      <summary aria-label={`Spiega ${factor.title}`} aria-controls={helpId}>
                        ?
                      </summary>
                      <p id={helpId}>{factor.help}</p>
                    </details>
                  </div>
                  <span className="index-factor-rating">{factor.evidence}</span>
                </div>
                <ul className="index-factor-details">
                  {factor.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function IndexAnalysisDrawer(props: {
  point: MapPoint;
  initialSpecies: Species;
  onClose: () => void;
}) {
  const { point, initialSpecies, onClose } = props;
  const { state, retry } = useIndexPoint(point, true);
  const [species, setSpecies] = React.useState<Species>(initialSpecies);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    setSpecies(initialSpecies);
  }, [initialSpecies, point.latitude, point.longitude]);

  React.useEffect(() => {
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const analysis =
    state.status === 'success' && state.data ? buildPorciniAnalysis(state.data) : null;
  const canRetry = state.status === 'error' || state.status === 'unavailable';

  return (
    <aside
      className="point-details-drawer index-analysis-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="index-analysis-title"
    >
      <header className="point-details-header">
        <div>
          <p>Lettura del modello</p>
          <h1 id="index-analysis-title">Analisi indice</h1>
        </div>
        <button
          ref={closeButtonRef}
          className="details-close-button"
          type="button"
          onClick={onClose}
          aria-label="Chiudi analisi indice"
        >
          <ArrowLeft className="details-mobile-back" size={19} aria-hidden="true" />
          <X className="details-desktop-close" size={19} aria-hidden="true" />
          <span>Chiudi</span>
        </button>
      </header>

      <div className="point-details-meta">
        <div>
          <span>Coordinate</span>
          <strong>
            {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
          </strong>
        </div>
        <div>
          <span>Data indice</span>
          <strong>
            {state.status === 'success' && state.data
              ? formatLongDate(state.data.indexDate)
              : 'Ultima disponibile'}
          </strong>
        </div>
        <p>Valori della cella index-data più vicina · griglia circa 300 m</p>
      </div>

      <div className="point-details-content">
        {(state.status === 'loading' || state.status === 'idle') && (
          <div className="details-resource-message" data-status="loading" role="status">
            <span className="details-spinner" aria-hidden="true" />
            Caricamento analisi dell’indice…
          </div>
        )}
        {!['idle', 'loading', 'success'].includes(state.status) && (
          <div className="index-analysis-error">
            <div className="details-resource-message" data-status={state.status} role="status">
              {state.message ?? 'Indice non disponibile.'}
            </div>
            {canRetry && (
              <button className="details-retry-button" type="button" onClick={retry}>
                <RefreshCw size={15} aria-hidden="true" />
                Riprova
              </button>
            )}
          </div>
        )}

        {state.status === 'success' && state.data && (
          <>
            <section className="index-score-section" aria-label="Punteggi indice">
              <div>
                <span>Porcini</span>
                <strong>{formatScore(state.data.porciniScore)}</strong>
                <small>/100</small>
              </div>
              <div>
                <span>Finferli</span>
                <strong>{formatScore(state.data.finferliScore)}</strong>
                <small>/100</small>
              </div>
            </section>

            <div className="index-species-switch" aria-label="Specie da analizzare">
              <button
                type="button"
                className={species === 'porcini' ? 'active' : ''}
                onClick={() => setSpecies('porcini')}
              >
                Porcini
              </button>
              <button
                type="button"
                className={species === 'finferli' ? 'active' : ''}
                onClick={() => setSpecies('finferli')}
              >
                Finferli
              </button>
            </div>

            {species === 'finferli' ? (
              <section className="index-finferli-notice">
                <h2>Diagnostica non ancora disponibile</h2>
                <p>
                  Il punteggio finferli è disponibile per questa cella, ma il backend non
                  pubblica ancora i fattori diagnostici necessari a spiegarlo.
                </p>
              </section>
            ) : (
              <>

                <FactorList
                  title="Fattori favorevoli"
                  tone="favorable"
                  factors={analysis?.favorable ?? []}
                />
                <FactorList
                  title="Fattori sfavorevoli"
                  tone="unfavorable"
                  factors={analysis?.unfavorable ?? []}
                />
                <p className="index-analysis-disclaimer">
                  La dinamica temporale, quando disponibile, descrive il profilo interno del
                  modello: non è una previsione certa. La fase non viene dedotta dalle
                  condizioni di sviluppo.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
