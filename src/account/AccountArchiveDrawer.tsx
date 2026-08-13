import React from 'react';
import {
  ArrowLeft,
  Cloud,
  CloudDownload,
  FolderArchive,
  HardDrive,
  LogIn,
  LogOut,
  MapPinned,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react';
import {
  deleteTrack,
  downloadTrack,
  getAccountSupabaseClient,
  getArchiveConfig,
  loadArchiveData,
  signIn,
  signOut,
  signUp,
  renameTrack,
  uploadPreparedTrack,
} from './client';
import { decodeCloudGpx, prepareImportedGpx } from './gpx';
import type { AccountArchiveError, AccountSessionState, ArchiveConfig, ArchiveData, CloudMapTrack, GpxMapData, GpxTrack, PreparedGpxUpload } from './types';
import { normalizeTrackName, normalizeUsername, safeDownloadName, toAccountError, validateTrackName, validateUsername } from './validation';
import './account.css';

type AuthView = 'login' | 'register';

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const numberFormatter = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${numberFormatter.format(value / 1024)} KB`;
  return `${numberFormatter.format(value / 1024 ** 2)} MB`;
}

function AuthForm(props: {
  view: AuthView;
  config: ArchiveConfig | null;
  busy: boolean;
  error: string | null;
  notice: string | null;
  onViewChange: (view: AuthView) => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, username: string) => Promise<void>;
}) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [acceptTerms, setAcceptTerms] = React.useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = React.useState(false);
  const [acceptResearch, setAcceptResearch] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    if (props.view === 'register') {
      const usernameError = validateUsername(username);
      if (usernameError) {
        setLocalError(usernameError);
        return;
      }
      if (!acceptTerms || !acceptPrivacy || !acceptResearch) {
        setLocalError('Per registrarti devi accettare tutti e tre i consensi richiesti.');
        return;
      }
      await props.onRegister(email, password, normalizeUsername(username));
      return;
    }
    await props.onLogin(email, password);
  };

  return (
    <div className="account-auth">
      <div className="account-auth-tabs" role="tablist" aria-label="Accesso account">
        <button
          type="button"
          role="tab"
          aria-selected={props.view === 'login'}
          className={props.view === 'login' ? 'active' : ''}
          onClick={() => props.onViewChange('login')}
        >
          <LogIn size={16} aria-hidden="true" />
          Accedi
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={props.view === 'register'}
          className={props.view === 'register' ? 'active' : ''}
          onClick={() => props.onViewChange('register')}
        >
          <UserPlus size={16} aria-hidden="true" />
          Registrati
        </button>
      </div>

      <form className="account-form" onSubmit={(event) => void submit(event)}>
        {props.view === 'register' && (
          <label>
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              autoComplete="username"
              inputMode="text"
              pattern="[a-z0-9_]{3,24}"
              minLength={3}
              maxLength={24}
              required
            />
            <small>3-24 caratteri: lettere minuscole, numeri e underscore.</small>
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={props.view === 'login' ? 'current-password' : 'new-password'}
            minLength={6}
            required
          />
        </label>

        {props.view === 'register' && (
          <div className="legal-acceptances">
            {!props.config && <p className="account-inline-note">Caricamento versioni legaliâ€¦</p>}
            <label>
              <input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} />
              <span>
                Accetto i termini di utilizzo dellâ€™archivio GPX
                {props.config && <small>Versione {props.config.terms_version}</small>}
              </span>
            </label>
            <label>
              <input type="checkbox" checked={acceptPrivacy} onChange={(event) => setAcceptPrivacy(event.target.checked)} />
              <span>
                Ho letto e accetto il trattamento dei dati necessario per account e archivio privato
                {props.config && <small>Privacy versione {props.config.privacy_version}</small>}
              </span>
            </label>
            <label>
              <input type="checkbox" checked={acceptResearch} onChange={(event) => setAcceptResearch(event.target.checked)} />
              <span>
                Acconsento allâ€™uso per ricerca dei GPX raw in forma anonima, senza user ID, nome file o percorso Storage
                {props.config && <small>Consenso ricerca versione {props.config.research_consent_version}</small>}
              </span>
            </label>
          </div>
        )}

        {(localError || props.error) && <p className="account-message error" role="alert">{localError ?? props.error}</p>}
        {props.notice && <p className="account-message success" role="status">{props.notice}</p>}
        <button className="account-primary" type="submit" disabled={props.busy || (props.view === 'register' && !props.config)}>
          {props.busy ? 'Attendiâ€¦' : props.view === 'login' ? 'Accedi' : 'Crea account'}
        </button>
      </form>
    </div>
  );
}

function TrackRow(props: {
  track: GpxTrack;
  action: 'download' | 'display' | 'rename' | 'delete' | null;
  partialDelete: boolean;
  onDownload: () => void;
  onDisplay: () => void;
  visibleOnMap: boolean;
  onDelete: () => void;
  onRename: () => void;
  renaming: boolean;
  renameName: string;
  renameError: string | null;
  onRenameNameChange: (value: string) => void;
  onRenameSave: () => void;
  onRenameCancel: () => void;
  detail?: GpxMapData | 'loading' | 'error';
}) {
  const track = props.track;
  return (
    <li className="gpx-track-row">
      <div className="gpx-track-title">
        <strong>{track.display_name}</strong>
        <span>{dateFormatter.format(new Date(track.ready_at ?? track.created_at))}</span>
      </div>
      {props.renaming && (
        <div className="gpx-rename-form">
          <label>Nuovo nome<input autoFocus value={props.renameName} maxLength={120} onChange={(event) => props.onRenameNameChange(event.target.value)} /></label>
          {props.renameError && <p className="account-message error" role="alert">{props.renameError}</p>}
          <div><button type="button" onClick={props.onRenameCancel}>Annulla</button><button type="button" onClick={props.onRenameSave} disabled={props.action === 'rename'}>{props.action === 'rename' ? 'Salvataggio…' : 'Salva nome'}</button></div>
        </div>
      )}
      <dl>
        <div><dt>Dimensione</dt><dd>{formatBytes(track.compressed_size_bytes)}</dd></div>
        <div><dt>Porcini</dt><dd>{props.detail === 'loading' || props.detail === undefined ? '…' : typeof props.detail === 'object' ? props.detail.porciniCount : '—'}</dd></div>
        <div><dt>Finferli</dt><dd>{props.detail === 'loading' || props.detail === undefined ? '…' : typeof props.detail === 'object' ? props.detail.finferliCount : '—'}</dd></div>
        {track.distance_m !== null && <div><dt>Distanza</dt><dd>{numberFormatter.format(track.distance_m / 1000)} km</dd></div>}
        {track.point_count !== null && <div><dt>Punti</dt><dd>{numberFormatter.format(track.point_count)}</dd></div>}
      </dl>
      {props.partialDelete && (
        <p className="account-message warning">File eliminato; completa la cancellazione dei metadati.</p>
      )}
      <div className="gpx-track-actions">
        <button type="button" onClick={props.onDisplay} disabled={props.action !== null || props.partialDelete}>
          <MapPinned size={16} aria-hidden="true" />
          {props.action === 'display' ? 'Apertura…' : props.visibleOnMap ? 'Nascondi dalla mappa' : 'Mostra sulla mappa'}
        </button>
        <button type="button" onClick={props.onRename} disabled={props.action !== null || props.partialDelete || props.renaming}>
          <Pencil size={16} aria-hidden="true" />
          Rinomina
        </button>
        <button type="button" onClick={props.onDownload} disabled={props.action !== null || props.partialDelete}>
          <CloudDownload size={16} aria-hidden="true" />
          {props.action === 'download' ? 'Downloadâ€¦' : 'Scarica'}
        </button>
        <button className="danger" type="button" onClick={props.onDelete} disabled={props.action !== null}>
          <Trash2 size={16} aria-hidden="true" />
          {props.action === 'delete' ? 'Cancellazioneâ€¦' : props.partialDelete ? 'Completa cancellazione' : 'Elimina'}
        </button>
      </div>
    </li>
  );
}

export function AccountArchiveDrawer(props: {
  sessionState: AccountSessionState;
  onClose: () => void;
  initialView?: AuthView;
  onShowTrack: (track: CloudMapTrack) => void;
  onTrackDeleted?: (trackId: string) => void;
  onTrackRenamed?: (trackId: string, name: string) => void;
  visibleTrackIds: ReadonlySet<string>;
  onHideTrack: (trackId: string) => void;
}) {
  const { sessionState } = props;
  const [authView, setAuthView] = React.useState<AuthView>(props.initialView ?? 'login');
  const [publicConfig, setPublicConfig] = React.useState<ArchiveConfig | null>(null);
  const [archive, setArchive] = React.useState<ArchiveData | null>(null);
  const [loadingArchive, setLoadingArchive] = React.useState(false);
  const [archiveError, setArchiveError] = React.useState<string | null>(null);
  const [authBusy, setAuthBusy] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [authNotice, setAuthNotice] = React.useState<string | null>(null);
  const [trackActions, setTrackActions] = React.useState<Record<string, 'download' | 'display' | 'rename' | 'delete'>>({});
  const [preparedUpload, setPreparedUpload] = React.useState<{ file: File; prepared: PreparedGpxUpload } | null>(null);
  const [uploadName, setUploadName] = React.useState('');
  const [uploadBusy, setUploadBusy] = React.useState(false);
  const [uploadNotice, setUploadNotice] = React.useState<string | null>(null);
  const [renamingTrackId, setRenamingTrackId] = React.useState<string | null>(null);
  const [renameName, setRenameName] = React.useState('');
  const [renameError, setRenameError] = React.useState<string | null>(null);
  const [usageOpen, setUsageOpen] = React.useState(false);
  const [trackDetails, setTrackDetails] = React.useState<Record<string, GpxMapData | 'loading' | 'error'>>({});
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);  const [partialDeletes, setPartialDeletes] = React.useState<Set<string>>(() => new Set());
  const loadSequence = React.useRef(0);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [props.onClose]);

  React.useEffect(() => {
    let active = true;
    void getArchiveConfig()
      .then((config) => {
        if (active) setPublicConfig(config);
      })
      .catch((error) => {
        if (active) setArchiveError(toAccountError(error).message);
      });
    return () => {
      active = false;
    };
  }, []);

  const refreshArchive = React.useCallback(async () => {
    if (!sessionState.session) return;
    const sequence = ++loadSequence.current;
    setLoadingArchive(true);
    setArchiveError(null);
    try {
      const data = await loadArchiveData();
      if (sequence !== loadSequence.current) return;
      setArchive(data);
      setPublicConfig(data.config);
    } catch (error) {
      if (sequence !== loadSequence.current) return;
      const normalized = toAccountError(error);
      setArchiveError(normalized.message);
      if (normalized.code === 'session_expired') void getAccountSupabaseClient().auth.signOut();
    } finally {
      if (sequence === loadSequence.current) setLoadingArchive(false);
    }
  }, [sessionState.session]);

  React.useEffect(() => {
    if (!sessionState.session) {
      loadSequence.current += 1;
      setArchive(null);
      setLoadingArchive(false);
      return;
    }
    void refreshArchive();
  }, [refreshArchive, sessionState.session]);

  React.useEffect(() => {
    if (!archive) return;
    let active = true;
    const pending = archive.tracks.filter((track) => !trackDetails[track.id]);
    if (pending.length === 0) return;
    setTrackDetails((current) => Object.fromEntries([...Object.entries(current), ...pending.map((track) => [track.id, 'loading' as const])]));
    let cursor = 0;
    const workers = Array.from({ length: Math.min(3, pending.length) }, async () => {
      while (cursor < pending.length && active) {
        const track = pending[cursor++];
        try {
          const data = await decodeCloudGpx(await downloadTrack(track), track.original_filename);
          if (active) setTrackDetails((current) => ({ ...current, [track.id]: data }));
        } catch { if (active) setTrackDetails((current) => ({ ...current, [track.id]: 'error' })); }
      }
    });
    void Promise.all(workers);
    return () => { active = false; };
  }, [archive]);
  const runAuth = async (action: () => Promise<void>) => {
    setAuthBusy(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      await action();
    } catch (error) {
      setAuthError(toAccountError(error).message);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleDownload = async (track: GpxTrack) => {
    setTrackActions((current) => ({ ...current, [track.id]: 'download' }));
    setArchiveError(null);
    try {
      const blob = await downloadTrack(track);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = safeDownloadName(track.original_filename || track.display_name);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (error) {
      const normalized = toAccountError(error);
      setArchiveError(normalized.message);
      if (normalized.code === 'session_expired') void getAccountSupabaseClient().auth.signOut();
    } finally {
      setTrackActions((current) => {
        const next = { ...current };
        delete next[track.id];
        return next;
      });
    }
  };

  const handleDisplay = async (track: GpxTrack) => {
    if (props.visibleTrackIds.has(track.id)) { props.onHideTrack(track.id); return; }
    setTrackActions((current) => ({ ...current, [track.id]: 'display' }));
    setArchiveError(null);
    try {
      const cached = trackDetails[track.id];
      const data = typeof cached === 'object' ? cached : await decodeCloudGpx(await downloadTrack(track), track.original_filename);
      if (data.lines.features.length === 0) throw new Error('La traccia non contiene segmenti visualizzabili.');
      props.onShowTrack({ id: track.id, name: track.display_name, data });
    } catch (error) { setArchiveError(toAccountError(error).message); }
    finally {
      setTrackActions((current) => { const next = { ...current }; delete next[track.id]; return next; });
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || !archive) return;
    setUploadBusy(true); setArchiveError(null); setUploadNotice(null); setPreparedUpload(null);
    try {
      const prepared = await prepareImportedGpx(file, archive.config);
      setPreparedUpload({ file, prepared }); setUploadName(prepared.suggestedName);
    } catch (error) { setArchiveError(toAccountError(error).message); }
    finally { setUploadBusy(false); }
  };

  const handleUpload = async () => {
    if (!preparedUpload) return;
    const validationError = validateTrackName(uploadName);
    if (validationError) { setArchiveError(validationError); return; }
    setUploadBusy(true); setArchiveError(null); setUploadNotice(null);
    try {
      await uploadPreparedTrack({ displayName: uploadName, originalFilename: preparedUpload.file.name, prepared: preparedUpload.prepared });
      setPreparedUpload(null); setUploadName(''); setUploadNotice('Traccia salvata nel cloud.');
      await refreshArchive();
    } catch (error) {
      const normalized = toAccountError(error);
      setArchiveError(normalized.message);
      if (normalized.code === 'session_expired') void getAccountSupabaseClient().auth.signOut();
    } finally { setUploadBusy(false); }
  };
  const startRename = (track: GpxTrack) => {
    setRenamingTrackId(track.id);
    setRenameName(track.display_name);
    setRenameError(null);
  };

  const cancelRename = () => {
    setRenamingTrackId(null);
    setRenameName('');
    setRenameError(null);
  };

  const saveRename = async (track: GpxTrack) => {
    const validationError = validateTrackName(renameName);
    if (validationError) { setRenameError(validationError); return; }
    setTrackActions((current) => ({ ...current, [track.id]: 'rename' }));
    setRenameError(null);
    try {
      const updated = await renameTrack(track, renameName);
      const normalizedName = updated.display_name || normalizeTrackName(renameName);
      setArchive((current) => current ? { ...current, tracks: current.tracks.map((item) => item.id === track.id ? { ...item, ...updated, display_name: normalizedName, storage_path: item.storage_path } : item) } : current);
      props.onTrackRenamed?.(track.id, normalizedName);
      cancelRename();
    } catch (error) {
      const normalized = toAccountError(error);
      setRenameError(normalized.message);
      if (normalized.code === 'track_not_found') void refreshArchive();
      if (normalized.code === 'session_expired') void getAccountSupabaseClient().auth.signOut();
    } finally {
      setTrackActions((current) => { const next = { ...current }; delete next[track.id]; return next; });
    }
  };
  const handleDelete = async (track: GpxTrack) => {
    if (!partialDeletes.has(track.id) && !window.confirm(`Eliminare definitivamente â€œ${track.display_name}â€?`)) return;
    setTrackActions((current) => ({ ...current, [track.id]: 'delete' }));
    setArchiveError(null);
    try {
      await deleteTrack(track);
      props.onTrackDeleted?.(track.id);
      setPartialDeletes((current) => {
        const next = new Set(current);
        next.delete(track.id);
        return next;
      });
      setArchive((current) => current ? { ...current, tracks: current.tracks.filter((item) => item.id !== track.id) } : current);
    } catch (error) {
      const normalized = toAccountError(error) as AccountArchiveError;
      setArchiveError(normalized.message);
      if (normalized.partial) setPartialDeletes((current) => new Set(current).add(track.id));
      if (normalized.code === 'session_expired') void getAccountSupabaseClient().auth.signOut();
    } finally {
      setTrackActions((current) => {
        const next = { ...current };
        delete next[track.id];
        return next;
      });
    }
  };

  return (
    <aside
      className={`account-archive-drawer${sessionState.session ? ' is-authenticated' : ''}`}
      role="dialog"
      aria-label="Account e archivio GPX"
      aria-modal="false"
    >
      <header className="account-drawer-header">
        <button ref={closeButtonRef} className="account-back mobile-only" type="button" onClick={props.onClose} aria-label="Indietro dalla schermata account">
          <ArrowLeft size={19} aria-hidden="true" />
        </button>
        <div>
          <p>{sessionState.session ? 'Il tuo account' : 'FunghiTracker cloud'}</p>
          <h1>{sessionState.session ? 'Profilo e archivio' : 'Accedi a FunghiTracker'}</h1>
        </div>
        <button className="account-close desktop-only" type="button" onClick={props.onClose} aria-label="Chiudi account e archivio">
          <X size={19} aria-hidden="true" />
        </button>
      </header>

      <div className="account-drawer-content">
        {sessionState.loading && <div className="account-state"><span className="details-spinner" /> Ripristino sessioneâ€¦</div>}
        {sessionState.error && <p className="account-message error" role="alert">{sessionState.error}</p>}

        {!sessionState.loading && !sessionState.session && (
          <>
            <section className="account-intro">
              <span className="account-intro-icon" aria-hidden="true"><UserRound size={30} /></span>
              <h2>Il tuo spazio FunghiTracker</h2>
              <p>Crea un profilo per ritrovare e gestire dal web le tracce GPX salvate nel cloud.</p>
              <ul className="account-benefits">
                <li><Cloud size={18} aria-hidden="true" /><span><strong>Archivio personale</strong>Le tracce pronte sono raccolte in un unico spazio privato.</span></li>
                <li><CloudDownload size={18} aria-hidden="true" /><span><strong>Download immediato</strong>Scarica i GPX sui tuoi dispositivi quando ti servono.</span></li>
                <li><ShieldCheck size={18} aria-hidden="true" /><span><strong>Controllo dei dati</strong>Consulta i limiti ed elimina definitivamente le tracce.</span></li>
              </ul>
            </section>
            <AuthForm
              view={authView}
              config={publicConfig}
              busy={authBusy}
              error={authError}
              notice={authNotice}
              onViewChange={(view) => {
                setAuthView(view);
                setAuthError(null);
                setAuthNotice(null);
              }}
              onLogin={(email, password) => runAuth(async () => {
                await signIn(email, password);
              })}
              onRegister={(email, password, username) => runAuth(async () => {
                const result = await signUp({ email, password, username });
                if (!result.session) {
                  setAuthView('login');
                  setAuthNotice('Account creato. Controlla lâ€™email e confermala prima di accedere.');
                }
              })}
            />
          </>
        )}

        {sessionState.session && (
          <>
            {authError && <p className="account-message error" role="alert">{authError}</p>}
            <section className="account-profile-card">
              <span className="account-profile-avatar" aria-hidden="true"><UserRound size={28} /></span>
              <div className="account-profile-identity">
                <span>Account FunghiTracker</span>
                <h2>{archive?.profile.username ?? sessionState.username ?? 'Utente'}</h2>
                <p>{sessionState.session.user.email}</p>
              </div>
              <span className="account-active-badge">Attivo</span>
              <button type="button" onClick={() => setUsageOpen((open) => !open)} aria-expanded={usageOpen}>
                <HardDrive size={16} aria-hidden="true" /> Utilizzo account
              </button>
              <button type="button" onClick={() => void runAuth(signOut)} disabled={authBusy}>
                <LogOut size={16} aria-hidden="true" /> Esci
              </button>
            </section>

            {usageOpen && <section className="account-usage">
              <div className="account-section-heading">
                <div>
                  <p>Utilizzo account</p>
                  <h2>Archivio GPX</h2>
                </div>
                <HardDrive size={21} aria-hidden="true" />
              </div>
              <div className="archive-summary">
                <div>
                  <span>Tracce pronte</span>
                  <strong>{archive?.tracks.length ?? 'â€”'}</strong>
                </div>
                <div>
                  <span>Limite tracce</span>
                  <strong>{archive?.config.max_tracks_per_user ?? publicConfig?.max_tracks_per_user ?? 'â€”'}</strong>
                </div>
                <div>
                  <span>Massimo per file</span>
                  <strong>{archive?.config ? formatBytes(archive.config.max_compressed_bytes) : 'â€”'}</strong>
                </div>
                <div>
                  <span>GPX non compresso</span>
                  <strong>{archive?.config ? formatBytes(archive.config.max_uncompressed_bytes) : 'â€”'}</strong>
                </div>
              </div>
              <p className="account-usage-note">I limiti sono quelli attualmente configurati per il tuo account. La lista mostra esclusivamente le tracce pronte.</p>
            </section>}

            <div className="archive-toolbar">
              <div><h2>Archivio</h2><p>Percorsi salvati in cloud</p></div>
              <div className="archive-toolbar-actions">
                <input ref={fileInputRef} className="gpx-hidden-input" type="file" accept=".gpx,.gpx.gz,application/gpx+xml,application/gzip" onChange={(event) => void handleFile(event.target.files?.[0])} disabled={uploadBusy || !archive} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadBusy || !archive} aria-label="Importa GPX"><Upload size={17} aria-hidden="true" /></button>
                <button type="button" onClick={() => void refreshArchive()} disabled={loadingArchive} aria-label="Aggiorna archivio"><RefreshCw size={17} aria-hidden="true" /></button>
              </div>
            </div>
            {preparedUpload && <div className="gpx-upload-ready compact">
              <label>Nome traccia<input value={uploadName} maxLength={120} onChange={(event) => setUploadName(event.target.value)} /></label>
              <p>{preparedUpload.prepared.pointCount} punti · {formatBytes(preparedUpload.prepared.compressedSizeBytes)} compressi</p>
              <button className="account-primary" type="button" onClick={() => void handleUpload()} disabled={uploadBusy || !uploadName.trim()}>{uploadBusy ? 'Salvataggio…' : 'Salva nel cloud'}</button>
            </div>}
            {uploadNotice && <p className="account-message success" role="status">{uploadNotice}</p>}

            {archiveError && (
              <div className="account-error-block" role="alert">
                <p>{archiveError}</p>
                <button type="button" onClick={() => void refreshArchive()}>Riprova</button>
              </div>
            )}
            {loadingArchive && <div className="account-state"><span className="details-spinner" /> Caricamento archivioâ€¦</div>}
            {!loadingArchive && archive && archive.tracks.length === 0 && (
              <div className="account-empty">
                <FolderArchive size={30} aria-hidden="true" />
                <strong>Nessuna traccia pronta</strong>
                <p>Le tracce archiviate dallâ€™app compariranno qui al termine del caricamento.</p>
              </div>
            )}
            {archive && archive.tracks.length > 0 && (
              <ul className="gpx-track-list">
                {archive.tracks.map((track) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    action={trackActions[track.id] ?? null}
                    partialDelete={partialDeletes.has(track.id)}
                    onDownload={() => void handleDownload(track)}
                    onDisplay={() => void handleDisplay(track)}
                    visibleOnMap={props.visibleTrackIds.has(track.id)}
                    onDelete={() => void handleDelete(track)}
                    onRename={() => startRename(track)}
                    renaming={renamingTrackId === track.id}
                    renameName={renamingTrackId === track.id ? renameName : track.display_name}
                    renameError={renamingTrackId === track.id ? renameError : null}
                    onRenameNameChange={(value) => { setRenameName(value); setRenameError(null); }}
                    onRenameSave={() => void saveRename(track)}
                    onRenameCancel={cancelRename}                    detail={trackDetails[track.id]}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
