import type { ReactNode } from 'react';
import {
  ArrowRight, Check, CloudSun, Database,
  Gauge, Layers3, LockKeyhole, MapPinned, Route, Sprout, Trees,
} from 'lucide-react';
import type { PublicPage } from './routes';
import './marketing.css';

type MarketingPage = Exclude<PublicPage, 'map' | 'unknown'>;
const MAP_PATH = '/mappa/';

function Brand() {
  return <a className="site-brand" href="/" aria-label="Funghi Tracker, home"><img className="site-brand-icon" src="/icons/icon-192.png" width="36" height="36" alt="" /><span>Funghi Tracker</span></a>;
}

function SiteHeader({ current }: { current: MarketingPage }) {
  return <header className="site-header"><Brand /><nav className="site-navigation" aria-label="Navigazione principale"><a className={current === 'home' ? 'is-current' : ''} href="/">Home</a><a className={current === 'method' ? 'is-current' : ''} href="/come-funziona/">Come funziona</a><a className={current === 'archive' ? 'is-current' : ''} href="/archivio/">Archivio</a></nav><a className="site-map-link" href={MAP_PATH}>Vai alla mappa <ArrowRight size={17} /></a></header>;
}

function SiteFooter() {
  return <footer className="site-footer"><div className="site-footer-lead"><Brand /><p>Indice, meteo, terreno e percorsi GPX per pianificare e rileggere le uscite.</p></div><div><strong>Esplora</strong><a href={MAP_PATH}>Mappa</a><a href="/come-funziona/">Come funziona</a><a href="/archivio/">Archivio</a></div><nav aria-label="Documenti legali"><strong>Documenti</strong><a href="/privacy/">Privacy</a><a href="/termini/">Termini di utilizzo</a><a href="/account-e-dati/">Account e dati</a><a href="/elimina-account/">Elimina account</a></nav><div><strong>Contatti</strong><a href="mailto:funghitracker@gmail.com">funghitracker@gmail.com</a></div><p className="site-footer-note">L’indice descrive condizioni potenzialmente favorevoli: non garantisce la presenza di funghi.</p></footer>;
}

function IndexTerrainPreview() {
  const cells = Array.from({ length: 64 }, (_, index) => {
    const className = index === 37 ? 'selected' : [28, 29, 36, 38, 44, 45].includes(index) ? 'near' : index % 5 === 0 ? 'warm' : '';
    return <i key={index} className={className} />;
  });

  return <figure className="index-terrain-preview" aria-label="Esempio dell’indice su una griglia territoriale">
    <div className="preview-toolbar"><span>Indice porcini</span><time>Oggi</time></div>
    <svg className="preview-terrain" viewBox="0 0 680 500" aria-hidden="true"><path className="terrain-base" d="M0 460V210l92-51 73 31 87-98 99 78 90-61 104 95 135-46v302Z" /><path className="terrain-light" d="m0 354 106-86 80 36 74-75 92 43 88-83 103 80 137-55v246H0Z" /><path className="terrain-shadow" d="m0 423 119-92 94 47 85-63 85 40 92-78 94 64 111-46v165H0Z" /><g className="terrain-contours"><path d="M-14 344c77-45 138-27 213-70s117-104 208-75 117 62 282-14" /><path d="M-24 394c85-49 165-15 241-65s111-102 205-72 148 59 277-24" /><path d="M-12 448c101-58 169-11 254-75s112-90 202-55 136 31 246-26" /></g></svg>
    <div className="index-grid" aria-hidden="true">{cells}</div>
    <div className="index-value-card"><small>Cella selezionata</small><div><strong>74</strong><span>/100</span></div><p>Condizioni favorevoli</p></div>
  </figure>;
}

const Feature = ({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) => <article>{icon}<h3>{title}</h3><p>{children}</p></article>;

function HomePage() {
  return <><section className="home-hero"><div className="home-hero-copy"><h1>Un modello AI per lo studio dei funghi.</h1><p className="home-hero-intro">FunghiTracker unisce dati meteorologici recenti ad alta risoluzione a topografia e flora del bosco. Il risultato è un indice previsionale e un'analisi dettagliata delle condizioni del bosco. Un punto di partenza per programmare le proprie uscite.</p><div className="home-hero-actions"><a className="primary-action" href={MAP_PATH}>Apri la mappa <MapPinned size={19} /></a><a className="text-action" href="/come-funziona/">Come funziona</a></div></div><IndexTerrainPreview /></section>
  <section className="site-section home-story"><header className="section-heading single"><h2>Indice, meteo e terreno per ogni punto.</h2></header><div className="story-columns"><Feature icon={<Gauge />} title="Indice quotidiano">Confronta le condizioni per porcini e finferli nel territorio coperto.</Feature><Feature icon={<CloudSun />} title="Meteo del punto">Consulta temperature, pioggia, umidità e raffiche degli ultimi venti giorni.</Feature><Feature icon={<Layers3 />} title="Analisi del punto">Leggi i fattori favorevoli e sfavorevoli insieme ai dati del terreno.</Feature></div></section>
  <section className="field-note"><div className="field-note-illustration" aria-hidden="true"><span className="field-path" /><Trees size={72} /><span className="field-pin"><MapPinned size={22} /></span></div><div><h2>Archivio percorsi e ritrovamenti.</h2><p>Importa file GPX, conserva le uscite nel cloud e aggiungi porcini e finferli sui punti della traccia.</p><a className="text-action" href="/archivio/">Scopri l’archivio</a></div></section>
  <section className="map-callout"><h2>Consulta l’indice sulla mappa.</h2><a className="primary-action light" href={MAP_PATH}>Vai alla mappa <ArrowRight size={19} /></a></section></>;
}

function MethodPage() {
  return <><section className="inner-hero method-hero"><div><h1>Come viene calcolato l’indice.</h1><p>FunghiTracker combina condizioni meteorologiche recenti con caratteristiche del terreno e della vegetazione. Il punteggio aiuta a confrontare i punti della mappa.</p></div><div className="method-scale" aria-label="Scala dell’indice da zero a cento"><span>0</span><i /><i /><i /><i /><i /><strong>100</strong><p>da condizioni poco favorevoli a condizioni molto favorevoli</p></div></section>
  <section className="site-section method-flow"><header className="section-heading single"><h2>Dati considerati per ogni punto.</h2></header><ol><li><span><CloudSun /></span><div><h3>Meteo recente</h3><p>Temperature minime e massime, pioggia, umidità e vento descrivono le ultime settimane.</p></div></li><li><span><Trees /></span><div><h3>Terreno e vegetazione</h3><p>Quota, copertura forestale, esposizione e posizione topografica danno contesto alle condizioni atmosferiche.</p></div></li><li><span><Gauge /></span><div><h3>Score del modello</h3><p>I segnali vengono combinati in un valore da 0 a 100 e in fattori leggibili.</p></div></li></ol></section>
  <section className="method-detail"><div><h2>Calibrazione e limiti.</h2></div><div><p>Il fine-tuning confronta il modello con dati e osservazioni disponibili, aggiornando pesi e soglie in modo controllato.</p><p>Un valore alto non garantisce un ritrovamento: microclima, gestione del bosco e casualità restano importanti.</p></div></section>
  <section className="site-section honest-model"><header className="section-heading single"><h2>Come interpretare il punteggio.</h2></header><div className="honest-grid"><Feature icon={<Check />} title="Indica">Quanto le condizioni del punto sono compatibili con lo sviluppo della specie selezionata.</Feature><Feature icon={<Check />} title="Contestualizza">Mostra lo storico dell’indice e permette di controllare meteo e terreno del luogo.</Feature><Feature icon={<span>×</span>} title="Non garantisce">Non sostituisce l’osservazione diretta del bosco.</Feature></div></section>
  <section className="map-callout compact"><h2>Esplora i dati sulla mappa.</h2><a className="primary-action light" href={MAP_PATH}>Apri la mappa <ArrowRight size={19} /></a></section></>;
}

function ArchivePage() {
  return <><section className="inner-hero archive-hero"><div><h1>Archivio di percorsi e ritrovamenti.</h1><p>Salva le tracce GPX nel tuo account, visualizzale sulla mappa e annota i funghi trovati lungo il percorso.</p><div className="home-hero-actions"><a className="primary-action" href="/mappa/?account=1">Accedi o registrati <ArrowRight size={18} /></a><a className="text-action" href={MAP_PATH}>Continua senza account</a></div></div><div className="archive-stack" aria-hidden="true"><div><Route /><span><strong>Anello del bosco</strong><small>8,4 km · 2 ritrovamenti</small></span></div><div><Route /><span><strong>Sentiero del larice</strong><small>5,1 km · 4 ritrovamenti</small></span></div><div><Route /><span><strong>Uscita di domenica</strong><small>11,7 km · nessun ritrovamento</small></span></div></div></section>
  <section className="account-boundary"><div><span className="open-dot" /><h2>Senza account</h2><p>Indice, storico, meteo e analisi del punto sono disponibili liberamente.</p></div><div><LockKeyhole /><h2>Con un account</h2><p>Hai un archivio cloud privato per percorsi, ritrovamenti e modifiche alle tracce.</p></div></section>
  <section className="site-section archive-features"><header className="section-heading single"><h2>Funzioni dell’archivio.</h2></header><div className="archive-feature-list"><Feature icon={<Database />} title="Importa e conserva">Carica file GPX dal browser e assegna un nome alla traccia.</Feature><Feature icon={<MapPinned />} title="Mostra sulla mappa">Visualizza più percorsi insieme e centra quello che ti interessa.</Feature><Feature icon={<Sprout />} title="Annota ritrovamenti">Aggiungi porcini e finferli ai punti reali della traccia.</Feature><Feature icon={<Route />} title="Modifica il percorso">Accorcia inizio e fine senza modificare il GPX originale.</Feature></div></section>
  <section className="privacy-band"><LockKeyhole size={28} /><div><h2>Dati e privacy dell’account.</h2><p>L’archivio è privato. Puoi scaricare o eliminare tracce e dati personali.</p></div><a href="/account-e-dati/">Account e dati <ArrowRight size={17} /></a></section></>;
}

export function MarketingSite({ page }: { page: MarketingPage }) {
  return <div className="site-page"><a className="skip-link" href="#main-content">Vai al contenuto</a><SiteHeader current={page} /><main id="main-content">{page === 'home' ? <HomePage /> : page === 'method' ? <MethodPage /> : <ArchivePage />}</main><SiteFooter /></div>;
}
