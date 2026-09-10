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
    for (const route of ['/elimina-account/', '/elimina-account']) {
      const block = headers.split('\n').slice(headers.split('\n').findIndex((line) => line.trim() === route) + 1, headers.split('\n').findIndex((line) => line.trim() === route) + 3).join('\n');
      expect(block).toContain('Cache-Control: no-store');
      expect(block).toContain('Referrer-Policy: no-referrer');
    }
  });

  it('abilita HSTS per tutte le pagine HTTPS', () => {
    const headers = readFileSync('public/_headers', 'utf8');
    expect(headers).toMatch(/\/\*[\s\S]*Strict-Transport-Security: max-age=31536000; includeSubDomains/);
  });

  it('mantiene allineati gli header sensibili nel fallback Vercel', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    };
    const global = config.headers.find((entry) => entry.source === '/(.*)');
    expect(global?.headers).toContainEqual({ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' });
    for (const source of ['/elimina-account', '/elimina-account/']) {
      const route = config.headers.find((entry) => entry.source === source);
      expect(route?.headers).toContainEqual({ key: 'Cache-Control', value: 'no-store' });
      expect(route?.headers).toContainEqual({ key: 'Referrer-Policy', value: 'no-referrer' });
    }
  });
});
