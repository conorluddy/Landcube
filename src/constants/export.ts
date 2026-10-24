export const imageMimeTypes = { svg: 'image/svg+xml', png: 'image/png' } as const;
export const maximumPreviewDimensionPixels = 1024;
export const downloadUrlReleaseDelayMs = 1000;
/** Paper dimensions are rounded pixels at 150 DPI, within the standard export limit. */
export const outputSizePresetGroups = [
  {
    label: 'General',
    presets: [
      { value: '1920x1080', label: 'Landscape · 1920 × 1080' },
      { value: '1080x1080', label: 'Square · 1080 × 1080' },
      { value: '1080x1920', label: 'Portrait · 1080 × 1920' },
    ],
  },
  {
    label: 'Paper · 150 DPI',
    presets: [
      { value: '874x1240', label: 'A5 · 874 × 1240' },
      { value: '1240x1754', label: 'A4 · 1240 × 1754' },
      { value: '1754x2480', label: 'A3 · 1754 × 2480' },
      { value: '2480x3508', label: 'A2 · 2480 × 3508' },
      { value: '1275x1650', label: 'US Letter · 1275 × 1650' },
      { value: '1275x2100', label: 'US Legal · 1275 × 2100' },
      { value: '1650x2550', label: 'US Tabloid · 1650 × 2550' },
    ],
  },
  {
    label: 'Phones',
    presets: [
      { value: '1080x2340', label: 'Phone · 1080 × 2340' },
      { value: '1080x2400', label: 'Phone · 1080 × 2400' },
      { value: '1170x2532', label: 'Phone · 1170 × 2532' },
      { value: '1179x2556', label: 'Phone · 1179 × 2556' },
      { value: '1290x2796', label: 'Phone · 1290 × 2796' },
      { value: '1440x3120', label: 'Phone · 1440 × 3120' },
    ],
  },
  {
    label: 'Desktop monitors',
    presets: [
      { value: '1366x768', label: 'HD · 1366 × 768' },
      { value: '1920x1200', label: 'WUXGA · 1920 × 1200' },
      { value: '2560x1440', label: 'QHD · 2560 × 1440' },
      { value: '2560x1600', label: '16:10 · 2560 × 1600' },
      { value: '3440x1440', label: 'Ultrawide · 3440 × 1440' },
      { value: '3840x2160', label: '4K UHD · 3840 × 2160' },
    ],
  },
] as const;
