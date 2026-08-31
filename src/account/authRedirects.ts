const DEVELOPMENT_AUTH_ORIGIN = 'http://localhost:5173';
const PRODUCTION_AUTH_ORIGIN = 'https://web-funghi-index.pages.dev';

export type AuthCallbackPath = '/auth/confirm' | '/auth/recovery';

export function getAuthCallbackUrl(
  path: AuthCallbackPath,
  isDevelopment = import.meta.env.DEV,
): string {
  return `${isDevelopment ? DEVELOPMENT_AUTH_ORIGIN : PRODUCTION_AUTH_ORIGIN}${path}`;
}
