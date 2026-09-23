type SourceMarkerProperties = {
  kind?: string;
  species?: 'porcino' | 'finferlo';
  markerSpecies?: 'porcini' | 'finferli' | 'mixed';
  countLabel?: string;
  porciniCount?: number;
  finferliCount?: number;
};

export type ClusteredMushroomProperties = {
  kind: 'mushroom-marker';
  markerSpecies: 'porcini' | 'finferli' | 'mixed';
  count: number;
  porciniCount: number;
  finferliCount: number;
  countLabel: string;
  clustered: boolean;
};

type MushroomFeature = GeoJSON.Feature<GeoJSON.Point, SourceMarkerProperties>;
export type ClusteredMushroomFeature = GeoJSON.Feature<GeoJSON.Point, ClusteredMushroomProperties>;

type Group = {
  longitude: number;
  latitude: number;
  porciniCount: number;
  finferliCount: number;
  ids: string[];
};

const MERCATOR_TILE_SIZE = 512;
const MAX_CLUSTER_ZOOM = 15;
const CLUSTER_RADIUS_PX = 44;

function toCounts(feature: MushroomFeature): Pick<Group, 'porciniCount' | 'finferliCount'> | null {
  const properties = feature.properties ?? {};
  if (properties.kind === 'finding') {
    return properties.species === 'porcino'
      ? { porciniCount: 1, finferliCount: 0 }
      : properties.species === 'finferlo' ? { porciniCount: 0, finferliCount: 1 } : null;
  }
  if (properties.kind === 'cloud-marker') {
    const porciniCount = properties.porciniCount;
    const finferliCount = properties.finferliCount;
    if (typeof porciniCount === 'number' && typeof finferliCount === 'number'
      && Number.isSafeInteger(porciniCount) && Number.isSafeInteger(finferliCount)) {
      return { porciniCount, finferliCount };
    }
    const label = properties.countLabel ?? '';
    const porcini = Number(/^P(\d+)/.exec(label)?.[1] ?? 0);
    const finferli = Number(/F(\d+)/.exec(label)?.[1] ?? 0);
    if (porcini + finferli > 0) return { porciniCount: porcini, finferliCount: finferli };
  }
  return null;
}

function markerProperties(group: Group, clustered: boolean): ClusteredMushroomProperties {
  const count = group.porciniCount + group.finferliCount;
  const markerSpecies = group.porciniCount > 0 && group.finferliCount > 0
    ? 'mixed' as const
    : group.porciniCount > 0 ? 'porcini' as const : 'finferli' as const;
  const countLabel = markerSpecies === 'mixed'
    ? `P${group.porciniCount}\nF${group.finferliCount}`
    : `${markerSpecies === 'porcini' ? 'P' : 'F'}${count}`;
  return { kind: 'mushroom-marker', markerSpecies, count, porciniCount: group.porciniCount, finferliCount: group.finferliCount, countLabel, clustered };
}

function mercatorPixel([longitude, rawLatitude]: GeoJSON.Position, zoom: number): [number, number] {
  const latitude = Math.max(-85.05112878, Math.min(85.05112878, rawLatitude));
  const worldSize = MERCATOR_TILE_SIZE * (2 ** zoom);
  const sinLatitude = Math.sin(latitude * Math.PI / 180);
  return [
    ((longitude + 180) / 360) * worldSize,
    (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * worldSize,
  ];
}

function mergeExactMarkers(features: MushroomFeature[]): Group[] {
  const groups = new Map<string, Group>();
  features.forEach((feature, index) => {
    const counts = toCounts(feature);
    const [longitude, latitude] = feature.geometry.coordinates;
    if (!counts || !Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
    const key = `${longitude.toFixed(7)}:${latitude.toFixed(7)}`;
    const group = groups.get(key) ?? { longitude, latitude, porciniCount: 0, finferliCount: 0, ids: [] };
    group.porciniCount += counts.porciniCount;
    group.finferliCount += counts.finferliCount;
    group.ids.push(String(feature.id ?? index));
    groups.set(key, group);
  });
  return [...groups.values()];
}

/**
 * Matches the mobile map behavior: exact positions always show one total,
 * while nearby positions merge only when their on-screen distance is small.
 * It reads the current zoom but never changes map camera state.
 */
export function clusterMushroomFeatures(features: MushroomFeature[], zoom: number, radiusPx = CLUSTER_RADIUS_PX): ClusteredMushroomFeature[] {
  const exactGroups = mergeExactMarkers(features);
  if (exactGroups.length === 0) return [];
  if (exactGroups.length === 1 || !Number.isFinite(zoom) || zoom >= MAX_CLUSTER_ZOOM) {
    return exactGroups.map((group) => ({
      type: 'Feature',
      id: `mushroom-${group.ids.join('-')}`,
      geometry: { type: 'Point', coordinates: [group.longitude, group.latitude] },
      properties: markerProperties(group, group.ids.length > 1),
    }));
  }

  const pixels = exactGroups.map((group) => mercatorPixel([group.longitude, group.latitude], zoom));
  const parent = exactGroups.map((_, index) => index);
  const cells = new Map<string, number[]>();
  const find = (index: number): number => {
    let root = index;
    while (parent[root] !== root) root = parent[root];
    while (parent[index] !== index) {
      const next = parent[index];
      parent[index] = root;
      index = next;
    }
    return root;
  };
  const unite = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };

  pixels.forEach(([x, y], index) => {
    const cellX = Math.floor(x / radiusPx);
    const cellY = Math.floor(y / radiusPx);
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (const candidate of cells.get(`${cellX + offsetX}:${cellY + offsetY}`) ?? []) {
          if (Math.hypot(x - pixels[candidate][0], y - pixels[candidate][1]) <= radiusPx) unite(index, candidate);
        }
      }
    }
    const key = `${cellX}:${cellY}`;
    cells.set(key, [...(cells.get(key) ?? []), index]);
  });

  const groups = new Map<number, number[]>();
  exactGroups.forEach((_, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) ?? []), index]);
  });

  return [...groups.values()].map((indices) => {
    const group: Group = { longitude: 0, latitude: 0, porciniCount: 0, finferliCount: 0, ids: [] };
    let weight = 0;
    for (const index of indices) {
      const source = exactGroups[index];
      const count = source.porciniCount + source.finferliCount;
      group.porciniCount += source.porciniCount;
      group.finferliCount += source.finferliCount;
      group.longitude += source.longitude * count;
      group.latitude += source.latitude * count;
      group.ids.push(...source.ids);
      weight += count;
    }
    group.longitude /= weight;
    group.latitude /= weight;
    return {
      type: 'Feature',
      id: `mushroom-cluster-${group.ids.join('-')}`,
      geometry: { type: 'Point', coordinates: [group.longitude, group.latitude] },
      properties: markerProperties(group, indices.length > 1 || group.ids.length > 1),
    };
  });
}
