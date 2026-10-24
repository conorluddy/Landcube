export const imageMimeTypes = { svg: 'image/svg+xml', png: 'image/png' } as const;
export const downloadUrlReleaseDelayMs = 1000;
export const outputSizePresets = [
  { value: 'custom', label: 'Custom' },
  { value: 'viewport', label: 'Use viewport' },
  { value: '1920x1080', label: 'Landscape · 1920 × 1080' },
  { value: '1080x1080', label: 'Square · 1080 × 1080' },
  { value: '1080x1920', label: 'Portrait · 1080 × 1920' },
] as const;
