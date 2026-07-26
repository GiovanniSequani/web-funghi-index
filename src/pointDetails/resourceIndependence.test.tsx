import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataUnavailableError } from './errors';
import type { PointDetailsLoaders } from './usePointDetails';
import { usePointDetails } from './usePointDetails';

describe('stati indipendenti delle sorgenti', () => {
  it('mantiene visibile il terreno quando il meteo non è disponibile', async () => {
    const loaders: PointDetailsLoaders = {
      weather: async () => {
        throw new DataUnavailableError('Meteo non disponibile');
      },
      terrain: async () => ({
        version: 'v1',
        row: 10,
        col: 20,
        elevation: 900,
        forestPercent: 80,
        aspectDegrees: 180,
        tpiCategory: 2,
      }),
    };

    const { result } = renderHook(() =>
      usePointDetails({ latitude: 46, longitude: 11 }, true, loaders),
    );

    await waitFor(() => expect(result.current.weather.status).toBe('unavailable'));
    await waitFor(() => expect(result.current.terrain.status).toBe('success'));
    expect(result.current.weather.data).toBeNull();
    expect(result.current.terrain.data?.elevation).toBe(900);
  });
});
