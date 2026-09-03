import React from 'react';
import { Clock3, Download, FileArchive, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import type { AccountState } from './lifecycle';
import type { AccountExportJob } from './rights';
import { isExportDownloadable } from './rights';
import { useAccountRights } from './useAccountRights';

const dateTimeFormatter = new Intl.DateTimeFormat('it-IT', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDateTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateTimeFormatter.format(date);
}

function formatBytes(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  const formatter = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
  if (value < 1024) return formatter.format(value) + ' B';
  if (value < 1024 ** 2) return formatter.format(value / 1024) + ' KB';
  return formatter.format(value / 1024 ** 2) + ' MB';
}

export function getExportStatusCopy(job: AccountExportJob): {
  label: string;
  description: string;
  tone: 'neutral' | 'warning' | 'success';
} {
  switch (job.status) {
    case 'pending':
      return { label: 'In coda', description: 'La richiesta è stata ricevuta e attende l’elaborazione.', tone: 'neutral' };
    case 'building':
      return { label: 'Preparazione in corso', description: 'Il server sta creando l’archivio personale.', tone: 'neutral' };
    case 'retry':
      return { label: 'Nuovo tentativo previsto', description: 'Si è verificato un problema temporaneo. Il backend riproverà automaticamente.', tone: 'warning' };
    case 'ready':
      return isExportDownloadable(job)
        ? { label: 'Pronto da scaricare', description: 'Il file è privato e rimane disponibile solo fino alla scadenza indicata.', tone: 'success' }
        : { label: 'Download scaduto', description: 'La scadenza è trascorsa. Aggiorna lo stato o richiedi un nuovo export.', tone: 'warning' };
    case 'expired':
      return { label: 'Download scaduto', description: 'Il file temporaneo non è più disponibile. Puoi richiedere un nuovo export.', tone: 'warning' };
    case 'cleaning':
      return { label: 'Rimozione file scaduto', description: 'Il backend sta eliminando l’archivio temporaneo scaduto.', tone: 'neutral' };
  }
}

export function AccountRightsPanel(props: {
  accountState: AccountState;
  compact?: boolean;
}) {
  const canUseRights = props.accountState === 'active' || props.accountState === 'restricted';
  const rights = useAccountRights(canUseRights);
  const [deletionConfirmed, setDeletionConfirmed] = React.useState(false);

  if (props.accountState === 'deletion_pending') {
    return (
      <section className="account-rights-panel is-deletion-pending" aria-labelledby="account-rights-title">
        <header>
          <Trash2 aria-hidden="true" />
          <div>
            <p>Diritti e cancellazione</p>
            <h3 id="account-rights-title">Eliminazione in corso</h3>
          </div>
        </header>
        <p>L’account è già in eliminazione. Percorsi, ritrovamenti, profilo, export temporanei e dati ancora riconducibili all’account vengono rimossi dal backend appena possibile; eventuali residui tecnici entro 30 giorni.</p>
        <p>Questa schermata non indica che il processo sia già completato. L’accesso verrà invalidato definitivamente al termine.</p>
      </section>
    );
  }

  const status = rights.job ? getExportStatusCopy(rights.job) : null;
  const requestedAt = formatDateTime(rights.job?.requested_at ?? null);
  const expiresAt = formatDateTime(rights.job?.expires_at ?? null);
  const size = formatBytes(rights.job?.size_bytes ?? null);

  const confirmDeletionRequest = async () => {
    if (!deletionConfirmed) return;
    const confirmed = window.confirm(
      'Inviare l’email per confermare l’eliminazione definitiva di account e dati? Prima esporta i percorsi che vuoi conservare.',
    );
    if (!confirmed) return;
    try {
      await rights.requestDeletion();
    } catch {
      // The hook exposes a safe user-facing error.
    }
  };

  return (
    <section className={'account-rights-panel' + (props.compact ? ' compact' : '')} aria-labelledby="account-rights-title">
      <header>
        <ShieldAlert aria-hidden="true" />
        <div>
          <p>Privacy e controllo dati</p>
          <h3 id="account-rights-title">I tuoi dati</h3>
        </div>
        <a href="/account-e-dati/" target="_blank" rel="noreferrer">Dettagli</a>
      </header>

      {props.accountState === 'restricted' && (
        <p className="account-rights-limited">Export ed eliminazione restano disponibili anche con account sospeso. Archivio GPX e altre funzioni riservate rimangono bloccati.</p>
      )}

      {rights.available === false && (
        <p className="account-message warning" role="status">Le API di export e cancellazione non sono ancora attive in questo ambiente.</p>
      )}
      {rights.error && rights.available !== false && <p className="account-message error" role="alert">{rights.error}</p>}

      <div className="account-export-block">
        <div className="account-rights-section-title">
          <FileArchive aria-hidden="true" />
          <div><strong>Export personale</strong><span>Archivio ZIP privato e temporaneo</span></div>
        </div>
        <p>Include dati account e profilo, accettazioni, metadati delle tracce, modifiche, marker, eventi minimi di servizio e i file GPX ancora presenti.</p>

        {rights.loading && <div className="account-state"><span className="details-spinner" /> Verifica export…</div>}
        {!rights.loading && rights.job && status && (
          <div className={'account-export-status tone-' + status.tone}>
            <div><span>Stato</span><strong>{status.label}</strong></div>
            <p>{status.description}</p>
            <dl>
              {requestedAt && <div><dt>Richiesto</dt><dd>{requestedAt}</dd></div>}
              {expiresAt && <div><dt>Scadenza</dt><dd>{expiresAt}</dd></div>}
              {size && <div><dt>Dimensione</dt><dd>{size}</dd></div>}
            </dl>
          </div>
        )}
        {!rights.loading && !rights.job && rights.available !== false && (
          <p className="account-inline-note">Nessun export richiesto.</p>
        )}

        <div className="account-rights-buttons">
          {rights.job && isExportDownloadable(rights.job) ? (
            <button className="account-primary" type="button" disabled={rights.busy !== null} onClick={() => void rights.downloadExport().catch(() => undefined)}>
              <Download size={16} aria-hidden="true" /> {rights.busy === 'download' ? 'Download…' : 'Scarica ZIP'}
            </button>
          ) : (
            <button className="account-primary" type="button" disabled={rights.busy !== null || rights.loading || rights.available === false} onClick={() => void rights.requestExport().catch(() => undefined)}>
              <FileArchive size={16} aria-hidden="true" /> {rights.busy === 'request_export' ? 'Richiesta…' : 'Richiedi export'}
            </button>
          )}
          <button type="button" disabled={rights.loading || rights.busy !== null || rights.available === false} onClick={() => void rights.refresh()}>
            <RefreshCw size={16} aria-hidden="true" /> Aggiorna
          </button>
        </div>
        <p className="account-rights-note"><Clock3 size={14} aria-hidden="true" /> Il backend applica frequenza e scadenza. Scarica l’export prima di confermare la cancellazione.</p>
      </div>

      <details className="account-delete-block">
        <summary><Trash2 size={17} aria-hidden="true" /> Elimina account e dati</summary>
        <div>
          <p>L’operazione è definitiva. Verranno eliminati account, profilo, percorsi GPX, ritrovamenti, modifiche, export temporanei ed email automatiche riconducibili all’account.</p>
          <p>La rimozione avviene appena possibile; eventuali residui tecnici entro 30 giorni. Possono restare solo modelli e risultati aggregati che non permettono di risalire all’account o ai luoghi.</p>
          {rights.deletionNotice ? (
            <p className="account-message success" role="status">
              Controlla l’email dell’account e apri il link di conferma. Il link è monouso
              {rights.deletionNotice.expires_in_minutes
                ? ' e scade tra ' + Math.round(rights.deletionNotice.expires_in_minutes / 60) + ' ore.'
                : '.'}
            </p>
          ) : (
            <>
              <label className="account-delete-confirm">
                <input type="checkbox" checked={deletionConfirmed} onChange={(event) => setDeletionConfirmed(event.target.checked)} />
                <span>Ho compreso che la cancellazione è definitiva e che devo prima esportare ciò che voglio conservare.</span>
              </label>
              <button className="account-danger" type="button" disabled={!deletionConfirmed || rights.busy !== null || rights.available === false} onClick={() => void confirmDeletionRequest()}>
                <Trash2 size={16} aria-hidden="true" /> {rights.busy === 'request_deletion' ? 'Invio…' : 'Invia email di conferma'}
              </button>
            </>
          )}
        </div>
      </details>
    </section>
  );
}