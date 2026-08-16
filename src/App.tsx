import React from 'react';
import { createRoot } from 'react-dom/client';
import maplibregl, { type GeoJSONSource, type Map } from 'maplibre-gl';
import { CalendarDays, ChevronLeft, ChevronRight, CircleUserRound, Crosshair, Layers, LocateFixed, PanelLeftClose, Palette, Pencil, RefreshCw } from 'lucide-react';
import { AccountArchiveDrawer } from './account/AccountArchiveDrawer';
import { GpxTrackEditor } from './account/GpxTrackEditor';
import { buildTrackFeatures, getActiveDraft, getTrackVisibleBbox, isTrackEditable } from './account/trackEditing';
import type { CloudMapTrack } from './account/types';
import { useAccountSession } from './account/useAccountSession';
import { IndexAnalysisDrawer } from './indexData/IndexAnalysisDrawer';
import { IndexPopupContent } from './indexData/IndexPopupContent';
import { DEFAULT_TILE_SET, getAvailableTileSets, tileUrl } from './supabaseTiles';
import { PLACE_LABEL_LAYER_ID, SATELLITE_STYLE } from './mapStyle';
import { installTouchLongPress } from './mapLongPress';
import { PointDetailsDrawer } from './pointDetails/PointDetailsDrawer';
import type { MapPoint } from './pointDetails/types';
import type { ActiveLayer, LocationStatus, Species, TileSet } from './types';

const DEFAULT_CENTER: [number, number] = [11.05, 46.18];
const TILE_SOURCE_ID = 'funghi-index-source';
const TILE_LAYER_ID = 'funghi-index-layer';
const USER_SOURCE_ID = 'user-location-source';
const USER_LAYER_ID = 'user-location-layer';
const GPX_SOURCE_ID = 'cloud-gpx-source';
const GPX_EXCLUDED_LAYER_ID = 'cloud-gpx-excluded';
const GPX_OUTLINE_LAYER_ID = 'cloud-gpx-outline';
const GPX_LAYER_ID = 'cloud-gpx-line';
const GPX_FINDINGS_LAYER_ID = 'cloud-gpx-findings';
const GPX_CLOUD_MARKERS_LAYER_ID = 'cloud-gpx-cloud-markers';
const GPX_CLOUD_MARKER_LABELS_LAYER_ID = 'cloud-gpx-cloud-marker-labels';
const GPX_SELECTED_POINT_LAYER_ID = 'cloud-gpx-selected-point';
const GPX_ENDPOINTS_LAYER_ID = 'cloud-gpx-endpoints';

const OPACITY_STEPS = [25, 50, 75, 100] as const;
const LEGEND_STOPS = [
  { value: '0', label: 'assenza', color: 'rgba(255, 255, 255, 0)' },
  { value: '15', label: 'tracce', color: 'rgba(180, 230, 255, 0.59)' },
  { value: '30', label: 'presenza debole', color: 'rgba(100, 200, 255, 0.78)' },
  { value: '45', label: 'presenza debole', color: 'rgba(80, 180, 90, 1)' },
  { value: '60', label: 'presenza moderata', color: 'rgba(255, 230, 70, 1)' },
  { value: '75', label: 'presenza intensa', color: 'rgba(255, 120, 60, 1)' },
  { value: '90', label: 'presenza abbondante', color: 'rgba(210, 60, 40, 1)' },
  { value: '100', label: 'presenza abbondante', color: 'rgba(120, 78, 42, 1)' },
] as const;

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
  const [selectedMapPoint, setSelectedMapPoint] = React.useState<MapPoint | null>(null);
  const [detailsPoint, setDetailsPoint] = React.useState<MapPoint | null>(null);
  const [analysisPoint, setAnalysisPoint] = React.useState<MapPoint | null>(null);
  const [accountArchiveOpen, setAccountArchiveOpen] = React.useState(false);
  const accountSession = useAccountSession();
  const [cloudTracks, setCloudTracks] = React.useState<CloudMapTrack[]>([]);
  const [editingTrackId, setEditingTrackId] = React.useState<string | null>(null);
  const [selectedEditPointIndex, setSelectedEditPointIndex] = React.useState<number | null>(null);
  const cloudTracksRef = React.useRef<CloudMapTrack[]>([]);
  const editingTrackIdRef = React.useRef<string | null>(null);

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
  const [legendOpen, setLegendOpen] = React.useState(false);
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

  React.useEffect(() => { cloudTracksRef.current = cloudTracks; }, [cloudTracks]);
  React.useEffect(() => { editingTrackIdRef.current = editingTrackId; }, [editingTrackId]);
  React.useEffect(() => {
    const canvas = mapRef.current?.getCanvas();
    if (canvas) canvas.style.cursor = editingTrackId ? 'crosshair' : '';
  }, [editingTrackId]);

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
    let suppressMapClickUntil = 0;
    const selectNearestEditingPoint = (screenPoint: { x: number; y: number }, threshold: number): boolean => {
      const trackId = editingTrackIdRef.current;
      const track = trackId ? cloudTracksRef.current.find((candidate) => candidate.id === trackId) : null;
      if (!track) return false;
      const draft = getActiveDraft(track);
      let nearestIndex: number | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const point of track.data.trackPoints) {
        if (point.pointIndex < draft.trimStart || point.pointIndex > draft.trimEnd) continue;
        const projected = map.project(point.coordinate);
        const distance = Math.hypot(projected.x - screenPoint.x, projected.y - screenPoint.y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = point.pointIndex;
        }
      }
      if (nearestIndex === null || nearestDistance > threshold) return false;
      setSelectedEditPointIndex(nearestIndex);
      setSelectedMapPoint(null);
      return true;
    };
    map.on('click', (event) => {
      if (Date.now() < suppressMapClickUntil) return;
      if (editingTrackIdRef.current) {
        selectNearestEditingPoint(event.point, 30);
        return;
      }
      setSelectedMapPoint(null);
    });
    map.on('contextmenu', (event) => {
      event.originalEvent.preventDefault();
      setSelectedMapPoint({ longitude: event.lngLat.lng, latitude: event.lngLat.lat });
    });

    const canvas = map.getCanvas();
    const removeLongPress = installTouchLongPress(canvas, ({ clientX, clientY }) => {
      suppressMapClickUntil = Date.now() + 1_000;
      const bounds = canvas.getBoundingClientRect();
      const screenPoint = { x: clientX - bounds.left, y: clientY - bounds.top };
      if (editingTrackIdRef.current) {
        selectNearestEditingPoint(screenPoint, 38);
        return;
      }
      const lngLat = map.unproject([screenPoint.x, screenPoint.y]);
      setSelectedMapPoint({ longitude: lngLat.lng, latitude: lngLat.lat });
    });
    mapRef.current = map;

    return () => {
      removeLongPress();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selectedMapPoint) return;

    const container = document.createElement('div');
    const popup = new maplibregl.Popup({
      className: 'coordinate-map-popup',
      closeButton: false,
      closeOnClick: false,
      maxWidth: 'none',
      offset: 14,
    })
      .setLngLat([selectedMapPoint.longitude, selectedMapPoint.latitude])
      .setDOMContent(container)
      .addTo(map);
    const root = createRoot(container);
    root.render(
      <IndexPopupContent
        point={selectedMapPoint}
        onClose={() => popup.remove()}
        onShowData={() => {
          setAccountArchiveOpen(false);
          setAnalysisPoint(null);
          setDetailsPoint(selectedMapPoint);
        }}
        onShowAnalysis={() => {
          setAccountArchiveOpen(false);
          setDetailsPoint(null);
          setAnalysisPoint(selectedMapPoint);
        }}
      />,
    );

    let cleaningUp = false;
    popup.on('close', () => {
      if (!cleaningUp) setSelectedMapPoint(null);
    });

    return () => {
      cleaningUp = true;
      root.unmount();
      popup.remove();
    };
  }, [mapReady, selectedMapPoint]);

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
      minzoom: 3,
      maxzoom: 13,
    });
    map.addLayer({
      id: TILE_LAYER_ID,
      type: 'raster',
      source: TILE_SOURCE_ID,
      paint: {
        'raster-opacity': opacity,
      },
    }, PLACE_LABEL_LAYER_ID);
  }, [activeLayer, mapReady, selectedDate, selectedTileSet, selectedVersion]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer(TILE_LAYER_ID)) return;
    map.setPaintProperty(TILE_LAYER_ID, 'raster-opacity', opacity);
  }, [mapReady, opacity]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const selectedEditingTrack = editingTrackId ? cloudTracks.find((track) => track.id === editingTrackId) : null;
    const selectedEditingCoordinate = selectedEditingTrack && selectedEditPointIndex !== null
      ? selectedEditingTrack.data.trackPoints.find((point) => point.pointIndex === selectedEditPointIndex)?.coordinate
      : undefined;
    const collection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        ...cloudTracks.flatMap((track, index) => buildTrackFeatures(track, index)),
        ...(selectedEditingCoordinate ? [{
          type: 'Feature' as const,
          properties: { kind: 'selected-edit-point', pointIndex: selectedEditPointIndex },
          geometry: { type: 'Point' as const, coordinates: selectedEditingCoordinate },
        }] : []),
      ],
    };
    const layerIds = [GPX_SELECTED_POINT_LAYER_ID, GPX_CLOUD_MARKER_LABELS_LAYER_ID, GPX_CLOUD_MARKERS_LAYER_ID, GPX_FINDINGS_LAYER_ID, GPX_ENDPOINTS_LAYER_ID, GPX_LAYER_ID, GPX_OUTLINE_LAYER_ID, GPX_EXCLUDED_LAYER_ID];
    if (cloudTracks.length === 0) {
      layerIds.forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource(GPX_SOURCE_ID)) map.removeSource(GPX_SOURCE_ID);
      return;
    }
    const source = map.getSource(GPX_SOURCE_ID) as GeoJSONSource | undefined;
    if (source) { source.setData(collection); return; }
    map.addSource(GPX_SOURCE_ID, { type: 'geojson', data: collection });
    const keptFilter: maplibregl.FilterSpecification = ['==', ['get', 'kind'], 'kept-line'];
    map.addLayer({ id: GPX_EXCLUDED_LAYER_ID, type: 'line', source: GPX_SOURCE_ID, filter: ['==', ['get', 'kind'], 'excluded-line'], paint: { 'line-color': '#c9cfca', 'line-width': 3, 'line-opacity': 0.65, 'line-dasharray': [1.4, 1.4] } }, PLACE_LABEL_LAYER_ID);
    map.addLayer({ id: GPX_OUTLINE_LAYER_ID, type: 'line', source: GPX_SOURCE_ID, filter: keptFilter, paint: { 'line-color': '#102016', 'line-width': 5, 'line-opacity': 0.85 } }, PLACE_LABEL_LAYER_ID);
    map.addLayer({ id: GPX_LAYER_ID, type: 'line', source: GPX_SOURCE_ID, filter: keptFilter, paint: { 'line-color': ['match', ['%', ['get', 'colorIndex'], 4], 0, '#79e06e', 1, '#56b4ff', 2, '#d99cff', '#ffd166'], 'line-width': 3, 'line-opacity': 0.95 } }, PLACE_LABEL_LAYER_ID);
    map.addLayer({ id: GPX_FINDINGS_LAYER_ID, type: 'circle', source: GPX_SOURCE_ID, filter: ['==', ['get', 'kind'], 'finding'], paint: { 'circle-radius': 6, 'circle-color': ['match', ['get', 'species'], 'porcino', '#8b5a2b', '#f2b84b'], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
    map.addLayer({ id: GPX_CLOUD_MARKERS_LAYER_ID, type: 'circle', source: GPX_SOURCE_ID, filter: ['==', ['get', 'kind'], 'cloud-marker'], paint: { 'circle-radius': 10, 'circle-color': ['match', ['get', 'markerSpecies'], 'porcini', '#8b5a2b', 'finferli', '#f2b84b', '#6f4c9b'], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff4dc' } });
    map.addLayer({ id: GPX_CLOUD_MARKER_LABELS_LAYER_ID, type: 'symbol', source: GPX_SOURCE_ID, filter: ['==', ['get', 'kind'], 'cloud-marker'], layout: { 'text-field': ['get', 'countLabel'], 'text-size': 10, 'text-allow-overlap': true }, paint: { 'text-color': '#fff' } });
    map.addLayer({ id: GPX_SELECTED_POINT_LAYER_ID, type: 'circle', source: GPX_SOURCE_ID, filter: ['==', ['get', 'kind'], 'selected-edit-point'], paint: { 'circle-radius': 6, 'circle-color': '#ffffff', 'circle-opacity': 0.92, 'circle-stroke-width': 3, 'circle-stroke-color': '#1677ff' } });
    map.addLayer({ id: GPX_ENDPOINTS_LAYER_ID, type: 'symbol', source: GPX_SOURCE_ID, filter: ['in', ['get', 'kind'], ['literal', ['start', 'end']]], layout: { 'text-field': '■', 'text-size': 14, 'text-allow-overlap': true }, paint: { 'text-color': ['match', ['get', 'kind'], 'start', '#00d94f', '#ff2f3d'], 'text-halo-width': 1.5, 'text-halo-color': '#ffffff' } });
  }, [cloudTracks, editingTrackId, mapReady, selectedEditPointIndex]);

  React.useEffect(() => { if (!accountSession.session) { setCloudTracks([]); setEditingTrackId(null); } }, [accountSession.session]);

  const showCloudTrack = React.useCallback((track: CloudMapTrack) => {
    setCloudTracks((current) => [...current.filter((item) => item.id !== track.id), track]);
  }, []);

  const beginEditingTrack = React.useCallback((track: CloudMapTrack) => {
    setCloudTracks((current) => [...current.filter((item) => item.id !== track.id), track]);
    setSelectedEditPointIndex(null);
    setEditingTrackId(track.id);
  }, []);

  const focusCloudTrack = React.useCallback((track: CloudMapTrack) => {
    const map = mapRef.current; if (!map) return;
    const [west, south, east, north] = getTrackVisibleBbox(track);
    if (west === east && south === north) map.easeTo({ center: [west, south], zoom: Math.max(map.getZoom(), 14), duration: 700 });
    else map.fitBounds([[west, south], [east, north]], { padding: 70, maxZoom: 15, duration: 700 });
  }, []);
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

  const editingTrack = cloudTracks.find((track) => track.id === editingTrackId) ?? null;

  return (
    <main className="app-shell">
      <div ref={mapContainerRef} className="map-canvas" />
      <div className="app-banner" aria-hidden="true">
        Indice Funghi
      </div>
      {cloudTracks.length > 0 && (
        <aside className="cloud-tracks-panel" aria-label="Percorsi sulla mappa">
          <header><span><small>Sulla mappa</small><strong>{cloudTracks.length} {cloudTracks.length === 1 ? 'percorso' : 'percorsi'}</strong></span><button type="button" onClick={() => { setCloudTracks([]); setEditingTrackId(null); }}>Rimuovi tutti</button></header>
          <ul>{cloudTracks.map((track) => <li key={track.id}>
            <button type="button" onClick={() => focusCloudTrack(track)}><span className="cloud-track-dot" aria-hidden="true" />{track.name}</button>
            <div className="cloud-track-counts"><span>Porcini {track.data.porciniCount}</span><span>Finferli {track.data.finferliCount}</span></div>
            <button className="cloud-track-edit" type="button" disabled={!isTrackEditable(track)} title={isTrackEditable(track) ? 'Modifica percorso' : 'Editing non disponibile'} aria-label={'Modifica ' + track.name} onClick={() => { setSelectedEditPointIndex(null); setEditingTrackId(track.id); }}><Pencil size={15} /></button>
            <button type="button" aria-label={'Rimuovi ' + track.name + ' dalla mappa'} onClick={() => { setCloudTracks((current) => current.filter((item) => item.id !== track.id)); if (editingTrackId === track.id) setEditingTrackId(null); }}>×</button>
          </li>)}</ul>
        </aside>
      )}
      {editingTrack && <GpxTrackEditor
        track={editingTrack}
        selectedPointIndex={selectedEditPointIndex}
        onSelectedPointChange={setSelectedEditPointIndex}
        onPreview={(preview) => setCloudTracks((current) => current.map((track) => track.id === editingTrack.id ? { ...track, preview } : track))}
        onCancel={() => {
          setCloudTracks((current) => current.map((track) => { if (track.id !== editingTrack.id) return track; const { preview: _preview, ...rest } = track; return rest; }));
          setEditingTrackId(null);
          setSelectedEditPointIndex(null);
        }}
        onSaved={(updatedTrack, markers) => {
          setCloudTracks((current) => current.map((track) => track.id === editingTrack.id ? { ...track, track: updatedTrack, markers, preview: undefined } : track));
          setEditingTrackId(null);
          setSelectedEditPointIndex(null);
        }}
      />}
      <button
        className={`account-launcher${accountSession.session ? ' is-authenticated' : ''}`}
        type="button"
        onClick={() => setAccountArchiveOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={accountArchiveOpen}
        aria-label={accountSession.session
          ? `Apri il profilo di ${accountSession.username ?? 'utente'}`
          : 'Accedi o registrati'}
      >
        <span className="account-launcher-icon" aria-hidden="true">
          <CircleUserRound size={22} />
        </span>
        <span className="account-launcher-copy">
          <small>{accountSession.session ? 'Profilo' : 'FunghiTracker'}</small>
          <strong>{accountSession.session ? accountSession.username ?? 'ACCOUNT' : 'ACCEDI'}</strong>
        </span>
      </button>

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

      <button
        className="legend-toggle"
        type="button"
        onClick={() => setLegendOpen((open) => !open)}
        aria-expanded={legendOpen}
        aria-controls="index-legend-panel"
        title={legendOpen ? 'Nascondi legenda' : 'Mostra legenda'}
      >
        <Palette size={17} aria-hidden="true" />
        <span>Legenda</span>
      </button>

      <aside
        id="index-legend-panel"
        className={`legend-panel${legendOpen ? '' : ' collapsed'}`}
        aria-label="Legenda colori indice"
        aria-hidden={!legendOpen}
      >
        <div className="legend-head">
          <strong>Indice</strong>
          <button className="legend-close" type="button" onClick={() => setLegendOpen(false)} title="Nascondi legenda">
            ×
          </button>
        </div>
        <div className="legend-scale" aria-hidden="true">
          {LEGEND_STOPS.map((stop) => (
            <span key={stop.value} style={{ background: stop.color }} />
          ))}
        </div>
        <div className="legend-labels">
          {LEGEND_STOPS.map((stop) => (
            <div key={stop.value}>
              <span>{stop.value}</span>
              <strong>{stop.label}</strong>
            </div>
          ))}
        </div>
      </aside>

      <section
        id="index-control-panel"
        className={`control-panel${panelOpen ? '' : ' collapsed'}`}
        aria-label="Controlli indice funghi"
        aria-hidden={!panelOpen}
      >
        <header className="panel-header">
          <div>
            <p className="eyebrow">Indice funghi</p>
          </div>
          <button className="icon-button" type="button" onClick={() => loadTileSets()} title="Aggiorna tileset">
            <RefreshCw size={18} aria-hidden="true" />
          </button>
        </header>


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

        <div className="status-strip" data-tone={tilesError ? 'error' : tilesLoading ? 'loading' : 'ready'}>
          {tilesLoading
            ? 'Caricamento archivio date'
            : tilesError
              ? 'Errore lettura archivio date'
              : `${availableDates.length} date in archivio`}
        </div>
        {tilesError && <p className="error-text">{tilesError}</p>}

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

        <button className="locate-button" type="button" onClick={locateUser} title={locationMessage(locationStatus)}>
          <LocateFixed size={17} aria-hidden="true" />
          Centra posizione
        </button>

      </section>
      {detailsPoint && (
        <PointDetailsDrawer point={detailsPoint} onClose={() => setDetailsPoint(null)} />
      )}
      {analysisPoint && (
        <IndexAnalysisDrawer
          point={analysisPoint}
          initialSpecies={activeLayer === 'finferli' ? 'finferli' : 'porcini'}
          onClose={() => setAnalysisPoint(null)}
        />
      )}
      {accountArchiveOpen && (
        <AccountArchiveDrawer sessionState={accountSession} onClose={() => setAccountArchiveOpen(false)} onShowTrack={showCloudTrack} onEditTrack={beginEditingTrack} visibleTrackIds={new Set(cloudTracks.map((track) => track.id))} onHideTrack={(id) => setCloudTracks((current) => current.filter((item) => item.id !== id))} onTrackRenamed={(id, name) => setCloudTracks((current) => current.map((item) => item.id === id ? { ...item, name } : item))} onTrackDeleted={(id) => setCloudTracks((current) => current.filter((item) => item.id !== id))} />
      )}
    </main>
  );
}

export default App;
