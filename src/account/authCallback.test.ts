import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  consumeAuthCallback,
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
    expect(parseAuthCallback('?type=signup&token_hash=abc123&access_token=unexpected', 'confirm').valid).toBe(false);
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

  it('non tratta token su URL arbitrari come callback Auth', () => {
    expect(resolveAuthCallbackMode('/')).toBeNull();
    expect(resolveAuthCallbackMode('/mappa')).toBeNull();
  });

  it('mantiene disponibili i percorsi auth espliciti anche con parametri invalidi', () => {
    expect(resolveAuthCallbackMode('/auth/confirm')).toBe('confirm');
    expect(resolveAuthCallbackMode('/auth/recovery/')).toBe('recovery');
  });

  it('acquisisce il fragment e pulisce URL prima di restituire la callback', () => {
    const replaceUrl = vi.fn();
    const consumed = consumeAuthCallback('/auth/recovery', '', '#type=recovery&token_hash=credential-in-memory', replaceUrl);
    expect(replaceUrl).toHaveBeenCalledWith('/auth/recovery');
    expect(consumed).toEqual({
      mode: 'recovery',
      callback: { valid: true, type: 'recovery', tokenHash: 'credential-in-memory' },
    });
  });

  it('pulisce subito anche query legacy e rifiuta credenziali ambigue', () => {
    const replaceUrl = vi.fn();
    expect(consumeAuthCallback('/auth/confirm', '?type=email&token_hash=legacy', '', replaceUrl))
      .toMatchObject({ mode: 'confirm', callback: { valid: true } });
    expect(replaceUrl).toHaveBeenCalledWith('/auth/confirm');
    expect(consumeAuthCallback('/auth/confirm', '?type=email&token_hash=query', '#type=email&token_hash=fragment', vi.fn())?.callback.valid).toBe(false);
  });
});
