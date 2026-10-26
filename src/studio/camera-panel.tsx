import type { ReactNode } from 'react';
import type { PanelProps } from './panels';
import { Button, Group, Hint, Range, Segmented } from './fields';
import {
  getNearestStopIndex,
  terrainFocalLengthStopsMm,
  terrainProjections,
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
