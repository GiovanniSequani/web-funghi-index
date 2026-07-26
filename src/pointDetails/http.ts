import { DataUnavailableError, HttpError } from './errors';

export async function fetchJson<T>(
  url: string,
  init: RequestInit,
  unavailableMessage: string,
): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    if (response.status === 404 || response.status === 406) {
      throw new DataUnavailableError(unavailableMessage);
    }
    throw new HttpError(response.status, `${unavailableMessage} (${response.status})`);
  }
  return (await response.json()) as T;
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Richiesta annullata', 'AbortError');
  }
}
