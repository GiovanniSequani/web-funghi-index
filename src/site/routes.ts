export type PublicPage = 'home' | 'map' | 'method' | 'archive' | 'unknown';

export function normalizePublicPath(pathname: string): string {
  if (pathname === '/') return pathname;
  return pathname.replace(/\/+$/, '');
}

export function resolvePublicPage(pathname: string): PublicPage {
  switch (normalizePublicPath(pathname)) {
    case '/': return 'home';
    case '/mappa': return 'map';
    case '/come-funziona': return 'method';
    case '/archivio': return 'archive';
    default: return 'unknown';
  }
}