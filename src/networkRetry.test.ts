import { describe, expect, it } from 'vitest';
import { backoffDelay, parseRetryAfter, retryAfterFromError } from './networkRetry';

describe('network retry', () => {
  it('applica backoff esponenziale, jitter e limite', () => {
    const options = { baseDelayMs: 1_000, maxDelayMs: 10_000, random: () => 0.5 };
    expect(backoffDelay(0, options)).toBe(1_000);
    expect(backoffDelay(3, options)).toBe(8_000);
    expect(backoffDelay(8, options)).toBe(10_000);
  });

  it('rispetta Retry-After in secondi e data HTTP entro il limite', () => {
    expect(parseRetryAfter('12')).toBe(12_000);
    expect(parseRetryAfter('Thu, 10 Sep 2026 10:00:10 GMT', Date.parse('2026-09-10T10:00:00Z'))).toBe(10_000);
    const error = { cause: { context: { headers: new Headers({ 'Retry-After': '7' }) } } };
    expect(retryAfterFromError(error)).toBe(7_000);
    expect(backoffDelay(0, { baseDelayMs: 1_000, maxDelayMs: 5_000, random: () => 0.5 }, 8_000)).toBe(5_000);
  });
});
