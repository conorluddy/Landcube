import type { DesignSettings } from './types/design';

export type ContourStyle = 'ordinary' | 'solid' | 'dashed';
const indexContourElevationTolerance = 1e-6;

/** Anchors index styling to elevation identically in SVG and 3D, including negative levels. */
export function getContourStyle(
  elevation: number,
  interval: number,
  settings: Readonly<DesignSettings>,
): ContourStyle {
  if (settings.indexStyle === 'off') {
    return 'ordinary';
  }

  const multiple = elevation / (interval * settings.indexEvery);
  const indexLevel = Math.round(multiple);

  if (Math.abs(multiple - indexLevel) >= indexContourElevationTolerance) {
    return 'ordinary';
  }

  return settings.indexStyle === 'dashed' ||
    (settings.indexStyle === 'alternating' && Math.abs(indexLevel % 2) === 1)
    ? 'dashed'
    : 'solid';
}
