import { describe, expect, it } from 'vitest';
import { lastAvailableDayIndex } from './decoders';
import type { WeatherDay } from './types';

function day(date: string, value: number | null, missing = false): WeatherDay {
  return {
    date,
    missing,
    temperatureMin: value,
    temperatureMax: value,
    precipitation: value,
    humidity: value,
    gust: value,
  };
}

describe('giorno iniziale', () => {
  it('seleziona l’ultimo giorno realmente disponibile', () => {
    expect(
      lastAvailableDayIndex([
        day('2026-07-22', 10),
        day('2026-07-23', 11),
        day('2026-07-24', null, true),
      ]),
    ).toBe(1);
  });
});
