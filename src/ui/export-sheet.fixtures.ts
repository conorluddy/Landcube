import type { ExportSheetModel } from './export-sheet';

const noop = (): void => undefined;

const previewImage =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='480' height='320'><rect width='480' height='320' fill='%23202326'/><path d='M0 220 C120 120 240 260 480 100' stroke='%23f2f2f0' fill='none'/></svg>";

/** An SVG export in the 2D view; tests and specimens override the parts they exercise. */
export function createExportSheetFixture(
  overrides: Partial<ExportSheetModel> = {},
): ExportSheetModel {
  return {
    target: 'Seed 123 · Generated',
    summary: [
      { label: 'Dimensions', value: '480 × 320', unit: 'px' },
      { label: 'Format', value: 'SVG' },
    ],
    format: {
      value: 'svg',
      options: [
        { value: 'svg', label: 'SVG' },
        { value: 'png', label: 'PNG' },
      ],
      onChange: noop,
    },
    fields: {
      size: {
        value: 'custom',
        options: [
          { value: 'custom', label: 'Custom' },
          {
            group: 'General',
            options: [{ value: '1920x1080', label: 'Landscape · 1920 × 1080' }],
          },
        ],
        onChange: noop,
      },
      width: { value: 480, min: 16, max: 4096, onChange: noop },
      height: { value: 320, min: 16, max: 4096, onChange: noop },
      sizeHint: '16–4096 px per side · anchored at the top left',
      isTransparent: { value: false, onChange: noop },
      isExtraLargeAllowed: { value: false, onChange: noop },
    },
    preview: {
      src: previewImage,
      alt: 'Settled landscape export preview',
      caption: '480 × 320 px · cursor hill excluded',
      onError: noop,
    },
    primaryAction: { label: 'Download SVG', onClick: noop },
    faults: [],
    ...overrides,
  };
}

export function createExportSheetPngFixture(): ExportSheetModel {
  const base = createExportSheetFixture();

  return {
    ...base,
    summary: [
      { label: 'Dimensions', value: '960 × 640', unit: 'px' },
      { label: 'Format', value: 'PNG' },
    ],
    format: { ...base.format, value: 'png' },
    fields: {
      ...base.fields,
      resolution: { value: '2', options: ['1', '2'], onChange: noop },
      isTransparent: { value: true, onChange: noop },
    },
    primaryAction: { label: 'Download PNG', onClick: noop },
  };
}

export function createExportSheetModelFixture(
  overrides: Partial<ExportSheetModel> = {},
): ExportSheetModel {
  return createExportSheetFixture({
    summary: [
      { label: 'Dimensions', value: '480 × 320', unit: 'px' },
      { label: 'Format', value: 'SVG' },
      { label: 'Frame parts', value: '2 · 1.7 MB' },
    ],
    still: {
      scale: {
        value: '2',
        options: [
          { value: '1', label: '1×' },
          { value: '2', label: '2×' },
          { value: '4', label: '4×' },
        ],
      },
      onScaleChange: noop,
      hint: 'The current 3D view, with its lens, focus and lighting, at 2× its on-screen size.',
      action: { label: 'Download 3D still', onClick: noop },
    },
    model: createExportModelSectionFixture(),
    ...overrides,
  });
}

export function createExportModelSectionFixture(): NonNullable<ExportSheetModel['model']> {
  return {
    formats: [
      { id: 'stl', label: 'STL', isSoon: false },
      { id: '3mf', label: '3MF', isSoon: true },
      { id: 'glb', label: 'GLB', isSoon: true },
    ],
    hints: [
      '150 × 100 mm · 14.20 mm overall height',
      'Terrain and solid base, in millimeters. Scene materials, water, decorations and engraved grooves are excluded.',
    ],
    action: { label: 'Download STL', onClick: noop },
    parts: [
      {
        id: 'frame',
        label: 'frame',
        detail: '1.5 MB',
        isSelected: true,
        onSelectedChange: noop,
        download: { label: 'Download frame STL', onClick: noop },
      },
      {
        id: 'back',
        label: 'back',
        detail: '212.0 KB',
        isSelected: true,
        onSelectedChange: noop,
        download: { label: 'Download back STL', onClick: noop },
      },
    ],
    partHints: ['frame: 170 × 120 × 14 mm · print flat', 'back: 170 × 120 × 3 mm · print flat'],
    partsAction: { label: 'Download selected parts', onClick: noop },
  };
}
