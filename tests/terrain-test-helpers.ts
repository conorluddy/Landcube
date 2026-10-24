import type { ContourPoint } from '../src/types/contours';
import type { HeightField } from '../src/types/terrain';

/** Recognizes valid endpoints of open contours at sampled edges. */
export function isPointOnHeightFieldBoundary(
  point: ContourPoint | undefined,
  field: HeightField,
): boolean {
  if (point === undefined) {
    return false;
  }
  return (
    point.x === field.originX ||
    point.y === field.originY ||
    point.x === field.originX + (field.columns - 1) * field.spacing ||
    point.y === field.originY + (field.rows - 1) * field.spacing
  );
}
