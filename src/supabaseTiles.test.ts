import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAvailableTileSets } from './supabaseTiles';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('tile manifest retry', () => {
  it('ritenta errori transitori e rispetta Retry-After', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '0' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ tileSets: [{ date: '2026-09-10', version: '2' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    const result = getAvailableTileSets();
    await vi.runAllTimersAsync();
    await expect(result).resolves.toEqual([{ date: '2026-09-10', version: '2' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('non ritenta errori definitivi', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(getAvailableTileSets()).rejects.toThrow('Tile manifest failed: 404');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
