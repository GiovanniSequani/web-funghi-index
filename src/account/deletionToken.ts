export type DeletionTokenCallback = {
  token: string | null;
  invalid: boolean;
};

export function consumeDeletionToken(
  pathname: string,
  search: string,
  hash: string,
  replaceUrl: (cleanUrl: string) => void,
): DeletionTokenCallback | null {
  const normalizedPath = pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname;
  if (normalizedPath !== '/elimina-account' || !hash) return null;

  const parameters = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const candidate = parameters.get('token')?.trim() ?? '';
  replaceUrl(pathname + search);

  if (!/^[a-f0-9]{64}$/i.test(candidate)) return { token: null, invalid: true };
  return { token: candidate, invalid: false };
}