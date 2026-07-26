import React from 'react';
import { ArrowLeft, RefreshCw, X } from 'lucide-react';
import './details.css';
import { lastAvailableDayIndex } from './decoders';
import {
  formatDecimal,
  formatInteger,
  formatLongDate,
  formatPeriod,
} from './formatters';
import { aspectDirection, tpiLabel } from './geo';
import type { MapPoint, ResourceState, TerrainPointData, WeatherPointData } from './types';
import { usePointDetails } from './usePointDetails';
import { WeatherCharts } from './WeatherCharts';

function ResourceMessage<T>(props: {
  state: ResourceState<T>;
  loadingLabel: string;
  unavailableLabel: string;
}) {
  const { state, loadingLabel, unavailableLabel } = props;
  if (state.status === 'success') return null;
  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div className="details-resource-message" data-status="loading" role="status">
        <span className="details-spinner" aria-hidden="true" />
        {loadingLabel}
      </div>
    );
  }
  return (
    <div className="details-resource-message" data-status={state.status} role="status">
      {state.message ?? unavailableLabel}
    </div>
  );
}

function TerrainSection(props: { state: ResourceState<TerrainPointData> }) {
  const { state } = props;
  return (
    <section className="details-section" aria-labelledby="terrain-title">
      <div className="details-section-heading">
        <h2 id="terrain-title">Terreno</h2>
        {state.status === 'success' && <span>Griglia 0,003°</span>}
      </div>
      <ResourceMessage
        state={state}
        loadingLabel="Caricamento dati del terreno…"
        unavailableLabel="Dati del terreno non disponibili."
      />
      {state.status === 'success' && state.data && (
        <dl className="terrain-values">
          <div>
            <dt>Quota</dt>
            <dd>{formatInteger(state.data.elevation, 'm')}</dd>
          </div>
          <div>
            <dt>Foresta</dt>
            <dd>{formatInteger(state.data.forestPercent, '%')}</dd>
          </div>
          <div>
            <dt>Esposizione</dt>
            <dd>
              {state.data.aspectDegrees === null
                ? 'Non disponibile'
                : `${aspectDirection(state.data.aspectDegrees)} · ${Math.round(state.data.aspectDegrees)}°`}
            </dd>
          </div>
          <div>
            <dt>Posizione topografica</dt>
            <dd>{tpiLabel(state.data.tpiCategory)}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function SelectedDayStrip(props: {
  weather: WeatherPointData;
  selectedDateIndex: number;
}) {
  const { weather, selectedDateIndex } = props;
  const day = weather.days[selectedDateIndex];

  return (
    <section className="selected-day-section" aria-labelledby="selected-day-title">
      <div className="selected-day-heading">
        <div>
          <span>Giorno selezionato</span>
          <h2 id="selected-day-title">{formatLongDate(day.date)}</h2>
        </div>
        {day.missing && <strong>Dati mancanti</strong>}
      </div>
      <dl className="selected-day-values">
        <div>
          <dt>Minima</dt>
          <dd data-color="minimum">{formatDecimal(day.temperatureMin, '°C')}</dd>
        </div>
        <div>
          <dt>Massima</dt>
          <dd data-color="maximum">{formatDecimal(day.temperatureMax, '°C')}</dd>
        </div>
        <div>
          <dt>Pioggia</dt>
          <dd data-color="precipitation">{formatDecimal(day.precipitation, 'mm')}</dd>
        </div>
        <div>
          <dt>Umidità</dt>
          <dd data-color="humidity">{formatDecimal(day.humidity, '%')}</dd>
        </div>
        <div>
          <dt>Raffiche</dt>
          <dd data-color="gust">{formatDecimal(day.gust, 'km/h')}</dd>
        </div>
      </dl>
    </section>
  );
}

export function PointDetailsDrawer(props: {
  point: MapPoint;
  onClose: () => void;
}) {
  const { point, onClose } = props;
  const { weather, terrain, retry } = usePointDetails(point, true);
  const [selectedDateIndex, setSelectedDateIndex] = React.useState(0);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
    };
  }, [onClose]);

  React.useEffect(() => {
    if (weather.status === 'success' && weather.data) {
      setSelectedDateIndex(lastAvailableDayIndex(weather.data.days));
    }
  }, [weather.data, weather.status]);

  const weatherDates = weather.status === 'success' && weather.data ? weather.data.days.map((day) => day.date) : [];
  const canRetry = [weather.status, terrain.status].some(
    (status) => status === 'error' || status === 'unavailable',
  );

  return (
    <aside
      className="point-details-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="point-details-title"
    >
      <header className="point-details-header">
        <div>
          <p>Analisi locale</p>
          <h1 id="point-details-title">Dettagli del punto</h1>
        </div>
        <button
          ref={closeButtonRef}
          className="details-close-button"
          type="button"
          onClick={onClose}
          aria-label="Chiudi dettagli del punto"
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
          <span>Periodo</span>
          <strong>{weatherDates.length > 0 ? formatPeriod(weatherDates) : 'Ultimi 20 giorni'}</strong>
        </div>
        <p>Dati della cella meteorologica più vicina · risoluzione circa 2 km</p>
      </div>

      <div className="point-details-content">
        {canRetry && (
          <button className="details-retry-button" type="button" onClick={retry}>
            <RefreshCw size={15} aria-hidden="true" />
            Riprova
          </button>
        )}

        <TerrainSection state={terrain} />

        <section className="details-section weather-details-section" aria-labelledby="weather-title">
          <div className="details-section-heading">
            <h2 id="weather-title">Meteo</h2>
            {weather.status === 'success' && weather.data && (
              <span>{weather.data.availableDayCount}/20 giorni disponibili</span>
            )}
          </div>
          <ResourceMessage
            state={weather}
            loadingLabel="Caricamento ultimi 20 giorni…"
            unavailableLabel="Dati meteo non disponibili."
          />
          {weather.status === 'success' && weather.data && (
            <>
              {weather.data.missingDates.length > 0 && (
                <p className="missing-days-note">
                  Giorni mancanti:{' '}
                  {weather.data.missingDates.map((date) => formatLongDate(date)).join(', ')}
                </p>
              )}
              <SelectedDayStrip weather={weather.data} selectedDateIndex={selectedDateIndex} />
              <WeatherCharts
                days={weather.data.days}
                selectedDateIndex={selectedDateIndex}
                onSelectDateIndex={setSelectedDateIndex}
              />
            </>
          )}
        </section>
      </div>
    </aside>
  );
}
