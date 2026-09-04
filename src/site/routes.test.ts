import { describe, expect, it } from 'vitest';
import { normalizePublicPath, resolvePublicPage } from './routes';

describe('public site routes', () => {
  it('normalizza lo slash finale senza alterare la home', () => {
    expect(normalizePublicPath('/')).toBe('/');
    expect(normalizePublicPath('/mappa/')).toBe('/mappa');
  });

  it('riconosce le pagine pubbliche con e senza slash finale', () => {
    expect(resolvePublicPage('/')).toBe('home');
    expect(resolvePublicPage('/mappa/')).toBe('map');
    expect(resolvePublicPage('/come-funziona')).toBe('method');
    expect(resolvePublicPage('/archivio/')).toBe('archive');
    expect(resolvePublicPage('/non-esiste')).toBe('unknown');
  });
});