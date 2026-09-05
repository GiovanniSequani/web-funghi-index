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
  return <figure className="index-terrain-preview" aria-label="Esempio dell’indice su una griglia territoriale">
    <div className="preview-toolbar"><span>Indice porcini</span><time>Oggi</time></div>
    <img className="index-terrain-render" src="/media/funghitracker-index-terrain.png" width="1920" height="1080" alt="Modello tridimensionale della griglia indice" />
    <svg className="index-cell-callout" viewBox="0 0 100 100" aria-hidden="true"><path d="M88 25 L63 52" /><circle cx="88" cy="25" r="1.5" /></svg>
    <svg className="preview-terrain" viewBox="0 0 760 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="terrain-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c7d3c3" /><stop offset="1" stopColor="#879b86" /></linearGradient>
        <linearGradient id="terrain-main" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#78906c" /><stop offset=".52" stopColor="#496b4e" /><stop offset="1" stopColor="#25452f" /></linearGradient>
      </defs>
      <rect className="terrain-sky" width="760" height="520" fill="url(#terrain-sky)" />
      <path className="terrain-ridge-far" d="M0 312 75 270l65 17 92-93 58 37 79-111 75 76 54-34 85 98 84-46 93 48v258H0Z" />
      <path className="terrain-ridge-main" d="M0 383 91 312l65 21 102-131 65 76 68-105 66 112 68-60 87 107 82-59 126 62v185H0Z" fill="url(#terrain-main)" />
      <path className="terrain-sun-face" d="m91 312 65 21 102-131 65 76-57 35-88 74Z" />
      <path className="terrain-shadow-face" d="m258 202 65 76 68-105 12 133-80 56-57-49Z" />
      <path className="terrain-shadow-face second" d="m457 285 68-60 87 107-42 25-78 42Z" />
      <path className="terrain-foreground" d="M0 424c113-77 188-49 275-82 91-35 170-26 242 17 84 50 143 22 243-12v173H0Z" />
      <g className="terrain-contours"><path d="M-18 362c91-53 145-22 232-70s114-103 206-69 141 70 355-26" /><path d="M-23 414c110-57 174-12 266-71s116-93 210-52 150 41 326-32" /><path d="M-12 470c107-48 188-3 281-61s126-81 217-43 151 31 292-21" /></g>
      <g className="terrain-forest"><path d="m72 399 13-34 13 34Z" /><path d="m105 386 11-30 11 30Z" /><path d="m641 382 13-36 13 36Z" /><path d="m675 395 12-32 12 32Z" /><path d="m704 374 10-28 10 28Z" /></g>
    </svg>
    <div className="index-value-card">
      <div className="index-score"><small>Cella selezionata</small><div><strong>77</strong><span>/100</span></div><p>Condizioni favorevoli</p></div>
      <div className="index-mini-analysis"><strong>Analisi del punto</strong><p className="index-analysis-summary">Pioggia e temperature sostengono l’indice. L’esposizione aumenta l’asciugamento.</p><ul><li className="favorable"><span>+</span><p>Piogge recenti<small>favorevole</small></p></li><li className="favorable"><span>+</span><p>Temperature<small>favorevole</small></p></li><li className="unfavorable"><span>−</span><p>Asciugamento<small>sfavorevole</small></p></li></ul></div>
    </div>
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
