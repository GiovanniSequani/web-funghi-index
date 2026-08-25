import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MapPoint } from '../pointDetails/types';
import type { IndexHistoryPointData } from './historyTypes';
import { useIndexHistory } from './useIndexHistory';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function dataFor(point: MapPoint): IndexHistoryPointData {
  return {
    version: 'v-' + point.longitude,
    indexDate: '2026-08-24',
    row: 0,
    col: 0,
    missingDates: [],
    days: [{ date: '2026-08-24', porciniScore: point.longitude, finferliScore: point.latitude }],
  };
}

describe('useIndexHistory', () => {
  it('annulla la richiesta precedente e ignora risposte stale', async () => {
    const calls = new Map<
      number,
      { request: ReturnType<typeof deferred<IndexHistoryPointData>>; signal?: AbortSignal }
    >();
    const loader = (point: MapPoint, signal?: AbortSignal) => {
      const request = deferred<IndexHistoryPointData>();
      calls.set(point.longitude, { request, signal });
      return request.promise;
    };
    const first = { latitude: 46, longitude: 11 };
    const second = { latitude: 46.1, longitude: 12 };
    const { result, rerender } = renderHook(
      ({ point }) => useIndexHistory(point, true, loader),
      { initialProps: { point: first } },
    );

    await waitFor(() => expect(calls.get(11)).toBeDefined());
    rerender({ point: second });
    await waitFor(() => expect(calls.get(12)).toBeDefined());
    expect(calls.get(11)?.signal?.aborted).toBe(true);

    await act(async () => {
      calls.get(12)?.request.resolve(dataFor(second));
    });
    await waitFor(() => expect(result.current.state.status).toBe('success'));
    expect(result.current.state.data?.version).toBe('v-12');

    await act(async () => {
      calls.get(11)?.request.resolve(dataFor(first));
    });
    expect(result.current.state.data?.version).toBe('v-12');
  });
});