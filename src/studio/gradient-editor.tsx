/*
 * Elevation gradient preview and colour-stop editor, the `custom` row of the "Elevation gradient"
 * group. Stateless: every edit goes through `onUpdate`, which the builder wires to the controller.
 */
import type { ReactNode } from 'react';
import { Button } from '../ui/button';
import { ColorField } from '../ui/color-field';
import { NumberField } from '../ui/number-field';
import {
  getElevationGradientCss,
  maximumElevationColorStops,
  type ElevationColorStop,
  type ElevationGradientSettings,
} from '../terrain-elevation-gradient';

export interface GradientEditorProps {
  gradient: ElevationGradientSettings;
  onUpdate: (patch: Partial<ElevationGradientSettings>) => void;
}

// === PUBLIC API ===

export function GradientEditor({ gradient, onUpdate }: GradientEditorProps): ReactNode {
  const { stops } = gradient;
  const lastIndex = stops.length - 1;

  const updateStops = (nextStops: ElevationColorStop[]): void => {
    onUpdate({ stops: nextStops });
  };

  return (
    <div className="lc-gradient-editor">
      <div
        className="lc-gradient-editor__preview"
        role="img"
        aria-label="Elevation colors from low to high"
        style={{ backgroundImage: getElevationGradientCss(gradient) }}
      />
      <div className="lc-gradient-editor__labels">
        <span>Low elevation</span>
        <span>High elevation</span>
      </div>
      {stops.map((stop, index) => (
        <div className="lc-gradient-editor__stop" key={index}>
          <ColorField
            label={`Stop ${index + 1} color`}
            value={stop.color}
            onChange={(color) => {
              updateStops(stops.map((item, i) => (i === index ? { ...item, color } : item)));
            }}
          />
          <NumberField
            label={`Stop ${index + 1} position %`}
            value={Math.round(stop.position * 100)}
            min={index === 0 ? 0 : Math.round(stops[index - 1].position * 100) + 1}
            max={index === lastIndex ? 100 : Math.round(stops[index + 1].position * 100) - 1}
            disabled={index === 0 || index === lastIndex}
            onChange={(value) => {
              if (value !== undefined) {
                updateStops(
                  stops.map((item, i) => (i === index ? { ...item, position: value / 100 } : item)),
                );
              }
            }}
          />
          <Button
            disabled={index === 0 || index === lastIndex}
            onClick={() => {
              updateStops(stops.filter((_, i) => i !== index));
            }}
          >
            Remove stop {index + 1}
          </Button>
        </div>
      ))}
      <div className="lc-gradient-editor__actions">
        <Button
          disabled={stops.length >= maximumElevationColorStops}
          onClick={() => {
            updateStops(insertStopInWidestGap(stops));
          }}
        >
          Add color stop
        </Button>
        <Button
          onClick={() => {
            updateStops(
              [...stops].reverse().map((stop) => ({ ...stop, position: 1 - stop.position })),
            );
          }}
        >
          Reverse
        </Button>
      </div>
    </div>
  );
}

// === HELPERS ===

/** Splits the widest gap between the inner stops, copying the colour of the stop below it. */
function insertStopInWidestGap(stops: readonly ElevationColorStop[]): ElevationColorStop[] {
  let gap = 0;

  for (let i = 1; i < stops.length - 1; i++) {
    if (stops[i + 1].position - stops[i].position > stops[gap + 1].position - stops[gap].position) {
      gap = i;
    }
  }

  const left = stops[gap];
  const right = stops[gap + 1];

  return [
    ...stops.slice(0, gap + 1),
    { position: (left.position + right.position) / 2, color: left.color },
    ...stops.slice(gap + 1),
  ];
}
