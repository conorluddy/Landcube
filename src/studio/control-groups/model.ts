/*
 * Model section (MODL.01 to MODL.02): printable footprint and the shape of the terrain. The crop
 * preview widget is mounted by the host row; its mount logic stays in `crop-preview.ts`. The
 * pattern is in ./README.md.
 */
import { createElement } from 'react';
import type { ControlGroupDefinition } from '../../ui/control-rows';
import type { StudioController, StudioState } from '../controller';
import { customRow, hintRow, numberRow, selectRow, toggleRow } from '../control-rows';
import type { CropPreview } from '../crop-preview';
import { CropPreviewHost } from '../crop-preview-host';

// === PUBLIC API ===

/** `cropPreview` is the widget the Model section hosts; without one the preview row is omitted. */
export function buildModelGroups(
  controller: StudioController,
  state: StudioState,
  cropPreview?: CropPreview,
): ControlGroupDefinition[] {
  return [
    buildModelDimensionsGroup(controller, state, cropPreview),
    buildShapeGroup(controller, state),
  ];
}

// === GROUPS ===

function buildModelDimensionsGroup(
  controller: StudioController,
  state: StudioState,
  cropPreview: CropPreview | undefined,
): ControlGroupDefinition {
  const { dimensions } = state.model;
  const isCircle = dimensions.cropShape === 'circle';
  const widthRow = numberRow('model-width', {
    label: isCircle ? 'Diameter (mm)' : 'Width (X, mm)',
    value: dimensions.widthMm,
    min: 1,
    max: 1000,
    onChange: (value) => value !== undefined && controller.dimensions({ widthMm: value }),
  });

  return {
    id: 'model-dimensions',
    title: 'Model dimensions',
    rows: [
      cropPreview !== undefined &&
        customRow('crop-preview', () => createElement(CropPreviewHost, { cropPreview })),
      isCircle
        ? widthRow
        : {
            kind: 'pair',
            id: 'model-footprint',
            fields: [
              widthRow,
              {
                kind: 'number',
                id: 'model-length',
                label: 'Length (Y, mm)',
                value: dimensions.lengthMm,
                min: 1,
                max: 1000,
                onChange: (value) =>
                  value !== undefined && controller.dimensions({ lengthMm: value }),
              },
            ],
          },
      numberRow('model-base-thickness', {
        label: 'Base thickness (mm)',
        value: dimensions.baseThicknessMm,
        min: 0.1,
        max: 100,
        onChange: (value) =>
          value !== undefined && controller.dimensions({ baseThicknessMm: value }),
      }),
      hintRow('model-height-hint', [
        'Minimum material below the lowest valley. Overall height: ',
        createElement('output', { key: 'height' }, `${state.metrics.height?.toFixed(2) ?? '—'} mm`),
        '.',
      ]),
    ],
  };
}

function buildShapeGroup(controller: StudioController, state: StudioState): ControlGroupDefinition {
  const { model, metrics } = state;

  return {
    id: 'shape',
    title: 'Shape',
    rows: [
      selectRow('model-terrain-shape', {
        label: 'Terrain shape',
        value: model.dimensions.terrainShape ?? 'smooth',
        options: ['smooth', 'terraced'],
        onChange: (terrainShape) => {
          controller.dimensions({ terrainShape });
        },
      }),
      toggleRow('model-auto-exaggeration', {
        label: 'Auto height for location',
        value: model.autoExaggeration,
        onChange: (autoExaggeration) => {
          controller.model({ autoExaggeration });
        },
      }),
      {
        kind: 'range',
        id: 'model-exaggeration',
        label: 'Height exaggeration',
        value: model.exaggeration,
        min: 0,
        max: 1,
        step: 0.05,
        unit: '×',
        onChange: (exaggeration) => {
          controller.model({ exaggeration, autoExaggeration: false });
        },
      },
      model.dimensions.terrainShape === 'terraced' &&
        hintRow(
          'model-terraced-hint',
          `Flat shelves follow the contour interval and are included in STL. Layer height: ${metrics.layerHeight?.toFixed(3) ?? '—'} mm.`,
        ),
      hintRow('model-download-hint', 'Download the prepared model from Export → STL.'),
    ],
  };
}
