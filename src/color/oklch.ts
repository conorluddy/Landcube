/** Perceptual colour space for blends that keep lightness and hue steady between palettes. */
export interface OklchColor {
  lightness: number;
  chroma: number;
  /** Degrees in [0, 360); meaningless when chroma is near zero. */
  hue: number;
}

const achromaticChroma = 1e-4;

export function hexToOklch(hex: string): OklchColor {
  const [red, green, blue] = [1, 3, 5].map((offset) =>
    srgbToLinear(parseInt(hex.slice(offset, offset + 2), 16) / 255),
  );
  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const hue = (Math.atan2(b, a) * 180) / Math.PI;

  return {
    lightness: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    chroma: Math.hypot(a, b),
    hue: hue < 0 ? hue + 360 : hue,
  };
}

/** Out-of-gamut channels clamp, which is fine for blends between in-gamut endpoints. */
export function oklchToHex({ lightness, chroma, hue }: OklchColor): string {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const channels = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return `#${channels
    .map((channel) =>
      Math.round(Math.min(1, Math.max(0, linearToSrgb(channel))) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** Hue takes the shorter arc; a grey endpoint borrows the other's hue so it never swings. */
export function mixOklch(first: string, second: string, fraction: number): string {
  const from = hexToOklch(first);
  const to = hexToOklch(second);
  const fromHue = from.chroma < achromaticChroma ? to.hue : from.hue;
  const toHue = to.chroma < achromaticChroma ? fromHue : to.hue;
  const hueDelta = ((toHue - fromHue + 540) % 360) - 180;

  return oklchToHex({
    lightness: from.lightness + (to.lightness - from.lightness) * fraction,
    chroma: from.chroma + (to.chroma - from.chroma) * fraction,
    hue: (fromHue + hueDelta * fraction + 360) % 360,
  });
}

// === HELPERS ===

function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number): number {
  return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
}
