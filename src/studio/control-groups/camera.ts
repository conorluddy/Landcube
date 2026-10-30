/*
 * Camera section (CAMR.01 to CAMR.03): lens, focus and exposure, plus the Orbit section
 * (ORBT.01). Row ids are the original field ids the e2e tests bind to. The pattern is in
 * ./README.md.
 */
import { createElement } from 'react';
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
import { buttonRow, customRow, hintRow, segmentedRow, toggleRow } from '../control-rows';
import { ShotStrip } from '../shot-strip';

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
  ];
}

export function buildOrbitGroups(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition[] {
  return [buildOrbitGroup(controller, state), buildDirectorGroup(controller, state)];
}

// === GROUPS ===

function buildOrbitGroup(controller: StudioController, state: StudioState): ControlGroupDefinition {
  const { scene } = state;

  return {
    id: 'orbit',
    title: 'Orbit',
    isPinnable: true,
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
    ],
  };
}

function buildDirectorGroup(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition {
  const { shots, isPlaying } = state.cameraShots;

  return {
    id: 'director',
    title: 'Director',
    rows: [
      shots.length > 0
        ? customRow('director-shots', () => createElement(ShotStrip, { controller, shots }))
        : hintRow(
            'director-empty',
            'Frame a view and press B to save it as a shot. P plays the shots as a looping tour.',
          ),
      buttonRow('director-add-shot', {
        children: 'Add shot',
        onClick: () => {
          controller.saveCameraShot();
        },
      }),
      buttonRow('director-play', {
        children: isPlaying ? 'Stop' : 'Play',
        disabled: shots.length === 0,
        onClick: () => {
          controller.toggleCameraShotPlayback();
        },
      }),
      buttonRow('director-clear', {
        children: 'Clear shots',
        disabled: shots.length === 0,
        onClick: () => {
          controller.clearCameraShots();
        },
      }),
    ],
  };
}

function buildLensGroup(controller: StudioController, state: StudioState): ControlGroupDefinition {
  const { camera } = state.scene;
  const isOrthographic = camera.projection === 'orthographic';

  return {
    id: 'lens',
    title: 'Lens',
    isPinnable: true,
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
    isPinnable: true,
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
    isPinnable: true,
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
      // Last in the section because it resets lens, focus and exposure together.
      buttonRow('camera-reset-settings', {
        children: 'Reset camera settings',
        onClick: () => {
          controller.resetCameraSettings();
        },
      }),
    ],
  };
}
