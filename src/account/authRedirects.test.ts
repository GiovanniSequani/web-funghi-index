import { describe, expect, it } from 'vitest';
import { getAuthCallbackUrl } from './authRedirects';

describe('auth redirect URLs', () => {
  it('usa localhost:5173 soltanto in sviluppo', () => {
    expect(getAuthCallbackUrl('/auth/confirm', true)).toBe('http://localhost:5173/auth/confirm');
    expect(getAuthCallbackUrl('/auth/recovery', true)).toBe('http://localhost:5173/auth/recovery');
  });

  it('usa l’origin Cloudflare in produzione', () => {
    expect(getAuthCallbackUrl('/auth/confirm', false)).toBe('https://web-funghi-index.pages.dev/auth/confirm');
    expect(getAuthCallbackUrl('/auth/recovery', false)).toBe('https://web-funghi-index.pages.dev/auth/recovery');
  });
});