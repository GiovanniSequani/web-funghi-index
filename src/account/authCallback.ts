import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js';
import { getAccountSupabaseClient } from './client';

export type AuthCallbackMode = 'confirm' | 'recovery';

export type ParsedAuthCallback =
  | { valid: true; tokenHash: string; type: EmailOtpType }
  | { valid: false; message: string };

const CONFIRM_TYPES = new Set<EmailOtpType>(['signup', 'email']);

export function parseAuthCallback(search: string, mode: AuthCallbackMode): ParsedAuthCallback {
  const params = new URLSearchParams(search);
  const tokenHashes = params.getAll('token_hash');
  const types = params.getAll('type');
  if (tokenHashes.length !== 1 || types.length !== 1) {
    return { valid: false, message: 'Il link non è valido o è incompleto.' };
  }

  const tokenHash = tokenHashes[0].trim();
  const type = types[0];
  if (!tokenHash || tokenHash.length > 2048 || /[\s\u0000-\u001f]/u.test(tokenHash)) {
    return { valid: false, message: 'Il link non è valido o è incompleto.' };
  }

  const typeIsValid = mode === 'recovery'
    ? type === 'recovery'
    : CONFIRM_TYPES.has(type as EmailOtpType);
  if (!typeIsValid) {
    return { valid: false, message: 'Questo link non è adatto a questa operazione.' };
  }

  return { valid: true, tokenHash, type: type as EmailOtpType };
}

export function isUsedOrExpiredTokenError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string };
  return /expired|invalid.*(?:token|otp)|(?:token|otp).*invalid|already.*used|otp_expired/i
    .test(`${candidate?.code ?? ''} ${candidate?.message ?? ''}`);
}

export async function verifyAuthCallback(
  callback: Extract<ParsedAuthCallback, { valid: true }>,
  supabase: SupabaseClient = getAccountSupabaseClient(),
): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    token_hash: callback.tokenHash,
    type: callback.type,
  });
  if (error) throw error;
}

export async function updateRecoveryPassword(
  password: string,
  supabase: SupabaseClient = getAccountSupabaseClient(),
): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
