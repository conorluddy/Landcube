/*
 * Contours section (CONT.01 to CONT.04): contour interval (real terrain) or density (procedural),
 * line appearance, index contours, and in 3D the contour line and engraving treatment.
 * Row ids are the original field ids the e2e tests bind to. The pattern is in ./README.md.
 */
import { indexContourStyles } from '../../constants/design';
import { getRealContourInterval } from '../../real-terrain-contours';
import type { ControlGroupDefinition } from '../../ui/control-rows';
import type { StudioController, StudioState } from '../controller';
import {
  colourRow,
  designRangeRow,
  hintRow,
  numberRow,
  selectRow,
  toggleRow,
} from '../control-rows';

// === PUBLIC API ===

export function buildContourGroups(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition[] {
  return [
    buildContourDensityGroup(controller, state),
    buildContourAppearanceGroup(controller, state),
    buildIndexContoursGroup(controller, state),
    ...(state.workspace.view === '3d' ? [buildContours3dGroup(controller, state)] : []),
  ];
}

// === GROUPS ===

function buildContourDensityGroup(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition {
  const { source } = state;

  if (!source.terrain) {
    return {
      id: 'contour-density',
      title: 'Contour density',
      isPinnable: true,
      rows: [designRangeRow(controller, state, 'contourCount', 'Density')],
    };
  }

  return {
    id: 'contour-density',
    title: 'Contour interval',
    isPinnable: true,
    rows: [
      selectRow('terrain-contour-mode', {
        label: 'Interval mode',
        value: source.interval === 'auto' ? 'auto' : 'fixed',
        options: [
          { value: 'auto', label: 'Auto' },
          { value: 'fixed', label: 'Fixed interval' },
        ],
        onChange: (value) => {
          controller.interval(value === 'auto' ? 'auto' : source.fixedInterval);
        },
      }),
      source.interval !== 'auto' &&
        numberRow('terrain-contour-interval', {
          label: 'Interval (m)',
          value: source.fixedInterval,
          min: 1,
          max: 5000,
          onChange: (value) => value !== undefined && controller.interval(value),
        }),
      hintRow(
        'terrain-contour-hint',
        `Contours: ${getRealContourInterval(source.terrain) ?? ''} m. Levels are anchored to 0 m; spacing stays fixed while orbiting and cropping.`,
      ),
    ],
  };
}

function buildContourAppearanceGroup(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition {
  return {
    id: 'contour-appearance',
    title: 'Contour appearance',
    isPinnable: true,
    rows: [
      colourRow('lineColor', {
        label: 'Contour color',
        value: state.design.lineColor,
        onChange: (lineColor) => {
          controller.design({ lineColor });
        },
      }),
      designRangeRow(controller, state, 'strokeOpacity', 'Opacity'),
      designRangeRow(controller, state, 'strokeWidth', 'Weight', ' px'),
    ],
  };
}

function buildIndexContoursGroup(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition {
  return {
    id: 'index-contours',
    title: 'Index contours',
    isPinnable: true,
    rows: [
      selectRow('indexStyle', {
        label: 'Index style',
        value: state.design.indexStyle,
        options: indexContourStyles,
        onChange: (indexStyle) => {
          controller.design({ indexStyle });
        },
      }),
      designRangeRow(controller, state, 'indexEvery', 'Every N levels'),
      designRangeRow(controller, state, 'indexStrokeWidth', 'Index weight', ' px'),
      designRangeRow(controller, state, 'dashLength', 'Dash', ' px'),
      designRangeRow(controller, state, 'dashGap', 'Gap', ' px'),
    ],
  };
}

function buildContours3dGroup(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition {
  const { engraving } = state.scene;

  return {
    id: 'contours-3d',
    title: '3D contours',
    isPinnable: true,
    rows: [
      toggleRow('contours-3d-lines', {
        label: 'Contour lines',
        value: state.scene.contours,
        onChange: (contours) => {
          controller.scene({ contours });
        },
      }),
      selectRow('contours-3d-treatment', {
        label: 'Treatment',
        value: engraving.treatment,
        options: ['drawn', 'engraved'],
        onChange: (treatment) => {
          controller.scene({ engraving: { ...engraving, treatment } });
        },
      }),
      engraving.treatment === 'engraved' && {
        kind: 'range',
        id: 'contours-3d-groove-width',
        label: 'Groove width',
        value: engraving.widthMm,
        min: 0.1,
        max: 3,
        step: 0.1,
        unit: ' mm',
        onChange: (widthMm) => {
          controller.scene({ engraving: { ...engraving, widthMm } });
        },
      },
      engraving.treatment === 'engraved' && {
        kind: 'range',
        id: 'contours-3d-groove-depth',
        label: 'Groove depth',
        value: engraving.depthMm,
        min: 0,
        max: 1,
        step: 0.02,
        unit: ' mm',
        onChange: (depthMm) => {
          controller.scene({ engraving: { ...engraving, depthMm } });
        },
      },
      engraving.treatment === 'engraved' &&
        hintRow(
          'contours-3d-engraving-hint',
          'Engraving is a visual preview. Grooves do not change STL geometry.',
        ),
    ],
  };
}
