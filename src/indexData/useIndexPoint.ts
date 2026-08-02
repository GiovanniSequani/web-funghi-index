import React from 'react';
import { DataUnavailableError, OutsideCoverageError, isAbortError } from '../pointDetails/errors';
import type { MapPoint, ResourceState } from '../pointDetails/types';
import { loadIndexPoint } from './client';
import type { IndexPointData } from './types';

const idleState = (): ResourceState<IndexPointData> => ({
  status: 'idle',
  data: null,
  message: null,
});

export type IndexPointLoader = (
  point: MapPoint,
  signal?: AbortSignal,
) => Promise<IndexPointData>;

function errorState(error: unknown): ResourceState<IndexPointData> {
  if (error instanceof OutsideCoverageError) {
    return { status: 'outside', data: null, message: error.message };
  }
  if (error instanceof DataUnavailableError) {
    return { status: 'unavailable', data: null, message: error.message };
  }
  return {
    status: 'error',
    data: null,
    message: error instanceof Error ? error.message : 'Errore durante il caricamento dell’indice.',
  };
}

export function useIndexPoint(
  point: MapPoint | null,
  open: boolean,
  loader: IndexPointLoader = loadIndexPoint,
) {
  const [state, setState] = React.useState<ResourceState<IndexPointData>>(idleState);
  const [retryToken, setRetryToken] = React.useState(0);
  const requestIdRef = React.useRef(0);

  React.useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!open || !point) {
      setState(idleState());
      return undefined;
    }

    const controller = new AbortController();
    setState({ status: 'loading', data: null, message: null });
    void loader(point, controller.signal).then(
      (data) => {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        setState({ status: 'success', data, message: null });
      },
      (error: unknown) => {
        if (isAbortError(error) || requestId !== requestIdRef.current) return;
        setState(errorState(error));
      },
    );

    return () => controller.abort();
  }, [loader, open, point?.latitude, point?.longitude, retryToken]);

  const retry = React.useCallback(() => setRetryToken((value) => value + 1), []);
  return { state, retry };
}
