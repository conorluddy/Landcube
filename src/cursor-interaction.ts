import type { CursorInfluence } from './types/cursor';
import type { DesignSettings } from './types/design';
import type { HeightField } from './types/terrain';

/** Add a compact, smooth hill without changing the cached seeded landscape. */
export function applyCursorElevation(
  field: HeightField,
  cursor: CursorInfluence,
  settings: Pick<DesignSettings, 'cursorRadius' | 'cursorHeight'>,
): HeightField {
  if (cursor.strength <= 0) {
    return field;
  }
  const values = field.values.slice();
  const { columns, rows, originX, originY, spacing } = field;
  const radius = settings.cursorRadius;
  const minimumColumn = Math.max(0, Math.ceil((cursor.x - radius - originX) / spacing));
  const maximumColumn = Math.min(columns - 1, Math.floor((cursor.x + radius - originX) / spacing));
  const minimumRow = Math.max(0, Math.ceil((cursor.y - radius - originY) / spacing));
  const maximumRow = Math.min(rows - 1, Math.floor((cursor.y + radius - originY) / spacing));
  for (let row = minimumRow; row <= maximumRow; row++) {
    for (let column = minimumColumn; column <= maximumColumn; column++) {
      const distanceX = originX + column * spacing - cursor.x;
      const distanceY = originY + row * spacing - cursor.y;
      const distanceSquared = (distanceX * distanceX + distanceY * distanceY) / (radius * radius);
      if (distanceSquared >= 1) {
        continue;
      }
      // Value, slope, and curvature all approach zero at the influence boundary.
      values[row * columns + column] +=
        settings.cursorHeight * cursor.strength * (1 - distanceSquared) ** 3;
    }
  }
  return { ...field, values };
}
