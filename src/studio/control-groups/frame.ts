/*
 * Frame section (FRAM.01 to FRAM.03): printable frame style and finish, its key dimensions and its
 * edge profile. Dimensions and edge are hidden while the style is "none". Parts download from
 * Export. Row ids follow the original group labels the e2e tests bind to. The pattern is in
 * ./README.md.
 */
import { createElement, type ReactNode } from 'react';
import {
  frameFinishKeys,
  frameFinishes,
  frameStudioPresets,
  getMinimumStandHeightMm,
  isPedestalPreset,
  pedestalRecessDepthMm,
} from '../../frame/frame-studio-settings';
import type { FrameStudioPreset, FrameStudioSettings } from '../../frame/frame-studio-settings';
import type { ControlGroupDefinition, RangeRow } from '../../ui/control-rows';
import type { StudioController, StudioState } from '../controller';
import { hintRow, statusRow, tilesRow, toggleRow } from '../control-rows';

type EdgeShape = FrameStudioSettings['edgeShape'];

/** Cross-sections of the frame's top outer corner, in the tile's text colour. */
const edgeShapeProfiles: Record<EdgeShape, string> = {
  square: 'M4 20V4h16v16z',
  chamfer: 'M4 20V4h8l8 8v8z',
  cove: 'M4 20V4h8a8 8 0 0 0 8 8v8z',
  round: 'M4 20V4h8a8 8 0 0 1 8 8v8z',
  ogee: 'M4 20V4h8q4 0 4 4t4 4v8z',
  step: 'M4 20V4h8v4h4v4h4v8z',
};
const edgeShapes: readonly EdgeShape[] = ['square', 'chamfer', 'cove', 'round', 'ogee', 'step'];

/** Side profiles: the model in green, frame parts in the tile's text colour. */
const styleProfiles: Record<FrameStudioPreset, { frame: string; modelY: number }> = {
  none: { frame: '', modelY: 14 },
  tray: { frame: 'M4 6h4v12h24V6h4v16H4z', modelY: 12 },
  pedestal: { frame: 'M4 16h32v6H4z', modelY: 8 },
  'stacked-pedestal': { frame: 'M8 13h24v4H8zM3 17h34v5H3z', modelY: 5 },
  'tray-on-plinth': { frame: 'M6 4h3v10h22V4h3v12H6zM3 16h34v6H3z', modelY: 8 },
};

// === PUBLIC API ===

export function buildFrameGroups(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition[] {
  const { preset } = state.frame.settings;

  return [
    buildFrameStyleGroup(controller, state),
    ...(preset === 'none'
      ? []
      : [buildDimensionsGroup(controller, state), buildEdgeGroup(controller, state)]),
  ];
}

// === GROUPS ===

function buildFrameStyleGroup(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition {
  const { settings, assembly } = state.frame;

  return {
    id: 'frame',
    title: 'Frame',
    isPinnable: true,
    rows: [
      tilesRow('frame-style', {
        label: 'Frame style',
        value: settings.preset,
        columns: 5,
        options: frameStudioPresets.map(({ value, label }) => ({
          value,
          label,
          thumbnail: renderStyleThumbnail(value),
        })),
        onChange: (preset) => {
          controller.frame({ preset });
        },
      }),
      settings.preset !== 'none' &&
        tilesRow('frame-finish', {
          label: 'Frame finish',
          value: settings.finish,
          columns: 3,
          options: frameFinishKeys.map((finish) => ({
            value: finish,
            label: frameFinishes[finish].label,
            swatchColor: frameFinishes[finish].color,
          })),
          onChange: (finish) => {
            controller.frame({ finish });
          },
        }),
      settings.preset === 'none' &&
        hintRow('frame-none-hint', 'Add a tray or pedestal printed separately to fit this model.'),
      isPedestalPreset(settings.preset) &&
        hintRow(
          'frame-recess-hint',
          `The model sits in a ${pedestalRecessDepthMm} mm locating recess on top.`,
        ),
      assembly?.ok === false &&
        statusRow('frame-assembly-error', {
          kind: 'fault',
          isAlert: true,
          children: assembly.error.message,
        }),
    ],
  };
}

function buildDimensionsGroup(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition {
  const { settings } = state.frame;
  const isTray = settings.preset === 'tray' || settings.preset === 'tray-on-plinth';
  const hasStand = settings.preset !== 'none' && settings.preset !== 'tray';

  return {
    id: 'dimensions',
    title: 'Dimensions',
    isPinnable: true,
    rows: [
      millimetreRow('frame-border', isTray ? 'Border' : 'Overhang', settings.borderWidthMm, {
        min: 1.2,
        max: 60,
        step: 0.1,
        onChange: (borderWidthMm) => {
          controller.frame({ borderWidthMm });
        },
      }),
      millimetreRow('frame-clearance', 'Clearance', settings.clearanceMm, {
        min: -1,
        max: 2,
        step: 0.05,
        onChange: (clearanceMm) => {
          controller.frame({ clearanceMm });
        },
      }),
      isTray &&
        millimetreRow('frame-rim-above-base', 'Rim above base', settings.rimAboveBaseMm, {
          min: -20,
          max: 50,
          step: 0.5,
          onChange: (rimAboveBaseMm) => {
            controller.frame({ rimAboveBaseMm });
          },
        }),
      hasStand &&
        millimetreRow('frame-stand-height', 'Stand height', settings.standHeightMm, {
          min: getMinimumStandHeightMm(settings.preset),
          max: 100,
          step: 0.5,
          onChange: (standHeightMm) => {
            controller.frame({ standHeightMm });
          },
        }),
    ],
  };
}

function buildEdgeGroup(controller: StudioController, state: StudioState): ControlGroupDefinition {
  const { settings } = state.frame;

  return {
    id: 'edge',
    title: 'Edge',
    isPinnable: true,
    rows: [
      tilesRow('frame-edge-shape', {
        label: 'Edge shape',
        value: settings.edgeShape,
        columns: 6,
        options: edgeShapes.map((shape) => ({
          value: shape,
          label: shape[0].toUpperCase() + shape.slice(1),
          thumbnail: renderEdgeThumbnail(shape),
        })),
        onChange: (edgeShape) => {
          controller.frame({ edgeShape });
        },
      }),
      settings.edgeShape !== 'square' &&
        millimetreRow('frame-edge-size', 'Edge size', settings.edgeSizeMm, {
          min: 0.2,
          max: 20,
          step: 0.1,
          onChange: (edgeSizeMm) => {
            controller.frame({ edgeSizeMm });
          },
        }),
      toggleRow('frame-floating-toe', {
        label: 'Floating toe',
        value: settings.hasFloatingToe,
        onChange: (hasFloatingToe) => {
          controller.frame({ hasFloatingToe });
        },
      }),
      hintRow('frame-download-hint', 'Download each part from Export → STL.'),
    ],
  };
}

// === HELPERS ===

function millimetreRow(
  id: string,
  label: string,
  value: number,
  props: Pick<RangeRow, 'min' | 'max' | 'step' | 'onChange'>,
): RangeRow {
  return { kind: 'range', id, label, value, unit: ' mm', ...props };
}

function renderStyleThumbnail(preset: FrameStudioPreset): ReactNode {
  const { frame, modelY } = styleProfiles[preset];

  return createElement(
    'svg',
    { width: 40, height: 22, viewBox: '0 0 40 24', 'aria-hidden': true },
    createElement('path', {
      d: `M10 ${modelY + 6}V${modelY + 2}l5-3 4 2 5-5 6 5v7z`,
      fill: '#7f9a6a',
    }),
    frame && createElement('path', { d: frame, fill: 'currentColor' }),
  );
}

function renderEdgeThumbnail(shape: EdgeShape): ReactNode {
  return createElement(
    'svg',
    { width: 22, height: 22, viewBox: '0 0 24 24', 'aria-hidden': true },
    createElement('path', { d: edgeShapeProfiles[shape], fill: 'currentColor' }),
  );
}
