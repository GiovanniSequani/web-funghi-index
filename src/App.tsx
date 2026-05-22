import React from 'react';
import maplibregl, { type GeoJSONSource, type Map } from 'maplibre-gl';
import { CalendarDays, ChevronLeft, ChevronRight, Crosshair, Layers, LocateFixed, PanelLeftClose, RefreshCw } from 'lucide-react';
import { DEFAULT_TILE_SET, getAvailableTileSets, tileUrl } from './supabaseTiles';
import { SATELLITE_STYLE } from './mapStyle';
import type { ActiveLayer, LocationStatus, Species, TileSet } from './types';

const DEFAULT_CENTER: [number, number] = [11.05, 46.18];
const TILE_SOURCE_ID = 'funghi-index-source';
const TILE_LAYER_ID = 'funghi-index-layer';
const USER_SOURCE_ID = 'user-location-source';
const USER_LAYER_ID = 'user-location-layer';

const OPACITY_STEPS = [25, 50, 75, 100] as const;

function tileKey(tileSet: TileSet): string {
  return `${tileSet.date}_v${tileSet.version}`;
}

function uniqueDates(tileSets: TileSet[]): string[] {
  return [...new Set(tileSets.map((tileSet) => tileSet.date))];
}

function versionsForDate(tileSets: TileSet[], date: string): string[] {
  return tileSets.filter((tileSet) => tileSet.date === date).map((tileSet) => tileSet.version);
}

function parseTileDate(date: string): Date | null {
  const match = date.match(/^(\d{4})[-_](\d{2})[-_](\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function calendarKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function normalizeDateKey(date: string): string {
  return date.replace(/_/g, '-');
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(date);
}

function buildCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const daysBefore = (first.getDay() + 6) % 7;
  const daysAfter = 6 - ((last.getDay() + 6) % 7);
  const start = new Date(year, month, 1 - daysBefore);
  const total = daysBefore + last.getDate() + daysAfter;

  return Array.from({ length: total }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return {
      date: day,
      key: calendarKey(day),
      inCurrentMonth: day.getMonth() === month,
    };
  });
}

function locationMessage(status: LocationStatus): string {
  switch (status) {
    case 'loading':
      return 'Ricerca posizione';
    case 'ready':
      return 'Posizione centrata';
    case 'denied':
      return 'Permesso posizione negato';
    case 'error':
      return 'Posizione non disponibile';
    case 'unsupported':
      return 'Geolocalizzazione non supportata';
    default:
      return 'Posizione non richiesta';
  }
}

function App() {
  const mapContainerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<Map | null>(null);
  const [mapReady, setMapReady] = React.useState(false);

  const [activeLayer, setActiveLayer] = React.useState<ActiveLayer>('off');
  const [tileSets, setTileSets] = React.useState<TileSet[]>([]);
  const [selectedDate, setSelectedDate] = React.useState(DEFAULT_TILE_SET.date);
  const [selectedVersion, setSelectedVersion] = React.useState(DEFAULT_TILE_SET.version);
  const [opacityPercent, setOpacityPercent] = React.useState<(typeof OPACITY_STEPS)[number]>(75);
  const [tilesLoading, setTilesLoading] = React.useState(true);
  const [tilesError, setTilesError] = React.useState<string | null>(null);
  const [locationStatus, setLocationStatus] = React.useState<LocationStatus>('idle');
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [panelOpen, setPanelOpen] = React.useState(true);
  const [calendarMonth, setCalendarMonth] = React.useState(() => parseTileDate(DEFAULT_TILE_SET.date) ?? new Date());

  const selectedTileSet = React.useMemo<TileSet>(
    () => ({ date: selectedDate, version: selectedVersion }),
    [selectedDate, selectedVersion],
  );
  const availableDates = React.useMemo(() => uniqueDates(tileSets), [tileSets]);
  const availableVersions = React.useMemo(
    () => versionsForDate(tileSets, selectedDate),
    [selectedDate, tileSets],
  );
  const selectedTileIndex = React.useMemo(
    () => tileSets.findIndex((tileSet) => tileSet.date === selectedDate && tileSet.version === selectedVersion),
    [selectedDate, selectedVersion, tileSets],
  );
  const availableDateKeys = React.useMemo(
    () => new Set(tileSets.map((tileSet) => normalizeDateKey(tileSet.date))),
    [tileSets],
  );
  const calendarDays = React.useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const opacity = opacityPercent / 100;

  const loadTileSets = React.useCallback(async (signal?: AbortSignal) => {
    setTilesLoading(true);
    setTilesError(null);

    try {
      const available = await getAvailableTileSets(signal);
      if (available.length === 0) {
        throw new Error('Nessun tileset valido trovato in tiles/');
      }

      const latest = available[0];
      setTileSets(available);
      setSelectedDate(latest.date);
      setSelectedVersion(latest.version);
      setCalendarMonth(parseTileDate(latest.date) ?? new Date());
    } catch (error) {
      if (signal?.aborted) return;
      setTileSets([]);
      setSelectedDate(DEFAULT_TILE_SET.date);
      setSelectedVersion(DEFAULT_TILE_SET.version);
      setTilesError(error instanceof Error ? error.message : 'Errore caricamento tiles');
    } finally {
      if (!signal?.aborted) setTilesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    void loadTileSets(controller.signal);
    return () => controller.abort();
  }, [loadTileSets]);

  React.useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: SATELLITE_STYLE,
      center: DEFAULT_CENTER,
      zoom: 9,
      minZoom: 6,
      maxZoom: 15,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');
    map.on('load', () => setMapReady(true));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (map.getLayer(TILE_LAYER_ID)) map.removeLayer(TILE_LAYER_ID);
    if (map.getSource(TILE_SOURCE_ID)) map.removeSource(TILE_SOURCE_ID);

    if (activeLayer === 'off' || !selectedDate || !selectedVersion) return;

    const species = activeLayer as Species;
    map.addSource(TILE_SOURCE_ID, {
      type: 'raster',
      tiles: [tileUrl(species, selectedTileSet)],
      tileSize: 256,
      minzoom: 8,
      maxzoom: 14,
    });
    map.addLayer({
      id: TILE_LAYER_ID,
      type: 'raster',
      source: TILE_SOURCE_ID,
      paint: {
        'raster-opacity': opacity,
      },
    });
  }, [activeLayer, mapReady, selectedDate, selectedTileSet, selectedVersion]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer(TILE_LAYER_ID)) return;
    map.setPaintProperty(TILE_LAYER_ID, 'raster-opacity', opacity);
  }, [mapReady, opacity]);

  const selectDate = (date: string) => {
    setSelectedDate(date);
    const nextVersion = versionsForDate(tileSets, date)[0] ?? DEFAULT_TILE_SET.version;
    setSelectedVersion(nextVersion);
    setCalendarMonth(parseTileDate(date) ?? calendarMonth);
  };

  const selectTileSet = (tileSet: TileSet) => {
    setSelectedDate(tileSet.date);
    setSelectedVersion(tileSet.version);
    setCalendarMonth(parseTileDate(tileSet.date) ?? calendarMonth);
  };

  const moveDataset = (direction: -1 | 1) => {
    if (tileSets.length === 0) return;
    const currentIndex = selectedTileIndex >= 0 ? selectedTileIndex : 0;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= tileSets.length) return;
    selectTileSet(tileSets[nextIndex]);
  };

  const moveCalendarMonth = (direction: -1 | 1) => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  const selectCalendarDay = (key: string) => {
    const tileSet = tileSets.find((candidate) => normalizeDateKey(candidate.date) === key);
    if (!tileSet) return;
    selectTileSet(tileSet);
    setCalendarOpen(false);
  };

  const locateUser = () => {
    const map = mapRef.current;

    if (!navigator.geolocation) {
      setLocationStatus('unsupported');
      return;
    }

    setLocationStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lngLat: [number, number] = [position.coords.longitude, position.coords.latitude];
        setLocationStatus('ready');

        if (!map || !mapReady) return;

        const feature = {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: lngLat },
          properties: {},
        };

        if (map.getSource(USER_SOURCE_ID)) {
          (map.getSource(USER_SOURCE_ID) as GeoJSONSource).setData(feature);
        } else {
          map.addSource(USER_SOURCE_ID, { type: 'geojson', data: feature });
          map.addLayer({
            id: USER_LAYER_ID,
            type: 'circle',
            source: USER_SOURCE_ID,
            paint: {
              'circle-radius': 7,
              'circle-color': '#5fc7ff',
              'circle-stroke-width': 3,
              'circle-stroke-color': '#ffffff',
            },
          });
        }

        map.easeTo({ center: lngLat, zoom: Math.max(map.getZoom(), 12), duration: 900 });
      },
      (error) => {
        setLocationStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  return (
    <main className="app-shell">
      <div ref={mapContainerRef} className="map-canvas" />

      <button
        className="panel-toggle"
        type="button"
        onClick={() => setPanelOpen((open) => !open)}
        aria-expanded={panelOpen}
        aria-controls="index-control-panel"
        title={panelOpen ? 'Nascondi pannello' : 'Mostra pannello'}
      >
        <PanelLeftClose size={18} aria-hidden="true" />
        <span>{panelOpen ? 'Nascondi' : 'Indice'}</span>
      </button>

      <section
        id="index-control-panel"
        className={`control-panel${panelOpen ? '' : ' collapsed'}`}
        aria-label="Controlli indice funghi"
        aria-hidden={!panelOpen}
      >
        <header className="panel-header">
          <div>
            <p className="eyebrow">Indice funghi</p>
            <h1>Alpi nord-est</h1>
          </div>
          <button className="icon-button" type="button" onClick={() => loadTileSets()} title="Aggiorna tileset">
            <RefreshCw size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="status-strip" data-tone={tilesError ? 'error' : tilesLoading ? 'loading' : 'ready'}>
          {tilesLoading ? 'Caricamento tileset' : tilesError ? 'Errore lettura tileset' : `${tileSets.length} tileset disponibili`}
        </div>

        <div className="field-group">
          <span className="label-row">
            <Layers size={15} aria-hidden="true" />
            Layer
          </span>
          <div className="segmented three">
            <button type="button" className={activeLayer === 'off' ? 'active' : ''} onClick={() => setActiveLayer('off')}>
              Off
            </button>
            <button
              type="button"
              className={activeLayer === 'porcini' ? 'active porcini' : ''}
              onClick={() => setActiveLayer('porcini')}
            >
              Porcini
            </button>
            <button
              type="button"
              className={activeLayer === 'finferli' ? 'active finferli' : ''}
              onClick={() => setActiveLayer('finferli')}
            >
              Finferli
            </button>
          </div>
        </div>

        <div className="dataset-picker">
          <span className="label-row">
            <CalendarDays size={15} aria-hidden="true" />
            Dataset
          </span>
          <div className="dataset-stepper">
            <button
              className="icon-button"
              type="button"
              onClick={() => moveDataset(1)}
              disabled={tileSets.length === 0 || selectedTileIndex === tileSets.length - 1}
              title="Dataset meno recente"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              className="date-button"
              type="button"
              onClick={() => setCalendarOpen((open) => !open)}
              disabled={availableDates.length === 0}
            >
              <strong>{selectedDate.replace(/_/g, '-')}</strong>
              <span>v{selectedVersion}</span>
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => moveDataset(-1)}
              disabled={tileSets.length === 0 || selectedTileIndex <= 0}
              title="Dataset piu recente"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>

          {availableVersions.length > 1 && (
            <div className="version-row" aria-label="Versioni disponibili per la data selezionata">
              {availableVersions.map((version) => (
                <button
                  key={version}
                  type="button"
                  className={selectedVersion === version ? 'active' : ''}
                  onClick={() => setSelectedVersion(version)}
                >
                  v{version}
                </button>
              ))}
            </div>
          )}

          {calendarOpen && (
            <div className="calendar-popover">
              <div className="calendar-header">
                <button className="icon-button compact" type="button" onClick={() => moveCalendarMonth(-1)} title="Mese precedente">
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <strong>{monthLabel(calendarMonth)}</strong>
                <button className="icon-button compact" type="button" onClick={() => moveCalendarMonth(1)} title="Mese successivo">
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
              <div className="calendar-weekdays" aria-hidden="true">
                {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((day, index) => (
                  <span key={`${day}-${index}`}>{day}</span>
                ))}
              </div>
              <div className="calendar-grid">
                {calendarDays.map((day) => {
                  const available = availableDateKeys.has(day.key);
                  const selected = normalizeDateKey(selectedDate) === day.key;
                  return (
                    <button
                      key={day.key}
                      type="button"
                      className={[
                        'calendar-day',
                        day.inCurrentMonth ? '' : 'muted',
                        available ? 'available' : 'unavailable',
                        selected ? 'selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => selectCalendarDay(day.key)}
                      disabled={!available}
                      title={available ? 'Indice disponibile' : 'Indice non disponibile'}
                    >
                      {day.date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="dataset-line">
          <span>Path</span>
          <strong>{tileKey(selectedTileSet)}</strong>
        </div>

        <div className="field-group">
          <span className="label-row">
            <Crosshair size={15} aria-hidden="true" />
            Opacita
          </span>
          <div className="segmented four">
            {OPACITY_STEPS.map((step) => (
              <button
                key={step}
                type="button"
                className={opacityPercent === step ? 'active' : ''}
                onClick={() => setOpacityPercent(step)}
              >
                {step}
              </button>
            ))}
          </div>
        </div>

        <button className="locate-button" type="button" onClick={locateUser}>
          <LocateFixed size={17} aria-hidden="true" />
          Centra posizione
        </button>

        <div className="info-lines">
          <div>
            <span>Mappa</span>
            <strong>{mapReady ? 'Pronta' : 'Inizializzazione'}</strong>
          </div>
          <div>
            <span>Posizione</span>
            <strong>{locationMessage(locationStatus)}</strong>
          </div>
          {tilesError && <p className="error-text">{tilesError}</p>}
        </div>
      </section>
    </main>
  );
}

export default App;
