import React from 'react';
import { Minus, Plus, RotateCcw, Save, Scissors, Trash2, X } from 'lucide-react';
import { deleteTrackMarker, getAccountSupabaseClient, loadTrackMarkers, saveTrackMarker, setTrackTrim } from './client';
import { getStoredTrim, isTrackEditable, markerKey, markerMap } from './trackEditing';
import { formatTrackDate, getTrackDateIso } from './trackDate';
import type { CloudMapTrack, GpxEditDraft, GpxMushroomMarker, GpxTrack } from './types';
import { toAccountError } from './validation';

type MarkerSpecies = GpxMushroomMarker['species'];

function sameMarker(left: GpxMushroomMarker, right: GpxMushroomMarker): boolean {
  return left.count === right.count
    && left.species === right.species
    && left.latitude === right.latitude
    && left.longitude === right.longitude;
}

export function GpxTrackEditor(props: {
  track: CloudMapTrack;
  selectedPointIndex: number | null;
  onSelectedPointChange: (pointIndex: number | null) => void;
  onPreview: (draft: GpxEditDraft) => void;
  onCancel: () => void;
  onSaved: (track: GpxTrack, markers: GpxMushroomMarker[]) => void;
}) {
  const initial = React.useMemo(() => {
    const [trimStart, trimEnd] = getStoredTrim(props.track.track, props.track.data);
    return { trimStart, trimEnd, markers: props.track.markers.map((marker) => ({ ...marker })) };
  }, [props.track.id]);
  const [draft, setDraft] = React.useState<GpxEditDraft>(initial);
  const [markerPoint, setMarkerPoint] = React.useState<number | null>(props.selectedPointIndex);
  const [markerSpecies, setMarkerSpecies] = React.useState<MarkerSpecies>('porcini');
  const [markerCount, setMarkerCount] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const editable = isTrackEditable(props.track);
  const lastPoint = Math.max(1, props.track.data.rawPointCount - 1);
  const points = React.useMemo(() => new Map(props.track.data.trackPoints.map((point) => [point.pointIndex, point.coordinate])), [props.track.data.trackPoints]);

  const previewCallback = React.useRef(props.onPreview);
  React.useEffect(() => { previewCallback.current = props.onPreview; }, [props.onPreview]);
  React.useEffect(() => { previewCallback.current(draft); }, [draft]);

  const selectPoint = React.useCallback((pointIndex: number | null, species = markerSpecies) => {
    if (pointIndex === null) {
      setMarkerPoint(null);
      props.onSelectedPointChange(null);
      return;
    }
    const bounded = Math.min(draft.trimEnd, Math.max(draft.trimStart, pointIndex));
    setMarkerPoint(bounded);
    props.onSelectedPointChange(bounded);
    const existing = draft.markers.find((marker) => marker.track_point_index === bounded && marker.species === species);
    setMarkerCount(existing?.count ?? 1);
  }, [draft.markers, draft.trimEnd, draft.trimStart, markerSpecies, props.onSelectedPointChange]);

  React.useEffect(() => {
    if (props.selectedPointIndex !== null && props.selectedPointIndex !== markerPoint) {
      selectPoint(props.selectedPointIndex);
    }
  }, [props.selectedPointIndex, markerPoint, selectPoint]);

  const updateDraft = (next: GpxEditDraft) => {
    setDraft(next);
    if (markerPoint !== null && (markerPoint < next.trimStart || markerPoint > next.trimEnd)) {
      selectPoint(Math.min(next.trimEnd, Math.max(next.trimStart, markerPoint)));
    }
  };

  const changeSpecies = (species: MarkerSpecies) => {
    setMarkerSpecies(species);
    if (markerPoint !== null) {
      const existing = draft.markers.find((marker) => marker.track_point_index === markerPoint && marker.species === species);
      setMarkerCount(existing?.count ?? 1);
    }
  };

  const editMarker = (marker: GpxMushroomMarker) => {
    setMarkerSpecies(marker.species);
    setMarkerCount(marker.count);
    selectPoint(marker.track_point_index, marker.species);
  };

  const upsertDraftMarker = () => {
    if (markerPoint === null) {
      setError('Tocca o fai clic sulla linea del percorso per scegliere il punto.');
      return;
    }
    const coordinate = points.get(markerPoint);
    const count = Math.trunc(markerCount);
    if (!coordinate || count < 1 || count > 10000) {
      setError('Scegli un punto valido e un numero di funghi tra 1 e 10.000.');
      return;
    }
    const marker: GpxMushroomMarker = {
      track_id: props.track.id,
      track_point_index: markerPoint,
      longitude: coordinate[0],
      latitude: coordinate[1],
      species: markerSpecies,
      count,
    };
    updateDraft({
      ...draft,
      markers: [...draft.markers.filter((item) => markerKey(item) !== markerKey(marker)), marker]
        .sort((left, right) => left.track_point_index - right.track_point_index || left.species.localeCompare(right.species)),
    });
    setError(null);
  };

  const save = async () => {
    if (!editable || draft.trimEnd <= draft.trimStart) return;
    setBusy(true);
    setError(null);
    try {
      const original = markerMap(props.track.markers);
      const next = markerMap(draft.markers);
      const trimStart = draft.trimStart === 0 ? null : draft.trimStart;
      const trimEnd = draft.trimEnd === lastPoint ? null : draft.trimEnd;
      const updatedTrack = await setTrackTrim(props.track.id, trimStart, trimEnd);
      const operations: Promise<unknown>[] = [];
      for (const [key, marker] of next) {
        const previous = original.get(key);
        if (!previous || !sameMarker(previous, marker)) operations.push(saveTrackMarker(marker));
      }
      for (const [key, marker] of original) {
        if (!next.has(key)) operations.push(deleteTrackMarker(props.track.id, marker.track_point_index, marker.species));
      }
      await Promise.all(operations);
      props.onSaved(updatedTrack, await loadTrackMarkers(props.track.id));
    } catch (cause) {
      const normalized = toAccountError(cause);
      setError(normalized.message + ' Le modifiche gia ricevute dal server possono essere state salvate: riprova o riapri la traccia.');
      if (normalized.code === 'session_expired') void getAccountSupabaseClient().auth.signOut();
    } finally {
      setBusy(false);
    }
  };

  const existingAtSelection = markerPoint !== null
    && draft.markers.some((marker) => marker.track_point_index === markerPoint && marker.species === markerSpecies);

  return (
    <aside className="gpx-editor" role="dialog" aria-modal="false" aria-labelledby="gpx-editor-title">
      <header>
        <div><small>Archivio cloud</small><h2 id="gpx-editor-title">Modifica percorso</h2><p>{props.track.name}</p><time dateTime={getTrackDateIso(props.track.track)}>{formatTrackDate(props.track.track)}</time></div>
        <button type="button" onClick={props.onCancel} disabled={busy} aria-label="Annulla e chiudi"><X size={20} /></button>
      </header>
      {!editable ? (
        <div className="gpx-editor-error">Questa traccia non puo essere modificata: i punti del file non coincidono con gli indici registrati dal server.</div>
      ) : (
        <>
          <section className="gpx-editor-section">
            <div className="gpx-editor-section-title"><Scissors size={17} /><strong>Taglia percorso</strong><button type="button" onClick={() => updateDraft({ ...draft, trimStart: 0, trimEnd: lastPoint })}><RotateCcw size={14} /> Ripristina</button></div>
            <label>Inizio mantenuto <output>Punto {draft.trimStart + 1}</output>
              <input aria-label="Inizio mantenuto" type="range" min={0} max={draft.trimEnd - 1} value={draft.trimStart} onChange={(event) => updateDraft({ ...draft, trimStart: Number(event.target.value) })} />
            </label>
            <label>Fine mantenuta <output>Punto {draft.trimEnd + 1}</output>
              <input aria-label="Fine mantenuta" type="range" min={draft.trimStart + 1} max={lastPoint} value={draft.trimEnd} onChange={(event) => updateDraft({ ...draft, trimEnd: Number(event.target.value) })} />
            </label>
            <p className="gpx-editor-hint"><span className="kept-swatch" /> {draft.trimEnd - draft.trimStart + 1} punti mantenuti <span className="excluded-swatch" /> {props.track.data.rawPointCount - (draft.trimEnd - draft.trimStart + 1)} esclusi</p>
          </section>
          <section className="gpx-editor-section">
            <div className="gpx-editor-section-title"><strong>Marker funghi</strong><span>{draft.markers.length}</span></div>
            <p className="gpx-map-pick-hint">Tocca o fai clic sulla linea del percorso. Il punto selezionato viene evidenziato sulla mappa.</p>
            <div className="gpx-point-stepper" aria-label="Punto GPX selezionato">
              <button type="button" onClick={() => selectPoint((markerPoint ?? draft.trimStart) - 1)} disabled={markerPoint === null || markerPoint <= draft.trimStart} aria-label="Punto precedente"><Minus size={18} /></button>
              <output>{markerPoint === null ? 'Nessun punto selezionato' : 'Punto ' + (markerPoint + 1) + ' di ' + props.track.data.rawPointCount}</output>
              <button type="button" onClick={() => selectPoint((markerPoint ?? draft.trimStart) + 1)} disabled={markerPoint === null || markerPoint >= draft.trimEnd} aria-label="Punto successivo"><Plus size={18} /></button>
            </div>
            <div className="gpx-species-picker" role="group" aria-label="Specie">
              <button type="button" className={markerSpecies === 'porcini' ? 'is-active' : ''} onClick={() => changeSpecies('porcini')}>Porcini</button>
              <button type="button" className={markerSpecies === 'finferli' ? 'is-active' : ''} onClick={() => changeSpecies('finferli')}>Finferli</button>
            </div>
            <div className="gpx-marker-form">
              <label>Numero funghi<input type="number" min={1} max={10000} inputMode="numeric" value={markerCount} onChange={(event) => setMarkerCount(Number(event.target.value))} /></label>
              <button type="button" onClick={upsertDraftMarker} disabled={markerPoint === null}><Plus size={16} /> {existingAtSelection ? 'Aggiorna' : 'Aggiungi'}</button>
            </div>
            {draft.markers.length > 0 && <ul className="gpx-marker-list">{draft.markers.map((marker) => {
              const outside = marker.track_point_index < draft.trimStart || marker.track_point_index > draft.trimEnd;
              const speciesLabel = marker.species === 'porcini' ? 'Porcini' : 'Finferli';
              return <li key={markerKey(marker)} className={outside ? 'is-outside' : ''}>
                <button type="button" onClick={() => editMarker(marker)}><strong>{speciesLabel} - punto {marker.track_point_index + 1}</strong><span>{marker.count} {marker.count === 1 ? 'fungo' : 'funghi'}{outside ? ' - fuori dal taglio' : ''}</span></button>
                <button type="button" onClick={() => updateDraft({ ...draft, markers: draft.markers.filter((item) => markerKey(item) !== markerKey(marker)) })} aria-label={'Rimuovi ' + speciesLabel + ' al punto ' + (marker.track_point_index + 1)}><Trash2 size={16} /></button>
              </li>;
            })}</ul>}
          </section>
        </>
      )}
      {error && <div className="gpx-editor-error" role="alert">{error}</div>}
      <footer><button type="button" onClick={props.onCancel} disabled={busy}>Annulla</button><button className="primary" type="button" onClick={() => void save()} disabled={busy || !editable}><Save size={16} /> {busy ? 'Salvataggio...' : 'Salva modifiche'}</button></footer>
    </aside>
  );
}
