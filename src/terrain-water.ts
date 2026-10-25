/** Darkens the terrain's sRGB color slightly for the default graphic water fill. */
export function getTerrainWaterColor(surfaceColor: string): string {
  const channels = [1, 3, 5].map((offset) =>
    Math.round(parseInt(surfaceColor.slice(offset, offset + 2), 16) * 0.88)
      .toString(16)
      .padStart(2, '0'),
  );

  return `#${channels.join('')}`;
}
