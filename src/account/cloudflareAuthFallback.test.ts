import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Cloudflare auth routes', () => {
  it('pubblica fallback SPA espliciti per confirm e recovery', () => {
    const redirects = readFileSync('public/_redirects', 'utf8');
    expect(redirects).toContain('/auth/confirm /index.html 200');
    expect(redirects).toContain('/auth/recovery /index.html 200');
    expect(redirects).toContain('/auth/mobile-confirm /index.html 200');
  });

  it('evita cache e referrer sulle pagine che ricevono token', () => {
    const headers = readFileSync('public/_headers', 'utf8');
    expect(headers).toMatch(/\/auth\/\*[\s\S]*Cache-Control: no-store[\s\S]*Referrer-Policy: no-referrer/);
  });
});