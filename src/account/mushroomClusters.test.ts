import { describe, expect, it } from 'vitest';
import { clusterMushroomFeatures } from './mushroomClusters';

function marker(longitude: number, latitude: number, kind: 'finding' | 'cloud-marker', properties: Record<string, unknown>) {
  return {
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [longitude, latitude] as [number, number] },
    properties: { kind, ...properties },
  };
}

describe('mushroom markers on cloud tracks', () => {
  it('accorpa marker nello stesso punto e conserva il totale delle due specie', () => {
    const result = clusterMushroomFeatures([
      marker(11.5, 46.3, 'finding', { species: 'porcino' }),
      marker(11.5, 46.3, 'cloud-marker', { porciniCount: 2, finferliCount: 3, countLabel: 'P2 F3' }),
    ], 16);

    expect(result).toHaveLength(1);
    expect(result[0].properties).toMatchObject({ markerSpecies: 'mixed', porciniCount: 3, finferliCount: 3, count: 6, countLabel: 'P3 F3', porciniLabel: 'P3', finferliLabel: 'F3' });
  });

  it('accorpa punti vicini solo a zoom ridotto e li separa ad alto zoom', () => {
    const nearby = [
      marker(11.5, 46.3, 'finding', { species: 'porcino' }),
      marker(11.50035, 46.3001, 'finding', { species: 'finferlo' }),
    ];

    expect(clusterMushroomFeatures(nearby, 11)).toHaveLength(1);
    expect(clusterMushroomFeatures(nearby, 18)).toHaveLength(2);
  });

  it('mantiene una sigla leggibile anche per un singolo marker', () => {
    const result = clusterMushroomFeatures([
      marker(11.5, 46.3, 'cloud-marker', { porciniCount: 4, finferliCount: 0, countLabel: 'P4' }),
    ], 18);

    expect(result[0].properties).toMatchObject({ markerSpecies: 'porcini', countLabel: 'P4', count: 4 });
  });
});
