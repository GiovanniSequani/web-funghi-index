export type BackoffOptions = {
  baseDelayMs: number;
  maxDelayMs: number;
  random?: () => number;
};

export function parseRetryAfter(value: string | null | undefined, now = Date.now()): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

export function retryAfterFromError(error: unknown, now = Date.now()): number | null {
  const visited = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current);
    const record = current as Record<string, unknown>;
    const direct = record.retryAfter ?? record.retry_after;
    if (typeof direct === 'number' && direct >= 0) return direct > 1_000 ? direct : direct * 1_000;
    if (typeof direct === 'string') {
      const parsed = parseRetryAfter(direct, now);
      if (parsed !== null) return parsed;
    }
    const headers = record.headers ?? (record.context as Record<string, unknown> | undefined)?.headers;
    if (headers && typeof (headers as Headers).get === 'function') {
      const parsed = parseRetryAfter((headers as Headers).get('Retry-After'), now);
      if (parsed !== null) return parsed;
    }
    current = record.cause;
  }
  return null;
}

export function backoffDelay(attempt: number, options: BackoffOptions, retryAfterMs?: number | null): number {
  const exponential = Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** Math.max(0, attempt));
  const random = options.random?.() ?? Math.random();
  const jittered = exponential * (0.75 + Math.min(1, Math.max(0, random)) * 0.5);
  return Math.round(Math.min(options.maxDelayMs, Math.max(jittered, retryAfterMs ?? 0)));
}

export function browserIsOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

export function waitForDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); return; }
    const timer = globalThis.setTimeout(finish, milliseconds);
    function finish() { cleanup(); resolve(); }
    function abort() { cleanup(); reject(signal?.reason ?? new DOMException('Aborted', 'AbortError')); }
    function cleanup() { globalThis.clearTimeout(timer); signal?.removeEventListener('abort', abort); }
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export function waitUntilOnline(signal?: AbortSignal): Promise<void> {
  if (browserIsOnline() || typeof window === 'undefined') return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); return; }
    function online() { cleanup(); resolve(); }
    function abort() { cleanup(); reject(signal?.reason ?? new DOMException('Aborted', 'AbortError')); }
    function cleanup() {
      window.removeEventListener('online', online);
      signal?.removeEventListener('abort', abort);
    }
    window.addEventListener('online', online, { once: true });
    signal?.addEventListener('abort', abort, { once: true });
  });
}
