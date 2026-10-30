import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Remove this test when `design/` is retired: until then the handoff file stays the source of truth.
void test('src/ui/tokens.css is a byte-for-byte copy of design/DesignSystem/tokens.css', () => {
  const handoffTokens = readFileSync(
    new URL('../../design/DesignSystem/tokens.css', import.meta.url),
  );
  const shippedTokens = readFileSync(new URL('./tokens.css', import.meta.url));

  assert.ok(
    handoffTokens.equals(shippedTokens),
    'Re-copy design/DesignSystem/tokens.css to src/ui/tokens.css (cp design/DesignSystem/tokens.css src/ui/tokens.css).',
  );
});

// === LIGHT THEME ===

type Rgba = [number, number, number, number];
type TokenMap = Map<string, string>;

/** Values that stay the same in light because they are canvas/HUD marks or non-glass patterns. */
const themeInvariantColourTokens = new Set([
  '--lc-ink-0',
  '--lc-ink-2',
  '--lc-ink-3',
  '--lc-ink-4',
  '--lc-ink-5',
  '--lc-ink-6',
  '--lc-ink-7',
  '--lc-ink-8',
  '--lc-ink-9',
  '--lc-canvas',
  '--lc-hatch', // sits on the canvas, not on glass
  '--lc-signal', // follows bone
  '--lc-line-focus', // follows bone
]);

const tokensCss = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const themeLightCss = readFileSync(new URL('./theme-light.css', import.meta.url), 'utf8');
const darkTokens = readTokenBlock(tokensCss, ':root');
const lightTokens: TokenMap = new Map([
  ...readTokenBlock(tokensCss, "[data-theme='light']"),
  ...readTokenBlock(themeLightCss, ":root[data-theme='light']"),
]);

void test('light theme overrides every colour token that is not explicitly theme-invariant', () => {
  const colourPattern = /#[0-9a-f]{6}|rgba?\(|var\(--lc-(ink|bone)/i;
  const missing = [...darkTokens]
    .filter(([, value]) => colourPattern.test(value))
    .map(([name]) => name)
    .filter((name) => !lightTokens.has(name) && !themeInvariantColourTokens.has(name));

  assert.deepEqual(missing, [], 'Override these in theme-light.css, or list them as invariant.');
});

void test('light text tiers hold contrast on glass over the darkest and lightest canvases', () => {
  const darkestCanvas: Rgba = [0x20, 0x23, 0x26, 1]; // default design background
  const lightestCanvas: Rgba = [255, 255, 255, 1];
  const glass = parseColour(lightTokens.get('--lc-glass-panel') ?? '', lightTokens);
  const minimumRatios = {
    '--lc-text-primary': 4.5,
    '--lc-text-strong': 4.5,
    '--lc-text-body': 4.5,
    '--lc-text-secondary': 4.5,
    '--lc-text-tertiary': 3,
    '--lc-text-quiet': 3,
  };

  for (const canvas of [darkestCanvas, lightestCanvas]) {
    const surface = compositeOver(glass, canvas);

    for (const [name, minimum] of Object.entries(minimumRatios)) {
      const ratio = contrastRatio(parseColour(lightTokens.get(name) ?? '', lightTokens), surface);

      assert.ok(
        ratio >= minimum,
        `${name} is ${ratio.toFixed(2)}:1 on ${canvas.join(',')}, needs ${String(minimum)}:1`,
      );
    }
  }
});

// === HELPERS ===

function readTokenBlock(css: string, selector: string): TokenMap {
  const tokens: TokenMap = new Map();
  const blockStart = css.indexOf(`\n${selector} {`);
  const body = css.slice(blockStart, css.indexOf('\n}', blockStart));

  for (const [, name, value] of body.matchAll(/^\s+(--lc-[a-z0-9-]+):\s*([^;]+);/gm)) {
    tokens.set(name, value.trim());
  }

  return tokens;
}

function parseColour(value: string, tokens: TokenMap): Rgba {
  const reference = /^var\((--lc-[a-z0-9-]+)\)$/.exec(value);

  if (reference) {
    return parseColour(tokens.get(reference[1]) ?? darkTokens.get(reference[1]) ?? '', tokens);
  }

  const hex = /^#([0-9a-f]{6})$/i.exec(value);

  if (hex) {
    const [red, green, blue] = [0, 2, 4].map((offset) =>
      parseInt(hex[1].slice(offset, offset + 2), 16),
    );

    return [red, green, blue, 1];
  }

  const rgba = /^rgba?\(([^)]+)\)$/.exec(value);

  if (rgba) {
    const [red, green, blue, alpha = 1] = rgba[1].split(',').map(Number);

    return [red, green, blue, alpha];
  }

  throw new Error(`Cannot parse colour "${value}"`);
}

function compositeOver(foreground: Rgba, background: Rgba): Rgba {
  const mix = (index: number) =>
    foreground[index] * foreground[3] + background[index] * (1 - foreground[3]);

  return [mix(0), mix(1), mix(2), 1];
}

function contrastRatio(first: Rgba, second: Rgba): number {
  const luminance = ([red, green, blue]: Rgba) => {
    const [r, g, b] = [red, green, blue].map((channel) => {
      const unit = channel / 255;

      return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);

  return (lighter + 0.05) / (darker + 0.05);
}
