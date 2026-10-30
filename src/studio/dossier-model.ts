import { roadAttribution } from '../constants/roads';
import type { StudioState } from './controller';
import { describeTarget, type ReadoutCardModel } from './hud-readouts';
import type { ElevationRangeMeters } from './hud-store';

/**
 * Pure view model for the printable model dossier (C-22): everything the sheet prints, already
 * formatted. The clock, preview and style link are inputs so the model stays deterministic.
 */
export interface DossierModel {
  title: string;
  subtitle: string;
  /** ISO 8601 timestamp of when the sheet was generated. */
  generatedAt: string;
  readouts: ReadoutCardModel['cells'];
  styleLink: string;
  /** The terrain credit, verbatim; null for procedural landscapes. */
  attribution: string | null;
  /** Present only while the road overlay is on. */
  roadsCredit: string | null;
  preview?: { src: string; alt: string };
  palette: readonly { label: string; color: string }[];
}

export interface DossierInput {
  styleLink: string;
  generatedAt: Date;
  /** Data URL of the settled 2D export preview, once rendered. */
  previewSrc?: string;
  /** Elevation range of a generated landscape, measured by the HUD. */
  generatedRelief?: ElevationRangeMeters;
}

// === PUBLIC API ===

export function buildDossierModel(state: StudioState, input: DossierInput): DossierModel {
  const target = describeTarget(state, input.generatedRelief);
  const terrain = state.source.terrain;

  return {
    title: terrain ? target.title : `Seed ${String(state.design.seed)}`,
    subtitle: terrain ? `Real terrain · ${target.place}` : 'Procedural landscape',
    generatedAt: input.generatedAt.toISOString(),
    readouts: [...target.cells.filter(isPrintedCell), ...describeModelCells(state)],
    styleLink: input.styleLink,
    attribution: terrain?.attribution ?? null,
    roadsCredit: state.scene.roads.enabled ? roadAttribution : null,
    preview:
      input.previewSrc === undefined
        ? undefined
        : { src: input.previewSrc, alt: `Preview of ${target.place}` },
    palette: [
      { label: 'Background', color: state.design.background },
      { label: 'Lines', color: state.design.lineColor },
    ],
  };
}

// === HELPERS ===

/** Camera angles describe the live view, not the model. */
function isPrintedCell({ label }: ReadoutCardModel['cells'][number]): boolean {
  return label !== 'Azimuth' && label !== 'Elevation';
}

function describeModelCells(state: StudioState): ReadoutCardModel['cells'] {
  if (state.workspace.view !== '3d') {
    return [];
  }

  const { widthMm, lengthMm, cropShape } = state.model.dimensions;
  const { height } = state.metrics;
  const frame = state.frame.settings.preset;

  return [
    cropShape === 'circle'
      ? { label: 'Model', value: `Ø ${String(widthMm)}`, unit: 'mm' }
      : { label: 'Model', value: `${String(widthMm)} × ${String(lengthMm)}`, unit: 'mm' },
    ...(height === undefined ? [] : [{ label: 'Height', value: height.toFixed(2), unit: 'mm' }]),
    ...(frame === 'none' ? [] : [{ label: 'Frame', value: frame }]),
  ];
}
