/*
 * Camera section (CAMR.01 to CAMR.04): lens, focus, exposure and orbit. The Orbit popover in the
 * footer renders the same orbit group (without the camera-settings reset), so while that popover
 * is open the section omits it rather than repeat its ids. Row ids are the legacy field ids the
 * e2e tests bind to. The pattern is in ./README.md.
 */
import type { ControlGroupDefinition } from '../../ui/control-rows';
import {
  getNearestStopIndex,
  terrainApertureStops,
  terrainFocalLengthStopsMm,
  terrainFocusEffects,
  terrainProjections,
  terrainViewPresets,
  turntableDirections,
  type TerrainViewPreset,
} from '../../terrain-camera';
import type { StudioController, StudioState } from '../controller';
import { buttonRow, hintRow, segmentedRow, toggleRow } from '../control-rows';

const tiltShiftSettings = [
  ['tiltShiftPosition', 'Band position', 0, 100],
  ['tiltShiftWidth', 'Band width', 5, 60],
  ['tiltShiftBlur', 'Blur', 0, 100],
] as const;

// === PUBLIC API ===

export function buildCameraGroups(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition[] {
  return [
    buildLensGroup(controller, state),
    buildFocusGroup(controller, state),
    buildExposureGroup(controller, state),
    ...(state.workspace.popover === 'Orbit' ? [] : [buildOrbitGroup(controller, state, true)]),
  ];
}

/**
 * Orbit tools. The section adds "Reset camera settings" (it resets lens, focus and exposure, which
 * the popover does not show); the popover omits it.
 */
export function buildOrbitGroup(
  controller: StudioController,
  state: StudioState,
  isResettingCameraSettings: boolean,
): ControlGroupDefinition {
  const { scene } = state;

  return {
    id: 'orbit',
    title: 'Orbit',
    rows: [
      {
        kind: 'buttons',
        id: 'orbit-view-presets',
        label: 'View presets',
        buttons: (Object.keys(terrainViewPresets) as TerrainViewPreset[]).map((preset) => ({
          key: preset,
          children: terrainViewPresets[preset].label,
          onClick: () => {
            controller.applyViewPreset(preset);
          },
        })),
      },
      toggleRow('orbit-auto-rotate', {
        label: 'Auto-rotate',
        value: scene.rotating,
        onChange: (rotating) => {
          controller.scene({ rotating });
        },
      }),
      {
        kind: 'range',
        id: 'orbit-rotation-seconds',
        label: 'Rotation speed',
        value: scene.rotationSeconds,
        min: 10,
        max: 120,
        step: 5,
        displayValue: `${scene.rotationSeconds} s per turn`,
        disabled: !scene.rotating,
        onChange: (rotationSeconds) => {
          controller.scene({ rotationSeconds });
        },
      },
      segmentedRow('orbit-turn-direction', {
        label: 'Turn direction',
        value: scene.rotationDirection,
        options: turntableDirections.map((direction) => ({
          ...direction,
          accessibleLabel: direction.description,
        })),
        onChange: (rotationDirection) => {
          controller.scene({ rotationDirection });
        },
      }),
      buttonRow('orbit-reset-camera', {
        children: 'Reset camera',
        onClick: () => {
          controller.resetCamera();
        },
      }),
      hintRow(
        'orbit-controls-hint',
        'Drag to orbit · scroll or pinch to zoom · right-drag to pan · double-click terrain to orbit around that point.',
      ),
      isResettingCameraSettings &&
        buttonRow('camera-reset-settings', {
          children: 'Reset camera settings',
          onClick: () => {
            controller.resetCameraSettings();
          },
        }),
    ],
  };
}

// === GROUPS ===

function buildLensGroup(controller: StudioController, state: StudioState): ControlGroupDefinition {
  const { camera } = state.scene;
  const isOrthographic = camera.projection === 'orthographic';

  return {
    id: 'lens',
    title: 'Lens',
    rows: [
      segmentedRow('camera-projection', {
        label: 'Projection',
        value: camera.projection,
        options: terrainProjections,
        onChange: (projection) => {
          controller.camera({ projection });
        },
      }),
      isOrthographic
        ? hintRow(
            'camera-axonometric-hint',
            'Axonometric view: no perspective, so relief reads like a technical drawing.',
          )
        : {
            kind: 'range',
            id: 'camera-focal-length',
            label: 'Focal length',
            value: getNearestStopIndex(terrainFocalLengthStopsMm, camera.focalLengthMm),
            min: 0,
            max: terrainFocalLengthStopsMm.length - 1,
            step: 1,
            displayValue: `${camera.focalLengthMm} mm`,
            onChange: (index) => {
              controller.camera({ focalLengthMm: terrainFocalLengthStopsMm[index] });
            },
          },
      !isOrthographic &&
        hintRow(
          'camera-lens-hint',
          'Framing holds as you change lens. Wide exaggerates relief; long flattens it.',
        ),
    ],
  };
}

function buildFocusGroup(controller: StudioController, state: StudioState): ControlGroupDefinition {
  const { camera } = state.scene;
  const isOrthographic = camera.projection === 'orthographic';

  return {
    id: 'focus',
    title: 'Focus',
    rows: [
      segmentedRow('camera-focus-effect', {
        label: 'Effect',
        value: camera.focusEffect,
        options: terrainFocusEffects,
        onChange: (focusEffect) => {
          controller.camera({ focusEffect });
        },
      }),
      ...(camera.focusEffect === 'tilt-shift'
        ? [
            ...tiltShiftSettings.map(([setting, label, min, max]) => ({
              kind: 'range' as const,
              id: `camera-${setting}`,
              label,
              value: Math.round(camera[setting] * 100),
              min,
              max,
              step: 1,
              unit: '%',
              onChange: (value: number) => {
                controller.camera({ [setting]: value / 100 });
              },
            })),
            hintRow(
              'camera-tilt-shift-hint',
              'Blurs above and below a sharp band, like a tabletop miniature.',
            ),
          ]
        : []),
      camera.focusEffect === 'depth-of-field' &&
        isOrthographic &&
        hintRow(
          'camera-depth-of-field-orthographic-hint',
          'Depth of field needs perspective projection.',
        ),
      ...(camera.focusEffect === 'depth-of-field' && !isOrthographic
        ? [
            {
              kind: 'range' as const,
              id: 'camera-aperture',
              label: 'Aperture',
              value: getNearestStopIndex(terrainApertureStops, camera.apertureFStop),
              min: 0,
              max: terrainApertureStops.length - 1,
              step: 1,
              displayValue: `f/${camera.apertureFStop}`,
              onChange: (index: number) => {
                controller.camera({ apertureFStop: terrainApertureStops[index] });
              },
            },
            toggleRow('camera-focus-follows-target', {
              label: 'Follow orbit target',
              value: camera.focusFollowsTarget,
              onChange: (focusFollowsTarget) => {
                controller.camera({ focusFollowsTarget });
              },
            }),
            buttonRow('camera-pick-focus', {
              children: 'Pick focus',
              onClick: () => {
                void controller.pickFocus();
              },
            }),
            hintRow(
              'camera-depth-of-field-hint',
              'Lower f-numbers blur more. Pick focus, then click the terrain point to keep sharp.',
            ),
          ]
        : []),
    ],
  };
}

function buildExposureGroup(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition {
  const { exposureEv } = state.scene.camera;

  return {
    id: 'exposure',
    title: 'Exposure',
    rows: [
      {
        kind: 'range',
        id: 'camera-exposure',
        label: 'Exposure',
        value: exposureEv,
        min: -2,
        max: 2,
        step: 0.1,
        displayValue: `${exposureEv > 0 ? '+' : ''}${exposureEv.toFixed(1)} EV`,
        onChange: (value) => {
          controller.camera({ exposureEv: value });
        },
      },
    ],
  };
}
