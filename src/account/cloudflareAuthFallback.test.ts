import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Cloudflare auth routes', () => {
  it('usa il fallback SPA nativo di Cloudflare senza redirect canonici alla root', () => {
    expect(existsSync('public/_redirects')).toBe(false);
    expect(existsSync('public/404.html')).toBe(false);
  });

  it('evita cache e referrer sulle pagine che ricevono token', () => {
    const headers = readFileSync('public/_headers', 'utf8');
    expect(headers).toMatch(/\/auth\/\*[\s\S]*Cache-Control: no-store[\s\S]*Referrer-Policy: no-referrer/);
    expect(headers).toMatch(/\/elimina-account[\s\S]*Cache-Control: no-store[\s\S]*Referrer-Policy: no-referrer/);
  });
});
