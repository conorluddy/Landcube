import type { LayoutPart } from '../registry.types';

export const layoutParts: LayoutPart[] = [
  {
    kind: 'layout',
    id: 'desktop-shell',
    section: 'LYOT',
    group: 'Desktop',
    name: 'Desktop shell',
    usedIn: '1',
    source: 'src/studio/studio.css',
    summary: 'Map full-bleed. Glass floats on it at a 12px inset. Nothing docks.',
    cells: [{ k: 'desktopShell', label: 'Desktop', note: '1440 × 810' }],
    spec: [
      { property: 'Top bar', value: '40 tall at 12 inset', token: '--lc-h-bar' },
      { property: 'Inspector', value: 'top 60 · right 12 · bottom 60 · 396 wide' },
      { property: 'Readout', value: 'left 12 · bottom 60 · 300 wide' },
      { property: 'Footer', value: '36 tall at 12 inset' },
    ],
  },
  {
    kind: 'layout',
    id: 'mobile-shell',
    section: 'LYOT',
    group: 'Mobile',
    name: 'Mobile studio',
    usedIn: '3E–3J',
    source: 'src/studio/studio-phone.css',
    summary:
      'The map stays full-bleed under a sheet with four snaps. Map controls step aside when the sheet is full. Pick a snap, or drag the handle.',
    cells: [{ k: 'mobileShell', label: 'Sheet snaps', note: 'Closed · peek · half · full' }],
    spec: [
      { property: 'Closed', value: '44 · grip only, tap to reopen' },
      { property: 'Peek', value: '190 · readouts + export' },
      { property: 'Half', value: '55% · tabs + controls' },
      { property: 'Full', value: '64 from top · map controls hide' },
      { property: 'Motion', token: '--lc-dur-sheet' },
    ],
  },
];
