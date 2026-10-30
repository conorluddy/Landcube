import type { ReactNode } from 'react';
import {
  maximumExtraLargeOutputDimensionPixels,
  maximumOutputDimensionPixels,
  minimumOutputDimensionPixels,
} from '../constants/design';
import { outputSizePresetGroups } from '../constants/export';
import { terrainStillScales, type TerrainStillScale } from '../export/still-export';
import { getRasterDimensions } from '../export/image-export';
import type { ExportSheetModel } from '../ui/export-sheet';
import { formatByteSize } from '../ui/job-list';
import type { FramePart, FramePartId } from '../types/frame';
import { estimateBinaryStlBytes as estimateStlBytes, type StudioState } from './controller';

/** Session-only panel state the model needs; `StudioState` owns everything else. */
export interface ExportPanelUiState {
  previewUrl?: string;
  error: string;
  isBusy: boolean;
  sizeChoice: string;
  stillScale: TerrainStillScale;
  isStillBusy: boolean;
  selectedPartIds: ReadonlySet<FramePartId>;
  success?: ReactNode;
}

export interface ExportPanelHandlers {
  changeFormat: (value: string) => void;
  changeSizeChoice: (value: string) => void;
  changeWidth: (value: number | undefined) => unknown;
  changeHeight: (value: number | undefined) => unknown;
  changeResolution: (value: string) => void;
  setTransparent: (value: boolean) => void;
  setExtraLargeAllowed: (value: boolean) => void;
  failPreview: () => void;
  download: () => void;
  changeStillScale: (value: string) => void;
  downloadStill: () => void;
  downloadStl: () => void;
  downloadPart: (partId: FramePartId) => void;
  setPartSelected: (partId: FramePartId, isSelected: boolean) => void;
  downloadSelectedParts: () => void;
  downloadAttribution: () => void;
  openDossier: () => void;
}

export interface ExportSheetInput {
  state: StudioState;
  ui: ExportPanelUiState;
  handlers: ExportPanelHandlers;
}

export const previewAlt = 'Settled landscape export preview';

// === PUBLIC API ===

/** Maps studio state and panel state to what the ExportSheet draws. Pure; no DOM or React. */
export function buildExportSheetModel({ state, ui, handlers }: ExportSheetInput): ExportSheetModel {
  const settings = state.design;
  const is3d = state.workspace.view === '3d';
  const frameParts = getFrameParts(state);
  const isPng = settings.format === 'png';
  const scale = isPng ? settings.pngScale : 1;
  const raster = getRasterDimensions(settings);
  const limit = settings.allowExtraLargeExports
    ? maximumExtraLargeOutputDimensionPixels
    : maximumOutputDimensionPixels;
  const outputSize = `${String(settings.width * scale)} × ${String(settings.height * scale)}`;
  const areJobsActive = state.exportJobs.some(
    ({ status }) => status === 'queued' || status === 'meshing',
  );
  const selectedParts = frameParts.filter(({ id }) => ui.selectedPartIds.has(id));
  const terrain = state.source.terrain;

  return {
    target: describeTarget(state),
    summary: [
      { label: 'Dimensions', value: outputSize, unit: 'px' },
      { label: 'Format', value: settings.format.toUpperCase() },
      ...(frameParts.length > 0
        ? [
            {
              label: 'Frame parts',
              value: `${String(frameParts.length)} · ${formatByteSize(sumStlBytes(frameParts))}`,
            },
          ]
        : []),
    ],
    format: {
      value: settings.format,
      options: [
        { value: 'svg', label: 'SVG' },
        { value: 'png', label: 'PNG' },
      ],
      onChange: handlers.changeFormat,
    },
    fields: {
      size: {
        value: ui.sizeChoice,
        options: [
          { value: 'custom', label: 'Custom' },
          {
            group: 'This device',
            options: [
              { value: 'viewport', label: 'Current viewport' },
              { value: 'screen', label: 'Device screen' },
            ],
          },
          ...outputSizePresetGroups.map((group) => ({
            group: group.label,
            options: group.presets.map(({ value, label }) => ({ value, label })),
          })),
        ],
        onChange: handlers.changeSizeChoice,
      },
      width: {
        value: settings.width,
        min: minimumOutputDimensionPixels,
        max: limit,
        onChange: handlers.changeWidth,
      },
      height: {
        value: settings.height,
        min: minimumOutputDimensionPixels,
        max: limit,
        onChange: handlers.changeHeight,
      },
      sizeHint: `${String(minimumOutputDimensionPixels)}–${String(limit)} px per side · anchored at the top left`,
      resolution: isPng
        ? {
            value: String(settings.pngScale),
            options: ['1', '2'],
            onChange: handlers.changeResolution,
          }
        : undefined,
      isTransparent: { value: settings.transparent, onChange: handlers.setTransparent },
      isExtraLargeAllowed: {
        value: settings.allowExtraLargeExports,
        onChange: handlers.setExtraLargeAllowed,
      },
      extraLargeWarning: settings.allowExtraLargeExports
        ? 'Up to 12,288 px per side. Large PNGs can use over 576 MiB of memory and may freeze this tab.'
        : undefined,
    },
    preview: {
      src: ui.previewUrl === '' ? undefined : ui.previewUrl,
      alt: previewAlt,
      caption: `${outputSize} px · cursor hill excluded`,
      onError: handlers.failPreview,
    },
    primaryAction: {
      label: ui.isBusy ? 'Generating…' : `Download ${settings.format.toUpperCase()}`,
      onClick: handlers.download,
      isDisabled: ui.isBusy || (!raster.ok && isPng),
      isBusy: ui.isBusy,
    },
    still: is3d
      ? {
          scale: {
            value: String(ui.stillScale),
            options: terrainStillScales.map((stillScale) => ({
              value: String(stillScale),
              label: `${String(stillScale)}×`,
            })),
          },
          onScaleChange: handlers.changeStillScale,
          hint: `The current 3D view, with its lens, focus and lighting, at ${String(ui.stillScale)}× its on-screen size.${terrain ? ' Includes terrain attribution.' : ''}`,
          action: {
            label: ui.isStillBusy ? 'Rendering…' : 'Download 3D still',
            onClick: handlers.downloadStill,
            isDisabled: ui.isStillBusy,
            isBusy: ui.isStillBusy,
          },
        }
      : undefined,
    model: is3d
      ? {
          formats: [
            { id: 'stl', label: 'STL', isSoon: false },
            { id: '3mf', label: '3MF', isSoon: true },
            { id: 'glb', label: 'GLB', isSoon: true },
          ],
          hints: [
            `${String(state.model.dimensions.widthMm)} ${
              state.model.dimensions.cropShape === 'circle'
                ? 'mm diameter'
                : `× ${String(state.model.dimensions.lengthMm)} mm`
            } · ${state.metrics.height?.toFixed(2) ?? '—'} mm overall height`,
            'Terrain and solid base, in millimeters. Scene materials, water, decorations and engraved grooves are excluded.',
          ],
          notice: describeFrameNotice(state),
          action: { label: 'Download STL', onClick: handlers.downloadStl },
          parts: frameParts.map((part) => ({
            id: part.id,
            label: part.id,
            detail: formatByteSize(estimateStlBytes(part)),
            isSelected: ui.selectedPartIds.has(part.id),
            onSelectedChange: (isSelected: boolean) => {
              handlers.setPartSelected(part.id, isSelected);
            },
            download: {
              label: `Download ${part.id} STL`,
              onClick: () => {
                handlers.downloadPart(part.id);
              },
            },
          })),
          partHints: frameParts.map(
            (part) =>
              `${part.id}: ${formatMm(part.sizeMm.x)} × ${formatMm(part.sizeMm.z)} × ${formatMm(part.sizeMm.y)} mm · print ${part.printOrientation}`,
          ),
          partsAction:
            frameParts.length > 0
              ? {
                  label: 'Download selected parts',
                  onClick: handlers.downloadSelectedParts,
                  isDisabled: selectedParts.length === 0 || areJobsActive,
                }
              : undefined,
        }
      : undefined,
    jobs: state.exportJobs.length > 0 ? state.exportJobs : undefined,
    faults: [
      ...(!raster.ok && isPng ? [{ message: raster.error.message }] : []),
      ...(ui.error === '' ? [] : [{ message: ui.error }]),
    ],
    attribution: terrain
      ? {
          text: terrain.attribution,
          action: { label: 'Download attribution', onClick: handlers.downloadAttribution },
        }
      : undefined,
    dossierAction: { label: 'Model dossier', onClick: handlers.openDossier },
    success: ui.success,
  };
}

export function getFrameParts(state: StudioState): readonly FramePart[] {
  return state.workspace.view === '3d' && state.frame.assembly?.ok === true
    ? state.frame.assembly.data.parts
    : [];
}

// === HELPERS ===

function describeTarget(state: StudioState): string {
  if (!state.source.terrain) {
    return `Seed ${String(state.design.seed)} · Generated`;
  }

  const { place, latitude, longitude } = state.source;

  return `Real terrain · ${place === '' ? `${latitude.toFixed(3)}, ${longitude.toFixed(3)}` : place}`;
}

function describeFrameNotice(state: StudioState): string | undefined {
  if (state.frame.settings.preset === 'none') {
    return undefined;
  }

  // The Frame tab owns the alert; repeating it here would announce it twice.
  if (state.frame.assembly?.ok === false) {
    return `Fix the frame in the Frame tab: ${state.frame.assembly.error.message}`;
  }

  return state.frame.assembly === undefined
    ? 'Frame parts appear once the 3D model has finished building.'
    : undefined;
}

function sumStlBytes(parts: readonly FramePart[]): number {
  return parts.reduce((total, part) => total + estimateStlBytes(part), 0);
}

function formatMm(valueMm: number): string {
  return String(Math.round(valueMm * 10) / 10);
}
