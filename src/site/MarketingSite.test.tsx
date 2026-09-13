/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MarketingSite } from './MarketingSite';

afterEach(cleanup);

describe('testi di accesso del sito pubblico', () => {
  it('descrive senza ambiguita i limiti guest e le funzioni account', () => {
    render(<MarketingSite page="archive" />);

    expect(screen.getByText(/Indice da D-28 a D-7, meteo e terreno/)).toBeTruthy();
    expect(screen.getByText(/non viene creato un archivio locale o cloud/)).toBeTruthy();
    expect(screen.getByText(/Indice aggiornato, analisi, archivio cloud, upload GPX/)).toBeTruthy();
    expect(screen.getByText(/In deletion_pending restano documenti e stato della richiesta/)).toBeTruthy();
    expect(screen.queryByText(/disponibili liberamente/)).toBeNull();
  });

  it('indica che analisi e archivio richiedono un account attivo', () => {
    const { rerender } = render(<MarketingSite page="home" />);
    expect(screen.getByText(/Con un account attivo leggi i fattori favorevoli/)).toBeTruthy();
    expect(screen.getByText(/Con un account attivo puoi importare file GPX/)).toBeTruthy();

    rerender(<MarketingSite page="method" />);
    expect(screen.getByText(/L.analisi richiede un account attivo/)).toBeTruthy();
  });
});
