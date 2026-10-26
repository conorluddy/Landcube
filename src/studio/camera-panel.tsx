import type { ReactNode } from 'react';
import type { PanelProps } from './panels';
import { Button, Group, Hint, Range, Segmented, Toggle } from './fields';
import {
  getNearestStopIndex,
  terrainApertureStops,
  terrainFocalLengthStopsMm,
  terrainFocusEffects,
  terrainProjections,
  terrainViewPresets,
  turntableDirections,
  type TerrainViewPreset,
} from '../terrain-camera';

/** 3D-only lens, focus and exposure; orbit position stays with the viewport and the Orbit popover. */
export function CameraPanel({ controller: c, state: s }: PanelProps): ReactNode {
  const camera = s.scene.camera;
  const isOrthographic = camera.projection === 'orthographic';

  return (
    <>
      <Group title="Lens">
        <Segmented
          label="Projection"
          value={camera.projection}
          options={terrainProjections}
          onChange={(projection) => {
            c.camera({ projection });
          }}
        />
        {isOrthographic ? (
          <Hint>Axonometric view: no perspective, so relief reads like a technical drawing.</Hint>
        ) : (
          <>
            <Range
              id="camera-focal-length"
              label="Focal length"
              value={getNearestStopIndex(terrainFocalLengthStopsMm, camera.focalLengthMm)}
              min={0}
              max={terrainFocalLengthStopsMm.length - 1}
              step={1}
              displayValue={`${camera.focalLengthMm} mm`}
              onChange={(index) => {
                c.camera({ focalLengthMm: terrainFocalLengthStopsMm[index] });
              }}
            />
            <Hint>
              Framing holds as you change lens. Wide exaggerates relief; long flattens it.
            </Hint>
          </>
        )}
      </Group>
      <Group title="Focus">
        <Segmented
          label="Effect"
          value={camera.focusEffect}
          options={terrainFocusEffects}
          onChange={(focusEffect) => {
            c.camera({ focusEffect });
          }}
        />
        {camera.focusEffect === 'tilt-shift' && (
          <>
            {(
              [
                ['tiltShiftPosition', 'Band position', 0, 100],
                ['tiltShiftWidth', 'Band width', 5, 60],
                ['tiltShiftBlur', 'Blur', 0, 100],
              ] as const
            ).map(([setting, label, min, max]) => (
              <Range
                key={setting}
                id={`camera-${setting}`}
                label={label}
                value={Math.round(camera[setting] * 100)}
                min={min}
                max={max}
                step={1}
                suffix="%"
                onChange={(value) => {
                  c.camera({ [setting]: value / 100 });
                }}
              />
            ))}
            <Hint>Blurs above and below a sharp band, like a tabletop miniature.</Hint>
          </>
        )}
        {camera.focusEffect === 'depth-of-field' &&
          (isOrthographic ? (
            <Hint>Depth of field needs perspective projection.</Hint>
          ) : (
            <>
              <Range
                id="camera-aperture"
                label="Aperture"
                value={getNearestStopIndex(terrainApertureStops, camera.apertureFStop)}
                min={0}
                max={terrainApertureStops.length - 1}
                step={1}
                displayValue={`f/${camera.apertureFStop}`}
                onChange={(index) => {
                  c.camera({ apertureFStop: terrainApertureStops[index] });
                }}
              />
              <Toggle
                label="Follow orbit target"
                value={camera.focusFollowsTarget}
                onChange={(focusFollowsTarget) => {
                  c.camera({ focusFollowsTarget });
                }}
              />
              <Button
                onClick={() => {
                  void c.pickFocus();
                }}
              >
                Pick focus
              </Button>
              <Hint>
                Lower f-numbers blur more. Pick focus, then click the terrain point to keep sharp.
              </Hint>
            </>
          ))}
      </Group>
      <Group title="Exposure">
        <Range
          id="camera-exposure"
          label="Exposure"
          value={camera.exposureEv}
          min={-2}
          max={2}
          step={0.1}
          displayValue={`${camera.exposureEv > 0 ? '+' : ''}${camera.exposureEv.toFixed(1)} EV`}
          onChange={(exposureEv) => {
            c.camera({ exposureEv });
          }}
        />
      </Group>
      <Button
        onClick={() => {
          c.resetCameraSettings();
        }}
      >
        Reset camera settings
      </Button>
    </>
  );
}

/** Quick orbit tools in the footer popover, available while the inspector is collapsed. */
export function OrbitPanel({ controller: c, state: s }: PanelProps): ReactNode {
  return (
    <Group title="Orbit">
      <div className="actions view-presets" role="group" aria-label="View presets">
        {(Object.keys(terrainViewPresets) as TerrainViewPreset[]).map((preset) => (
          <Button
            key={preset}
            onClick={() => {
              c.applyViewPreset(preset);
            }}
          >
            {terrainViewPresets[preset].label}
          </Button>
        ))}
      </div>
      <Toggle
        label="Auto-rotate"
        value={s.scene.rotating}
        onChange={(value) => {
          c.scene({ rotating: value });
        }}
      />
      <Range
        id="orbit-rotation-seconds"
        label="Rotation speed"
        value={s.scene.rotationSeconds}
        min={10}
        max={120}
        step={5}
        displayValue={`${s.scene.rotationSeconds} s per turn`}
        disabled={!s.scene.rotating}
        onChange={(rotationSeconds) => {
          c.scene({ rotationSeconds });
        }}
      />
      <Segmented
        label="Turn direction"
        value={s.scene.rotationDirection}
        options={turntableDirections}
        onChange={(rotationDirection) => {
          c.scene({ rotationDirection });
        }}
      />
      <Button
        onClick={() => {
          c.resetCamera();
        }}
      >
        Reset camera
      </Button>
      <Hint>
        Drag to orbit · scroll or pinch to zoom · right-drag to pan · double-click terrain to orbit
        around that point.
      </Hint>
    </Group>
  );
}
