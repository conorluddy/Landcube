import type { DesignSettings } from './types/design';

const minimumContourContrastRatio = 3;

type RandomPalette = Pick<DesignSettings, 'background' | 'lineColor' | 'strokeOpacity'>;
type ColorChannels = [number, number, number];

/** Generates opposite hues with enough contrast after contour opacity is applied. */
export function createRandomPalette(random: () => number = Math.random): RandomPalette {
  const hue = random() * 360;
  const isDarkBackground = random() < 0.5;
  const darkLightness = 0.04 + random() * 0.1;
  const lightLightness = 0.84 + random() * 0.12;
  const background = convertHslToRgb(
    hue,
    0.25 + random() * 0.6,
    isDarkBackground ? darkLightness : lightLightness,
  );
  const contours = convertHslToRgb(
    (hue + 180) % 360,
    0.25 + random() * 0.6,
    isDarkBackground ? lightLightness : darkLightness,
  );
  let strokeOpacity = 0.8;

  // Contrast includes blending: raw colour contrast alone overstates faint contours.
  while (
    strokeOpacity < 1 &&
    calculateContrast(background, contours, strokeOpacity) < minimumContourContrastRatio
  ) {
    strokeOpacity = Math.min(1, Number((strokeOpacity + 0.01).toFixed(2)));
  }

  return {
    background: formatHexColor(background),
    lineColor: formatHexColor(contours),
    strokeOpacity,
  };
}

/** Converts HSL into the rounded sRGB channels used by colour inputs. */
function convertHslToRgb(hue: number, saturation: number, lightness: number): ColorChannels {
  const amplitude = saturation * Math.min(lightness, 1 - lightness);

  const channel = (offset: number) => {
    const position = (offset + hue / 30) % 12;

    return Math.round(
      255 * (lightness - amplitude * Math.max(-1, Math.min(position - 3, 9 - position, 1))),
    );
  };

  return [channel(0), channel(8), channel(4)];
}

/** Measures relative luminance contrast against the blended contour colour. */
function calculateContrast(
  background: ColorChannels,
  contours: ColorChannels,
  opacity: number,
): number {
  const blended = contours.map(
    (channel, index) => channel * opacity + background[index] * (1 - opacity),
  );
  const backgroundLuminance = calculateLuminance(background);
  const contourLuminance = calculateLuminance(blended);

  return (
    (Math.max(backgroundLuminance, contourLuminance) + 0.05) /
    (Math.min(backgroundLuminance, contourLuminance) + 0.05)
  );
}

/** Linearizes sRGB before applying relative luminance weights. */
function calculateLuminance(channels: number[]): number {
  const linear = channels.map((channel) => {
    const normalized = channel / 255;

    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

/** Serializes channels into canonical six-digit hex colours. */
function formatHexColor(channels: ColorChannels): string {
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
