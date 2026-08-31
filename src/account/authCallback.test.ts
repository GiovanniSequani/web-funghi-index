import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  isUsedOrExpiredTokenError,
  parseAuthCallback,
  resolveAuthCallbackMode,
  updateRecoveryPassword,
  verifyAuthCallback,
} from './authCallback';

describe('auth callback contract', () => {
  it('accetta solo type coerenti con la pagina e un solo token_hash', () => {
    expect(parseAuthCallback('?type=signup&token_hash=abc123', 'confirm')).toEqual({
      valid: true,
      type: 'signup',
      tokenHash: 'abc123',
    });
    expect(parseAuthCallback('?type=recovery&token_hash=abc123', 'recovery')).toEqual({
      valid: true,
      type: 'recovery',
      tokenHash: 'abc123',
    });
    expect(parseAuthCallback('?type=recovery&token_hash=abc123', 'confirm').valid).toBe(false);
    expect(parseAuthCallback('?type=signup&token_hash=one&token_hash=two', 'confirm').valid).toBe(false);
    expect(parseAuthCallback('?type=signup', 'confirm').valid).toBe(false);
  });

  it('inoltra token_hash e type a verifyOtp senza altri dati', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ data: {}, error: null });
    const supabase = { auth: { verifyOtp } } as unknown as SupabaseClient;
    const callback = parseAuthCallback('?type=email&token_hash=secret-token', 'confirm');
    if (!callback.valid) throw new Error('callback fixture non valida');

    await verifyAuthCallback(callback, supabase);

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'secret-token', type: 'email' });
  });

  it('aggiorna la password recovery con updateUser', async () => {
    const updateUser = vi.fn().mockResolvedValue({ data: {}, error: null });
    const supabase = { auth: { updateUser } } as unknown as SupabaseClient;

    await updateRecoveryPassword('nuova-password', supabase);

    expect(updateUser).toHaveBeenCalledWith({ password: 'nuova-password' });
  });

  it('riconosce i link già usati o scaduti senza esporre dettagli sensibili', () => {
    expect(isUsedOrExpiredTokenError({ code: 'otp_expired', message: 'Token has expired or is invalid' })).toBe(true);
    expect(isUsedOrExpiredTokenError({ message: 'network failed' })).toBe(false);
  });

  it('instrada anche i link legacy che il template Supabase apre sulla root', () => {
    expect(resolveAuthCallbackMode('/', '?token_hash=abc123&type=email')).toBe('confirm');
    expect(resolveAuthCallbackMode('/', '?token_hash=abc123&type=signup')).toBe('confirm');
    expect(resolveAuthCallbackMode('/', '?token_hash=abc123&type=recovery')).toBe('recovery');
    expect(resolveAuthCallbackMode('/', '?type=email')).toBeNull();
    expect(resolveAuthCallbackMode('/mappa', '?token_hash=abc123&type=email')).toBeNull();
  });

  it('mantiene disponibili i percorsi auth espliciti anche con parametri invalidi', () => {
    expect(resolveAuthCallbackMode('/auth/confirm', '')).toBe('confirm');
    expect(resolveAuthCallbackMode('/auth/recovery/', '')).toBe('recovery');
  });
});
