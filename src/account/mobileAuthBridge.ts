import { parseAuthCallback, type ParsedAuthCallback } from './authCallback';

export const MOBILE_CONFIRM_PATH = '/auth/mobile-confirm';
export const MOBILE_CONFIRM_PRODUCTION_URL = 'https://web-funghi-index.pages.dev/auth/mobile-confirm';
export const MOBILE_CONFIRM_DEVELOPMENT_URL = 'http://localhost:5173/auth/mobile-confirm';

export type MobileConfirmCallback = ParsedAuthCallback;

function normalizePath(pathname: string): string {
  let path = pathname || '/';
  while (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}

export function consumeMobileConfirmCallback(
  pathname: string,
  search: string,
  replaceUrl: (cleanPath: string) => void,
): MobileConfirmCallback | null {
  if (normalizePath(pathname) !== MOBILE_CONFIRM_PATH) return null;

  const callback = parseAuthCallback(search, 'confirm');
  replaceUrl(MOBILE_CONFIRM_PATH);
  return callback;
}

export function buildMobileConfirmDeepLink(
  callback: Extract<MobileConfirmCallback, { valid: true }>,
): string {
  if (callback.type !== 'email' && callback.type !== 'signup') {
    throw new Error('Unsupported mobile confirmation type');
  }
  return `funghitracker://auth/confirm?token_hash=${encodeURIComponent(callback.tokenHash)}&type=${encodeURIComponent(callback.type)}`;
}