import React from 'react';
import { DataUnavailableError, OutsideCoverageError, isAbortError } from './errors';
import { loadTerrainPoint } from './terrainClient';
import type {
  MapPoint,
  PointDetailsState,
  ResourceState,
  TerrainPointData,
  WeatherPointData,
} from './types';
import { loadWeatherPoint } from './weatherClient';

const idleResource = <T,>(): ResourceState<T> => ({
  status: 'idle',
  data: null,
  message: null,
});

const loadingResource = <T,>(): ResourceState<T> => ({
  status: 'loading',
  data: null,
  message: null,
});

export type PointDetailsLoaders = {
  weather: (point: MapPoint, signal?: AbortSignal) => Promise<WeatherPointData>;
  terrain: (point: MapPoint, signal?: AbortSignal) => Promise<TerrainPointData>;
};

const defaultLoaders: PointDetailsLoaders = {
  weather: loadWeatherPoint,
  terrain: loadTerrainPoint,
};

function resourceError<T>(error: unknown, fallback: string): ResourceState<T> {
  if (error instanceof OutsideCoverageError) {
    return { status: 'outside', data: null, message: error.message };
  }
  if (error instanceof DataUnavailableError) {
    return { status: 'unavailable', data: null, message: error.message };
  }
  return {
    status: 'error',
    data: null,
    message: error instanceof Error ? error.message : fallback,
  };
}

export function usePointDetails(
  point: MapPoint | null,
  open: boolean,
  loaders: PointDetailsLoaders = defaultLoaders,
) {
  const [state, setState] = React.useState<PointDetailsState>({
    weather: idleResource(),
    terrain: idleResource(),
  });
  const [retryToken, setRetryToken] = React.useState(0);
  const requestIdRef = React.useRef(0);

  React.useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!open || !point) {
      setState({ weather: idleResource(), terrain: idleResource() });
      return undefined;
    }

    const controller = new AbortController();
    setState({ weather: loadingResource(), terrain: loadingResource() });

    void loaders.weather(point, controller.signal).then(
      (data) => {
        if (requestId !== requestIdRef.current || controller.signal.aborted) return;
        setState((current) => ({
          ...current,
          weather: { status: 'success', data, message: null },
        }));
      },
      (error: unknown) => {
        if (isAbortError(error) || requestId !== requestIdRef.current) return;
        setState((current) => ({
          ...current,
          weather: resourceError(error, 'Errore durante il caricamento dei dati meteo.'),
        }));
      },
    );

    void loaders.terrain(point, controller.signal).then(
      (data) => {
        if (requestId !== requestIdRef.current || controller.signal.aborted) return;
        setState((current) => ({
          ...current,
          terrain: { status: 'success', data, message: null },
        }));
      },
      (error: unknown) => {
        if (isAbortError(error) || requestId !== requestIdRef.current) return;
        setState((current) => ({
          ...current,
          terrain: resourceError(error, 'Errore durante il caricamento dei dati del terreno.'),
        }));
      },
    );

    return () => controller.abort();
  }, [loaders, open, point?.latitude, point?.longitude, retryToken]);

  const retry = React.useCallback(() => setRetryToken((value) => value + 1), []);

  return { ...state, retry };
}
