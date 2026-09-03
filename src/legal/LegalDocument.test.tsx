/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { bundledDocumentsMatch, LegalDocumentPage, parseLegalMarkdown } from './LegalDocument';

afterEach(cleanup);

describe('documenti legali pubblici', () => {
  it('renderizza titoli, elenchi e tabelle senza eseguire HTML dal markdown', () => {
    const blocks = parseLegalMarkdown(['# Titolo', '', '- Uno', '- Due', '', '| A | B |', '| --- | --- |', '| 1 | 2 |'].join(String.fromCharCode(10)));
    expect(blocks.map((block) => block.type)).toEqual(['heading', 'list', 'table']);
  });

  it('espone la versione esatta e la navigazione pubblica', () => {
    render(<LegalDocumentPage kind="terms" />);
    expect(screen.getByText('Versione 0.2')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('/privacy/');
  });

  it('pubblica anche la pagina operativa Account e dati', () => {
    render(<LegalDocumentPage kind="account" />);
    expect(screen.getByText('Versione 0.2')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Account e dati FunghiTracker' })).toBeTruthy();
  });

  it('blocca la riaccettazione se le versioni non coincidono', () => {
    expect(bundledDocumentsMatch('0.2', '0.3')).toBe(true);
    expect(bundledDocumentsMatch('0.2', '0.4')).toBe(false);
  });
});