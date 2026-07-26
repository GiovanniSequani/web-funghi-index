import type { BoundingBox, GridCell, GridDefinition, MapPoint, TerrainGridCell } from './types';

export function isPointInBbox(point: MapPoint, bbox: BoundingBox): boolean {
  return (
    point.latitude >= bbox.south &&
    point.latitude <= bbox.north &&
    point.longitude >= bbox.west &&
    point.longitude <= bbox.east
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function coordinateToGridCell(point: MapPoint, grid: GridDefinition): GridCell | null {
  if (!isPointInBbox(point, grid.bbox)) return null;

  return {
    row: clamp(Math.floor((point.latitude - grid.origin_lat) / grid.step_deg + 0.5), 0, grid.rows - 1),
    col: clamp(Math.floor((point.longitude - grid.origin_lon) / grid.step_deg + 0.5), 0, grid.cols - 1),
  };
}

export function coordinateToTerrainCell(
  point: MapPoint,
  grid: GridDefinition,
  chunkRows = 50,
  chunkCols = 50,
): TerrainGridCell | null {
  const cell = coordinateToGridCell(point, grid);
  if (!cell) return null;

  return {
    ...cell,
    chunkRow: Math.floor(cell.row / chunkRows),
    chunkCol: Math.floor(cell.col / chunkCols),
    localRow: cell.row % chunkRows,
    localCol: cell.col % chunkCols,
  };
}

const ASPECT_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] as const;

export function aspectDirection(degrees: number | null): string {
  if (degrees === null || !Number.isFinite(degrees)) return 'Non disponibile';
  const normalized = ((degrees % 360) + 360) % 360;
  return ASPECT_LABELS[Math.floor((normalized + 22.5) / 45) % ASPECT_LABELS.length];
}

export function tpiLabel(category: number): string {
  switch (category) {
    case 1:
      return 'Sottoelevato';
    case 2:
      return 'In media';
    case 3:
      return 'Sopraelevato';
    default:
      return 'Non disponibile';
  }
}

export function indexFromClientX(clientX: number, left: number, width: number, itemCount: number): number {
  if (itemCount <= 1 || width <= 0) return 0;
  const ratio = clamp((clientX - left) / width, 0, 1);
  return Math.round(ratio * (itemCount - 1));
}

export function moveSelectedIndex(
  current: number,
  key: string,
  itemCount: number,
): number {
  if (itemCount <= 0) return 0;
  if (key === 'Home') return 0;
  if (key === 'End') return itemCount - 1;
  if (key === 'ArrowLeft' || key === 'ArrowDown') return Math.max(0, current - 1);
  if (key === 'ArrowRight' || key === 'ArrowUp') return Math.min(itemCount - 1, current + 1);
  return current;
}
