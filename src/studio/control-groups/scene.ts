/*
 * Scene section (SCEN.01 to SCEN.06): cursor interaction in 2D; surface, grass, ground, water and
 * lighting in 3D. The overlay groups (SCEN.07 to SCEN.12) register under SCEN too but render in the
 * Overlays popover; see ./overlays.ts. Row ids are the original field ids the e2e tests bind to.
 */
import type { ControlGroupDefinition } from '../../ui/control-rows';
import { formatTimeOfDay, terrainLightingControls } from '../../terrain-lighting';
import type { StudioController, StudioState } from '../controller';
import {
  buttonRow,
  colourRow,
  designRangeRow,
  hintRow,
  selectRow,
  toggleRow,
} from '../control-rows';
import { buildGrassGroup } from './scene-grass';

// === PUBLIC API ===

export function buildSceneGroups(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition[] {
  if (state.workspace.view === '2d') {
    return [buildCursorInteractionGroup(controller, state)];
  }

  return [
    buildSurfaceGroup(controller, state),
    buildGrassGroup(controller, state),
    buildGroundGroup(controller, state),
    buildWaterGroup(controller, state),
    buildLightingGroup(controller, state),
  ];
}

// === GROUPS ===

function buildCursorInteractionGroup(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition {
  return {
    id: 'cursor-interaction',
    title: 'Cursor interaction',
    isPinnable: true,
    rows: [
      toggleRow('cursorEnabled', {
        label: 'Enable interaction',
        value: state.design.cursorEnabled,
        disabled: state.source.terrain !== undefined,
        onChange: (isEnabled) => {
          controller.design({ cursorEnabled: isEnabled });
        },
      }),
      designRangeRow(controller, state, 'cursorRadius', 'Radius', ' px'),
      designRangeRow(controller, state, 'cursorHeight', 'Strength', ''),
      designRangeRow(controller, state, 'cursorResponseMs', 'Response time', ' ms'),
      hintRow(
        'cursor-interaction-hint',
        'Cursor deformation is disabled for real terrain and excluded from static exports.',
      ),
    ],
  };
}

function buildSurfaceGroup(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition {
  const { scene } = state;

  return {
    id: 'surface',
    title: 'Surface',
    isPinnable: true,
    rows: [
      toggleRow('scene-surface', {
        label: 'Show land surface',
        value: scene.surface,
        onChange: (isShown) => {
          controller.scene({ surface: isShown });
        },
      }),
      toggleRow('scene-base', {
        label: 'Solid base',
        value: scene.base,
        onChange: (isShown) => {
          controller.scene({ base: isShown });
        },
      }),
      hintRow(
        'surface-hint',
        'Visibility affects the preview. STL always includes terrain and a solid base.',
      ),
    ],
  };
}

function buildGroundGroup(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition {
  const { scene } = state;

  return {
    id: 'ground',
    title: 'Ground',
    isPinnable: true,
    rows: [
      toggleRow('scene-ground', {
        label: 'Studio floor',
        value: scene.ground,
        onChange: (isShown) => {
          controller.scene({ ground: isShown });
        },
      }),
      toggleRow('scene-ground-match', {
        label: 'Match canvas',
        value: scene.groundMatch,
        onChange: (isMatching) => {
          controller.scene({ groundMatch: isMatching });
        },
      }),
      colourRow('scene-ground-color', {
        label: 'Floor color',
        value: scene.groundMatch ? state.design.background : scene.groundColor,
        disabled: scene.groundMatch,
        onChange: (groundColor) => {
          controller.scene({ groundColor });
        },
      }),
    ],
  };
}

function buildWaterGroup(controller: StudioController, state: StudioState): ControlGroupDefinition {
  const { scene } = state;

  return {
    id: 'water',
    title: 'Water',
    isPinnable: true,
    rows: [
      selectRow('scene-water-style', {
        label: 'Water style',
        value: scene.waterStyle,
        options: ['hatched', 'solid', 'off'],
        onChange: (waterStyle) => {
          controller.scene({ waterStyle }, true);
        },
      }),
      scene.waterStyle === 'solid' &&
        scene.waterFinish === 'translucent' && {
          kind: 'range',
          id: 'scene-water-opacity',
          label: 'Water opacity',
          value: scene.waterOpacity * 100,
          min: 0,
          max: 100,
          step: 1,
          unit: '%',
          onChange: (percent) => {
            controller.scene({ waterOpacity: percent / 100 });
          },
        },
      toggleRow('scene-preview-water', {
        label: 'Preview water level',
        value: scene.previewWater,
        onChange: (isPreviewed) => {
          controller.scene({ previewWater: isPreviewed });
        },
      }),
      scene.previewWater && {
        kind: 'range',
        id: 'scene-water-level',
        label: 'Water level',
        value: scene.previewWaterLevel * 100,
        min: 0,
        max: 100,
        step: 1,
        unit: '%',
        onChange: (percent) => {
          controller.scene({ previewWaterLevel: percent / 100 });
        },
      },
      hintRow(
        'water-hint',
        'Uses real terrain sea level, or a relative preview level. Water is omitted from STL.',
      ),
    ],
  };
}

function buildLightingGroup(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition {
  const { lighting } = state.scene;

  return {
    id: 'lighting',
    title: 'Lighting',
    isPinnable: true,
    rows: [
      {
        kind: 'range',
        id: 'terrain-light-time',
        label: 'Time of day',
        value: lighting.timeOfDay,
        min: 0,
        max: 24,
        step: 0.25,
        displayValue: formatTimeOfDay(lighting.timeOfDay),
        onChange: (timeOfDay) => {
          controller.lighting({ timeOfDay });
        },
      },
      toggleRow('terrain-light-flat', {
        label: 'Flat light',
        value: lighting.flat,
        onChange: (flat) => {
          controller.lighting({ flat });
        },
      }),
      ...terrainLightingControls.map((control): ControlGroupDefinition['rows'][number] => ({
        kind: 'range',
        id: `terrain-light-${control.key}`,
        label: control.label,
        value: lighting[control.key],
        min: control.min,
        max: control.max,
        step: control.step,
        unit: control.suffix,
        onChange: (value) => {
          controller.lighting({ [control.key]: value });
        },
      })),
      {
        kind: 'range',
        id: 'terrain-light-haze',
        label: 'Haze',
        value: lighting.haze * 100,
        min: 0,
        max: 100,
        step: 1,
        unit: '%',
        onChange: (percent) => {
          controller.lighting({ haze: percent / 100 });
        },
      },
      buttonRow('terrain-light-reset', {
        children: 'Reset lighting',
        onClick: () => {
          controller.resetLighting();
        },
      }),
      hintRow(
        'lighting-hint',
        'Time of day sets sun height, colour and studio tint; night switches to moonlight. Direction is clockwise from north. Locations suggest an artistic sunrise angle.',
      ),
    ],
  };
}
