import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MapPoint, TerrainPointData, WeatherPointData } from './types';
import { usePointDetails, type PointDetailsLoaders } from './usePointDetails';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function weatherFor(point: MapPoint): WeatherPointData {
  return {
    version: `weather-${point.longitude}`,
    row: 0,
    col: 0,
    availableDayCount: 1,
    missingDates: [],
    days: [
      {
        date: '2026-07-24',
        missing: false,
        temperatureMin: point.longitude,
        temperatureMax: point.longitude,
        precipitation: 0,
        humidity: 50,
        gust: 10,
      },
    ],
  };
}

function terrainFor(point: MapPoint): TerrainPointData {
  return {
    version: `terrain-${point.longitude}`,
    row: 0,
    col: 0,
    elevation: point.longitude,
    forestPercent: 50,
    aspectDegrees: 90,
    tpiCategory: 2,
  };
}

describe('usePointDetails', () => {
  it('carica meteo e terreno in parallelo e impedisce aggiornamenti stale', async () => {
    const calls = new Map<number, {
      weather: ReturnType<typeof deferred<WeatherPointData>>;
      terrain: ReturnType<typeof deferred<TerrainPointData>>;
      weatherSignal?: AbortSignal;
      terrainSignal?: AbortSignal;
    }>();

    const loaders: PointDetailsLoaders = {
      weather: (point, signal) => {
        const entry = calls.get(point.longitude) ?? {
          weather: deferred<WeatherPointData>(),
          terrain: deferred<TerrainPointData>(),
        };
        entry.weatherSignal = signal;
        calls.set(point.longitude, entry);
        return entry.weather.promise;
      },
      terrain: (point, signal) => {
        const entry = calls.get(point.longitude) ?? {
          weather: deferred<WeatherPointData>(),
          terrain: deferred<TerrainPointData>(),
        };
        entry.terrainSignal = signal;
        calls.set(point.longitude, entry);
        return entry.terrain.promise;
      },
    };

    const firstPoint = { latitude: 46, longitude: 11 };
    const secondPoint = { latitude: 46.1, longitude: 12 };
    const { result, rerender } = renderHook(
      ({ point }) => usePointDetails(point, true, loaders),
      { initialProps: { point: firstPoint } },
    );

    await waitFor(() => expect(calls.get(11)).toBeDefined());
    expect(result.current.weather.status).toBe('loading');
    expect(result.current.terrain.status).toBe('loading');

    rerender({ point: secondPoint });
    await waitFor(() => expect(calls.get(12)).toBeDefined());
    expect(calls.get(11)?.weatherSignal?.aborted).toBe(true);
    expect(calls.get(11)?.terrainSignal?.aborted).toBe(true);

    await act(async () => {
      calls.get(12)?.weather.resolve(weatherFor(secondPoint));
      calls.get(12)?.terrain.resolve(terrainFor(secondPoint));
    });
    await waitFor(() => expect(result.current.weather.status).toBe('success'));
    expect(result.current.weather.data?.version).toBe('weather-12');
    expect(result.current.terrain.data?.version).toBe('terrain-12');

    await act(async () => {
      calls.get(11)?.weather.resolve(weatherFor(firstPoint));
      calls.get(11)?.terrain.resolve(terrainFor(firstPoint));
    });
    expect(result.current.weather.data?.version).toBe('weather-12');
    expect(result.current.terrain.data?.version).toBe('terrain-12');
  });
});
