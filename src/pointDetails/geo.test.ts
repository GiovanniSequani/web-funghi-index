import { describe, expect, it } from 'vitest';
import {
  aspectDirection,
  coordinateToGridCell,
  coordinateToTerrainCell,
  indexFromClientX,
  isPointInBbox,
  moveSelectedIndex,
  tpiLabel,
} from './geo';
import type { GridDefinition } from './types';

const weatherGrid: GridDefinition = {
  rows: 84,
  cols: 117,
  step_deg: 0.018,
  origin_lat: 45.6015,
  origin_lon: 10.4015,
  bbox: { west: 10.4, south: 45.6, east: 12.5, north: 47.1 },
};

const terrainGrid: GridDefinition = {
  rows: 500,
  cols: 700,
  step_deg: 0.003,
  origin_lat: 45.6015,
  origin_lon: 10.4015,
  bbox: { west: 10.4, south: 45.6, east: 12.5, north: 47.1 },
};

describe('coordinate e bbox', () => {
  it('rifiuta i punti fuori bbox senza trasformarli in celle di bordo', () => {
    const outside = { latitude: 46, longitude: 12.5001 };
    expect(isPointInBbox(outside, weatherGrid.bbox)).toBe(false);
    expect(coordinateToGridCell(outside, weatherGrid)).toBeNull();
  });

  it('calcola la cella meteo con arrotondamento alla cella più vicina', () => {
    expect(
      coordinateToGridCell(
        { latitude: weatherGrid.origin_lat + weatherGrid.step_deg, longitude: weatherGrid.origin_lon },
        weatherGrid,
      ),
    ).toEqual({ row: 1, col: 0 });
  });

  it('clampa soltanto un punto valido sul bordo della griglia meteo', () => {
    expect(
      coordinateToGridCell(
        { latitude: weatherGrid.bbox.north, longitude: weatherGrid.bbox.east },
        weatherGrid,
      ),
    ).toEqual({ row: 83, col: 116 });
  });

  it('calcola cella e chunk terreno anche sul bordo nord-est', () => {
    expect(
      coordinateToTerrainCell(
        { latitude: terrainGrid.bbox.north, longitude: terrainGrid.bbox.east },
        terrainGrid,
      ),
    ).toEqual({
      row: 499,
      col: 699,
      chunkRow: 9,
      chunkCol: 13,
      localRow: 49,
      localCol: 49,
    });
  });
});

describe('mapping terreno', () => {
  it.each([
    [0, 'N'],
    [22.4, 'N'],
    [22.5, 'NE'],
    [90, 'E'],
    [180, 'S'],
    [225, 'SO'],
    [270, 'O'],
    [315, 'NO'],
    [359.9, 'N'],
  ])('converte aspect %s° in %s', (degrees, expected) => {
    expect(aspectDirection(degrees)).toBe(expected);
  });

  it.each([
    [0, 'Non disponibile'],
    [1, 'Sottoelevato'],
    [2, 'In media'],
    [3, 'Sopraelevato'],
    [4, 'Non disponibile'],
  ])('converte TPI %s in %s', (category, expected) => {
    expect(tpiLabel(category)).toBe(expected);
  });
});

describe('sincronizzazione grafici', () => {
  it('mappa hover, click e touch sulla stessa scala di 20 giorni', () => {
    expect(indexFromClientX(100, 100, 400, 20)).toBe(0);
    expect(indexFromClientX(300, 100, 400, 20)).toBe(10);
    expect(indexFromClientX(500, 100, 400, 20)).toBe(19);
  });

  it('supporta la navigazione da tastiera condivisa', () => {
    expect(moveSelectedIndex(10, 'ArrowLeft', 20)).toBe(9);
    expect(moveSelectedIndex(10, 'ArrowRight', 20)).toBe(11);
    expect(moveSelectedIndex(10, 'Home', 20)).toBe(0);
    expect(moveSelectedIndex(10, 'End', 20)).toBe(19);
  });
});
