import { describe, expect, it, vi } from 'vitest';
import {
  buildMobileConfirmDeepLink,
  consumeMobileConfirmCallback,
  MOBILE_CONFIRM_DEVELOPMENT_URL,
  MOBILE_CONFIRM_PRODUCTION_URL,
} from './mobileAuthBridge';

describe('mobile auth HTTPS bridge', () => {
  it('consuma il cold path valido e ripulisce subito la URL', () => {
    const replaceUrl = vi.fn();

    const callback = consumeMobileConfirmCallback(
      '/auth/mobile-confirm',
      '?token_hash=abc123&type=email',
      replaceUrl,
    );

    expect(callback).toEqual({ valid: true, tokenHash: 'abc123', type: 'email' });
    expect(replaceUrl).toHaveBeenCalledWith('/auth/mobile-confirm');
  });

  it('supporta signup e rifiuta type non ammessi o parametri duplicati', () => {
    expect(consumeMobileConfirmCallback(
      '/auth/mobile-confirm/',
      '?type=signup&token_hash=abc123',
      vi.fn(),
    )).toMatchObject({ valid: true, type: 'signup' });
    expect(consumeMobileConfirmCallback(
      '/auth/mobile-confirm',
      '?type=recovery&token_hash=abc123',
      vi.fn(),
    )).toMatchObject({ valid: false });
    expect(consumeMobileConfirmCallback(
      '/auth/mobile-confirm',
      '?type=email&token_hash=one&token_hash=two',
      vi.fn(),
    )).toMatchObject({ valid: false });
  });

  it('non intercetta percorsi diversi dal bridge', () => {
    const replaceUrl = vi.fn();
    expect(consumeMobileConfirmCallback('/auth/confirm', '?type=email&token_hash=abc123', replaceUrl)).toBeNull();
    expect(replaceUrl).not.toHaveBeenCalled();
  });

  it('codifica ogni parametro quando costruisce il deep link', () => {
    expect(buildMobileConfirmDeepLink({
      valid: true,
      tokenHash: 'abc+123/=?',
      type: 'email',
    })).toBe('funghitracker://auth/confirm?token_hash=abc%2B123%2F%3D%3F&type=email');
  });

  it('espone gli URL esatti da inserire nella allow-list Supabase', () => {
    expect(MOBILE_CONFIRM_PRODUCTION_URL).toBe('https://web-funghi-index.pages.dev/auth/mobile-confirm');
    expect(MOBILE_CONFIRM_DEVELOPMENT_URL).toBe('http://localhost:5173/auth/mobile-confirm');
  });
});