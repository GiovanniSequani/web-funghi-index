import type { IndexHistoryDay, IndexHistoryPointData } from './indexData/historyTypes';
import type { TileSet } from './types';

const LIMITED_DELAY_DAYS = 7;
const HISTORY_WINDOW_DAYS = 27;

function parseDate(value: string): Date | null {
  const normalized = value.replace(/_/g, '-');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(normalized + 'T00:00:00Z');
  return Number.isNaN(date.getTime()) ? null : date;
}

function shiftUtcDays(date: Date, days: number): number {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.getTime();
}

export function filterTileSetsForIndexAccess(tileSets: TileSet[], fullAccess: boolean): TileSet[] {
  if (fullAccess || tileSets.length === 0) return tileSets;
  const currentDate = parseDate(tileSets[0].date);
  if (!currentDate) return [];
  const latestAllowed = shiftUtcDays(currentDate, -LIMITED_DELAY_DAYS);
  const earliestAllowed = shiftUtcDays(currentDate, -HISTORY_WINDOW_DAYS);

  return tileSets.filter((tileSet) => {
    const date = parseDate(tileSet.date)?.getTime();
    return date !== undefined && date !== null && date >= earliestAllowed && date <= latestAllowed;
  });
}

export function selectLimitedIndexDay(data: IndexHistoryPointData): IndexHistoryDay | null {
  const currentDate = parseDate(data.indexDate);
  if (!currentDate) return null;
  const latestAllowed = shiftUtcDays(currentDate, -LIMITED_DELAY_DAYS);
  const earliestAllowed = shiftUtcDays(currentDate, -HISTORY_WINDOW_DAYS);
  const missingDates = new Set(data.missingDates);

  return [...data.days].reverse().find((day) => {
    const date = parseDate(day.date)?.getTime();
    return date !== undefined
      && date !== null
      && date >= earliestAllowed
      && date <= latestAllowed
      && !missingDates.has(day.date);
  }) ?? null;
}
