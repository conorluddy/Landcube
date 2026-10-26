import type { ReactNode } from 'react';
import type { PanelProps } from './panels';
import { Button, Group, Hint, Range, Segmented, Toggle } from './fields';
import {
  getNearestStopIndex,
  terrainFocalLengthStopsMm,
  terrainProjections,
  terrainViewPresets,
  turntableDirections,
  type TerrainViewPreset,
} from '../terrain-camera';

/** 3D-only lens settings; orbit position stays with the viewport and the Camera popover. */
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
      <Button
        onClick={() => {
          c.resetCameraSettings();
        }}
      >
        Reset lens
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
