import { describe, expect, it } from 'vitest';
import { filterTileSetsForIndexAccess, selectLimitedIndexDay } from './indexAccess';
import type { IndexHistoryPointData } from './indexData/historyTypes';

describe('accesso indice', () => {
  it('limita le tiles a D-27..D-7 e mantiene tutte le versioni ammesse', () => {
    const tiles = [
      { date: '2026-09-07', version: '2' },
      { date: '2026-09-07', version: '1' },
      { date: '2026-09-01', version: '1' },
      { date: '2026-08-31', version: '2' },
      { date: '2026-08-31', version: '1' },
      { date: '2026-08-11', version: '1' },
      { date: '2026-08-10', version: '1' },
    ];

    expect(filterTileSetsForIndexAccess(tiles, false)).toEqual([
      { date: '2026-08-31', version: '2' },
      { date: '2026-08-31', version: '1' },
      { date: '2026-08-11', version: '1' },
    ]);
    expect(filterTileSetsForIndexAccess(tiles, true)).toBe(tiles);
  });

  it('usa il giorno disponibile precedente quando D-7 manca senza estendere la finestra', () => {
    const data: IndexHistoryPointData = {
      version: 'v1', indexDate: '2026-09-07', row: 1, col: 2,
      missingDates: ['2026-08-31'],
      days: [
        { date: '2026-08-30', porciniScore: 40, finferliScore: 30 },
        { date: '2026-08-31', porciniScore: null, finferliScore: null },
        { date: '2026-09-01', porciniScore: 90, finferliScore: 80 },
      ],
    };

    expect(selectLimitedIndexDay(data)).toEqual(data.days[0]);
  });
});
