import type {
  imageExportFormats,
  summitMarkerSizes,
  indexContourStyles,
  pngResolutionScales,
} from '../constants/design';

export interface DesignSettings {
  seed: number;
  background: string;
  lineColor: string;
  strokeWidth: number;
  strokeOpacity: number;
  contourCount: number;
  featureScale: number;
  detail: number;
  indexStyle: (typeof indexContourStyles)[number];
  indexEvery: number;
  indexStrokeWidth: number;
  dashLength: number;
  dashGap: number;
  summitMarkerSize: (typeof summitMarkerSizes)[number];
  summitTrianglesEnabled: boolean;
  summitCrossesEnabled: boolean;
  cursorEnabled: boolean;
  cursorRadius: number;
  cursorHeight: number;
  cursorResponseMs: number;
  format: (typeof imageExportFormats)[number];
  width: number;
  height: number;
  pngScale: (typeof pngResolutionScales)[number];
  transparent: boolean;
  allowExtraLargeExports: boolean;
}

declare const validatedDesign: unique symbol;

export type ValidatedDesignSettings = Readonly<DesignSettings> & {
  readonly [validatedDesign]: true;
};

export interface LoadedDesign {
  settings: ValidatedDesignSettings;
  warnings: string[];
}

export type DesignChangeKind = 'appearance' | 'contours' | 'terrain' | 'cursor' | 'output';
