import type { FoundationCell, FoundationPart, SpecRow, TypeScaleRow } from '../registry.types';

const swatch = (label: string, token: string): FoundationCell => ({ k: 'swatch', label, token });
const row = (property: string, value?: string, token?: string): SpecRow => ({
  property,
  value,
  token,
});
const mono = (
  role: string,
  sizeToken: string,
  weight: 400 | 500,
  tracking: string,
  sample: string,
): TypeScaleRow => ({ role, sizeToken, family: 'mono', weight, tracking, sample });
const sans = (
  role: string,
  sizeToken: string,
  weight: 300 | 400,
  tracking: string,
  sample: string,
): TypeScaleRow => ({ role, sizeToken, family: 'sans', weight, tracking, sample });

export const foundationParts: FoundationPart[] = [
  // === COLOUR ===
  {
    kind: 'foundation',
    id: 'ink',
    section: 'FNDN',
    group: 'Colour',
    name: 'Ink ramp',
    usedIn: 'ALL',
    source: '--lc-ink-*',
    summary:
      'Ten greys, bone, white and the map ground. These are the only colours the interface owns. Everything else is data.',
    cells: [
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((step) => swatch(`Ink-${step}`, `--lc-ink-${step}`)),
      swatch('Bone', '--lc-bone'),
      swatch('White', '--lc-white'),
      swatch('Canvas', '--lc-canvas'),
    ],
    spec: [
      row('Ground', 'ink-0 device / splash · ink-1 glass base', '--lc-ink-0, --lc-ink-1'),
      row('Marks on canvas', 'ink-3 for HUD brackets, rulers, readouts', '--lc-ink-3'),
      row('Primary', 'Bone. Text, primary fill, focus, selection', '--lc-bone'),
      row('Hover on bone', 'White, and only there', '--lc-white'),
      row('Rule', 'Colour appears only as data and the signal accent'),
    ],
  },
  {
    kind: 'foundation',
    id: 'text',
    section: 'FNDN',
    group: 'Colour',
    name: 'Text roles',
    usedIn: 'ALL',
    source: '--lc-text-*',
    summary: 'Eight semantic roles mapped onto the ramp. Components ask for a role, never a grey.',
    cells: [
      ...['primary', 'strong', 'body', 'secondary', 'tertiary', 'quiet', 'disabled'].map(
        (role): FoundationCell => ({ k: 'textRole', label: role, token: `--lc-text-${role}` }),
      ),
      { k: 'textRole', label: 'On bone', token: '--lc-text-on-bone', isOnBone: true },
    ],
    spec: [
      row('Values, titles', 'primary', '--lc-text-primary'),
      row('Control labels', 'body', '--lc-text-body'),
      row('Hints, meta', 'tertiary', '--lc-text-tertiary'),
      row('Units, codes', 'quiet', '--lc-text-quiet'),
      row('Text on bone fill', 'on-bone', '--lc-text-on-bone'),
    ],
  },
  {
    kind: 'foundation',
    id: 'lines',
    section: 'FNDN',
    group: 'Colour',
    name: 'Lines & fills',
    usedIn: 'ALL',
    source: '--lc-line-* · --lc-fill-*',
    summary:
      'Every border is 1px white at a set opacity. Selection shows as a bone border or a bone fill, never a colour.',
    cells: [
      { k: 'line', label: 'Line subtle', borderToken: '--lc-line-subtle' },
      { k: 'line', label: 'Line', borderToken: '--lc-line' },
      { k: 'line', label: 'Line strong', borderToken: '--lc-line-strong' },
      { k: 'line', label: 'Line hover', borderToken: '--lc-line-hover' },
      { k: 'line', label: 'Line focus', borderToken: '--lc-line-focus' },
      { k: 'line', label: 'Fill field', borderToken: '--lc-line', fillToken: '--lc-fill-field' },
      { k: 'line', label: 'Fill hover', fillToken: '--lc-fill-hover' },
      { k: 'line', label: 'Fill active', fillToken: '--lc-fill-active' },
      {
        k: 'line',
        label: 'Fill selected',
        borderToken: '--lc-line-focus',
        fillToken: '--lc-fill-selected',
      },
      { k: 'line', label: 'Fill off', fillToken: '--lc-fill-off' },
    ],
    spec: [
      row('Weight', 'Always 1px'),
      row('Panel edge', undefined, '--lc-line-panel'),
      row('Focus', 'Bone border, no glow, no ring', '--lc-line-focus'),
    ],
  },
  {
    kind: 'foundation',
    id: 'signal',
    section: 'FNDN',
    group: 'Colour',
    name: 'Signal accent',
    usedIn: '1 · 2D · 3K',
    source: '--lc-signal',
    summary:
      'One optional accent, used on status marks only. Pick it under Account › Signal accent and every mark in the app follows, including the footer’s.',
    cells: [
      { k: 'signal', label: 'Bone', note: 'Default', accent: 'bone' },
      { k: 'signal', label: 'Signal amber', note: 'Opt-in', accent: 'amber' },
      { k: 'signal', label: 'Phosphor', note: 'Opt-in', accent: 'phosphor' },
    ],
    spec: [
      row('Use', 'OK / live squares, footer status, target lock', '--lc-signal'),
      row('Never', 'Text, borders, fills, buttons'),
    ],
  },

  // === SURFACE ===
  {
    kind: 'foundation',
    id: 'glass',
    section: 'FNDN',
    group: 'Surface',
    name: 'Glass',
    usedIn: 'ALL PANELS',
    source: '--lc-glass-*',
    summary:
      'Glass is the only surface. Four densities of ink-1 over the map, all with the same blur and saturation lift.',
    cells: [
      {
        k: 'glass',
        label: 'Bar',
        note: 'Top bar · footer',
        token: '--lc-glass-bar',
        blurToken: '--lc-blur-lg',
      },
      {
        k: 'glass',
        label: 'Panel',
        note: 'Inspector',
        token: '--lc-glass-panel',
        blurToken: '--lc-blur-lg',
      },
      {
        k: 'glass',
        label: 'Sheet',
        note: 'Mobile',
        token: '--lc-glass-sheet',
        blurToken: '--lc-blur-lg',
      },
      {
        k: 'glass',
        label: 'Tip',
        note: 'Map labels',
        token: '--lc-glass-tip',
        blurToken: '--lc-blur-sm',
      },
    ],
    spec: [
      row('Filter', undefined, '--lc-glass-filter'),
      row('Small tips', undefined, '--lc-blur-sm'),
      row('Edge', undefined, '--lc-line-panel'),
      row('Radius', undefined, '--lc-r-panel'),
    ],
  },
  {
    kind: 'foundation',
    id: 'shadow',
    section: 'FNDN',
    group: 'Surface',
    name: 'Elevation',
    usedIn: 'ALL PANELS',
    source: '--lc-shadow-*',
    summary:
      'Three long, soft drop shadows with a negative spread, so panels lift off the map without a visible halo.',
    cells: [
      { k: 'shadow', label: 'Bar', token: '--lc-shadow-bar' },
      { k: 'shadow', label: 'Card', token: '--lc-shadow-card' },
      { k: 'shadow', label: 'Panel', token: '--lc-shadow-panel' },
    ],
    spec: [
      row('Bar', undefined, '--lc-shadow-bar'),
      row('Card', undefined, '--lc-shadow-card'),
      row('Panel', undefined, '--lc-shadow-panel'),
      row('Thumb knock-out', undefined, '--lc-ring-thumb'),
    ],
  },
  {
    kind: 'foundation',
    id: 'patterns',
    section: 'FNDN',
    group: 'Surface',
    name: 'Patterns',
    usedIn: '2D · 2F · 3P',
    source: '--lc-hatch · --lc-ticks',
    summary:
      'Hatch marks missing data, ticks mark a measurable track, scrim dims the map behind a modal and the crop surround dims everything outside the print.',
    cells: [
      { k: 'pattern', label: 'Hatch', note: 'No data', token: '--lc-hatch' },
      { k: 'pattern', label: 'Ticks', note: 'Every 10%', token: '--lc-ticks', isOnGlass: true },
      { k: 'pattern', label: 'Scrim', note: 'Modal', token: '--lc-scrim' },
      { k: 'pattern', label: 'Crop surround', note: 'Outside print', token: '--lc-crop-surround' },
    ],
    spec: [
      row('Hatch', '−45°, 2px ink over 7px canvas', '--lc-hatch'),
      row('Ticks', '1px at white 0.22, one per 10%', '--lc-ticks'),
      row('Scrim', undefined, '--lc-scrim'),
      row('Crop surround', undefined, '--lc-crop-surround'),
    ],
  },

  // === TYPE ===
  {
    kind: 'foundation',
    id: 'type-desktop',
    section: 'FNDN',
    group: 'Type',
    name: 'Type · desktop',
    usedIn: '1 · 2A–2I',
    source: '--lc-fs-*',
    summary:
      'Geist for words a person reads. Geist Mono for anything a machine would print. Sizes are small and deliberate. Keep them.',
    cells: [
      {
        k: 'typeScale',
        label: 'Desktop scale',
        note: '9 steps',
        rows: [
          mono('Micro', '--lc-fs-micro', 400, '0.1em', '02 / 07   CONT.02   M · OPTIONAL'),
          mono('Label', '--lc-fs-label', 400, 'var(--lc-track-head)', 'CONTOUR APPEARANCE'),
          mono('UI', '--lc-fs-ui', 500, 'var(--lc-track-label)', 'EXPORT ↗   COPY STYLE LINK'),
          mono('Value S', '--lc-fs-value-s', 400, '0', '0.85 px'),
          sans(
            'Hint',
            '--lc-fs-hint',
            400,
            '0',
            'Elevation filters reduce coastal source artifacts.',
          ),
          mono('Value', '--lc-fs-value', 400, '0', '55.0343°N   8.1130°W'),
          sans('Body', '--lc-fs-body', 400, '0', 'Show land surface'),
          sans('Lead', '--lc-fs-lead', 400, '-0.01em', 'Contours'),
          sans('Title', '--lc-fs-title', 300, '0.02em', 'ERRIGAL'),
        ],
      },
    ],
    spec: [
      row('Sans', 'Geist 300 / 400 / 500', '--lc-font-sans'),
      row('Mono', 'Geist Mono 400 / 500', '--lc-font-mono'),
      row('Numbers', 'tabular-nums on every live value'),
      row('Rule', 'Mono caps are always tracked. Geist is never tracked.'),
    ],
  },
  {
    kind: 'foundation',
    id: 'type-mobile',
    section: 'FNDN',
    group: 'Type',
    name: 'Type · mobile',
    usedIn: '3A–3U',
    source: '--lc-fs-m-*',
    summary:
      'The mobile scale steps up for thumbs and arm’s-length reading. Inputs sit at 16px so iOS never zooms.',
    cells: [
      {
        k: 'typeScale',
        label: 'Mobile scale',
        note: '9 steps',
        rows: [
          mono('Micro', '--lc-fs-m-micro', 400, 'var(--lc-track-ui)', 'EU-DEM · 25 M'),
          mono('Label', '--lc-fs-m-label', 400, 'var(--lc-track-label)', 'REAL LOCATION'),
          mono('UI', '--lc-fs-m-ui', 500, 'var(--lc-track-label)', 'DOWNLOAD ↓'),
          mono('Value', '--lc-fs-m-value', 400, '0', '5.09 × 5.09 KM'),
          sans('Body', '--lc-fs-m-body', 400, '0', 'Source tiles cover 56% of the area.'),
          sans('Input', '--lc-fs-m-input', 400, '0', 'Errigal, Donegal'),
          sans('Title', '--lc-fs-m-title', 400, '0', 'Contours'),
          sans('H2', '--lc-fs-m-h2', 400, '-0.01em', 'Ready to print'),
          sans('H1', '--lc-fs-m-h1', 300, '-0.01em', 'Library'),
        ],
      },
    ],
    spec: [
      row('Minimum', '9px mono, 14px body'),
      row('Inputs', undefined, '--lc-fs-m-input'),
      row('Page title', 'Weight 300', '--lc-fs-m-h1'),
    ],
  },
  {
    kind: 'foundation',
    id: 'tracking',
    section: 'FNDN',
    group: 'Type',
    name: 'Tracking',
    usedIn: 'ALL',
    source: '--lc-track-*',
    summary:
      'Five letter-spacing steps for mono caps. The wider the tracking, the more structural the label.',
    cells: [
      {
        k: 'typeScale',
        label: 'Mono caps',
        note: '5 steps',
        rows: [
          mono('Coord', '--lc-fs-value', 400, 'var(--lc-track-coord)', '55.0343°N  8.1130°W'),
          mono('UI', '--lc-fs-ui', 400, 'var(--lc-track-ui)', 'COPY STYLE LINK'),
          mono('Label', '--lc-fs-label', 400, 'var(--lc-track-label)', 'TARGET LOCK'),
          mono('Head', '--lc-fs-label', 400, 'var(--lc-track-head)', 'INDEX CONTOURS'),
          mono('Brand', '--lc-fs-value', 500, 'var(--lc-track-brand)', 'LANDCU.BE'),
        ],
      },
    ],
    spec: [
      row('Applies to', 'Geist Mono, uppercase only'),
      row('Never', 'Geist sans, sentence case'),
    ],
  },

  // === MEASURE ===
  {
    kind: 'foundation',
    id: 'radii',
    section: 'FNDN',
    group: 'Measure',
    name: 'Radii',
    usedIn: 'ALL',
    source: '--lc-r-*',
    summary:
      'Corners stay sharp. No pills anywhere. The one soft curve is the top edge of the mobile sheet.',
    cells: [
      { k: 'radius', label: 'Inner', token: '--lc-r-inner' },
      { k: 'radius', label: 'Control', token: '--lc-r-control' },
      { k: 'radius', label: 'Panel', token: '--lc-r-panel' },
      { k: 'radius', label: 'Sheet top', token: '--lc-r-sheet', isTopOnly: true },
    ],
    spec: [
      row('Inner', 'Switch cells, slider thumb, tags', '--lc-r-inner'),
      row('Control', 'Buttons, fields, selects, tiles', '--lc-r-control'),
      row('Panel', 'Every glass surface', '--lc-r-panel'),
      row('Sheet', 'Top corners of mobile sheets only', '--lc-r-sheet'),
    ],
  },
  {
    kind: 'foundation',
    id: 'spacing',
    section: 'FNDN',
    group: 'Measure',
    name: 'Spacing',
    usedIn: 'ALL',
    source: '--lc-s-*',
    summary:
      'A ten-step scale. 12px is the layout unit: the inset of every panel from the viewport and the snap grid for detached panels.',
    cells: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((step): FoundationCell => ({
      k: 'space',
      label: `S-${step}`,
      token: `--lc-s-${step}`,
    })),
    spec: [
      row('Layout unit', 'Panel inset, snap grid', '--lc-s-6'),
      row('Row gap', '12px in control groups'),
      row('Group gap', 'Between groups', '--lc-s-8'),
      row('Bar gap', 'Between top-bar pills', '--lc-s-3'),
    ],
  },
  {
    kind: 'foundation',
    id: 'heights',
    section: 'FNDN',
    group: 'Measure',
    name: 'Control heights',
    usedIn: 'ALL',
    source: '--lc-h-*',
    summary: 'Six fixed heights. Desktop controls are compact; mobile never drops below 44.',
    cells: [
      { k: 'height', label: 'Switch row', token: '--lc-h-xs' },
      { k: 'height', label: 'Select · secondary', token: '--lc-h-s' },
      { k: 'height', label: 'Field · primary', token: '--lc-h-m' },
      { k: 'height', label: 'Top bar', token: '--lc-h-bar' },
      { k: 'height', label: 'Mobile min', token: '--lc-h-l' },
      { k: 'height', label: 'Mobile CTA', token: '--lc-h-xl' },
    ],
    spec: [
      row('Desktop', 'xs · s · m · bar', '--lc-h-xs … --lc-h-bar'),
      row('Mobile', '44 minimum · 52 primary CTA', '--lc-h-l, --lc-h-xl'),
    ],
  },

  // === MOTION ===
  {
    kind: 'foundation',
    id: 'motion',
    section: 'FNDN',
    group: 'Motion',
    name: 'Motion',
    usedIn: 'ALL',
    source: '--lc-dur-* · provisional',
    summary:
      'One ease, three durations, no bounces. Click a track to run it. These values are provisional.',
    cells: [
      { k: 'motion', label: 'Fast · hover', duration: 'var(--lc-dur-fast)' },
      { k: 'motion', label: 'State', duration: 'var(--lc-dur)' },
      { k: 'motion', label: 'Sheet', duration: 'var(--lc-dur-sheet)' },
      { k: 'motion', label: 'Mode flip', note: '260 + 300 ms', duration: '560ms' },
    ],
    spec: [
      row('Ease', undefined, '--lc-ease'),
      row('Hover', undefined, '--lc-dur-fast'),
      row('State', undefined, '--lc-dur'),
      row('Sheet', undefined, '--lc-dur-sheet'),
    ],
  },
];
