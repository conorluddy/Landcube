import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

// Run after build:cli; the seeded artwork and type are rendered together at share-card size.
const terrain = execFileSync(
  process.execPath,
  [
    'dist-cli/landcube.mjs',
    'generate',
    '--seed',
    '42',
    '--width',
    '1200',
    '--height',
    '630',
    '--background',
    '#161b1e',
    '--line-color',
    '#8eb5a2',
    '--stroke-opacity',
    '0.5',
    '--contour-count',
    '35',
    '--output',
    '-',
  ],
  { encoding: 'utf8' },
);
const artwork = terrain.replace(
  '</svg>',
  `
  <defs>
    <linearGradient id="shade"><stop stop-color="#161b1e" stop-opacity="0.98"/>
      <stop offset="1" stop-color="#161b1e" stop-opacity="0.15"/></linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#shade)"/>
  <g fill="#edf4ee" font-family="Geist">
    <text x="72" y="110" font-size="24" letter-spacing="5">LANDCU.BE</text>
    <text x="68" y="280" font-size="76" font-weight="700">Terrain into art.</text>
    <text x="72" y="350" font-size="28" fill="#b9cbbf">Real places. Seeded landscapes. Your style.</text>
    <text x="72" y="548" font-size="20" letter-spacing="3">TOPOGRAPHIC ART &amp; TERRAIN GENERATOR</text>
  </g>
</svg>`,
);

writeFileSync(
  'public/social-preview.png',
  new Resvg(artwork, {
    font: {
      fontFiles: ['scripts/assets/Geist-Regular.ttf', 'scripts/assets/Geist-Bold.ttf'],
      loadSystemFonts: false,
      defaultFontFamily: 'Geist',
    },
  })
    .render()
    .asPng(),
);
