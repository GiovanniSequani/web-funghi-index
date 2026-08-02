import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MapPoint } from '../pointDetails/types';
import { INDEX_DIAGNOSTIC_NAMES, type IndexPointData } from './types';
import { useIndexPoint } from './useIndexPoint';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function dataFor(point: MapPoint): IndexPointData {
  return {
    version: `v-${point.longitude}`,
    indexDate: '2026-07-26',
    row: 0,
    col: 0,
    porciniScore: point.longitude,
    finferliScore: point.latitude,
    porciniBaseScore: null,
    diagnostics: Object.fromEntries(
      INDEX_DIAGNOSTIC_NAMES.map((name) => [name, null]),
    ) as IndexPointData['diagnostics'],
    diagnosticLabels: {},
    context: {
      configuredLagsDays: [],
      dynamicWeights: {},
      formulas: {},
      thresholds: {},
      incubationNote: null,
      temporalPhaseNote: null,
    },
  };
}

describe('useIndexPoint', () => {
  it('annulla la richiesta precedente e ignora risposte stale', async () => {
    const calls = new Map<
      number,
      { request: ReturnType<typeof deferred<IndexPointData>>; signal?: AbortSignal }
    >();
    const loader = (point: MapPoint, signal?: AbortSignal) => {
      const request = deferred<IndexPointData>();
      calls.set(point.longitude, { request, signal });
      return request.promise;
    };
    const first = { latitude: 46, longitude: 11 };
    const second = { latitude: 46.1, longitude: 12 };
    const { result, rerender } = renderHook(
      ({ point }) => useIndexPoint(point, true, loader),
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
