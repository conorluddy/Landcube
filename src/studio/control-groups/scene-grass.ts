/* Grass group (SCEN.03): experimental shell-textured grass; restyles without regrowing it. */
import { grassPresets } from '../../constants/grass';
import type { GrassPresetKey } from '../../types/grass';
import type { ControlGroupDefinition, ControlRow } from '../../ui/control-rows';
import type { StudioController, StudioState } from '../controller';
import { colourRow, hintRow, selectRow, toggleRow } from '../control-rows';

type PercentSetting =
  | 'coverage'
  | 'clumping'
  | 'lengthVariation'
  | 'colorVariation'
  | 'dryness'
  | 'altitudeLimit'
  | 'wind';

// === PUBLIC API ===

export function buildGrassGroup(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition {
  const { grass } = state.scene;
  const isOff = !grass.enabled;
  const percentRow = (id: string, label: string, setting: PercentSetting): ControlRow => ({
    kind: 'range',
    id,
    label,
    value: Math.round(grass[setting] * 100),
    min: 0,
    max: 100,
    step: 1,
    unit: '%',
    disabled: isOff,
    onChange: (percent) => {
      controller.grass({ [setting]: percent / 100 });
    },
  });

  return {
    id: 'grass',
    title: 'Grass',
    isPinnable: true,
    rows: [
      toggleRow('grass-enabled', {
        label: 'Grass',
        value: grass.enabled,
        onChange: (isEnabled) => {
          controller.grass({ enabled: isEnabled });
        },
      }),
      selectRow('grassLook', {
        label: 'Look',
        value: grass.preset,
        options: grassLookOptions,
        disabled: isOff,
        onChange: (preset) => {
          controller.grass({ preset });
        },
      }),
      {
        kind: 'range',
        id: 'grass-blade-length',
        label: 'Blade length',
        value: grass.lengthMm,
        min: 0.2,
        max: 4,
        step: 0.05,
        unit: ' mm',
        disabled: isOff,
        onChange: (lengthMm) => {
          controller.grass({ lengthMm });
        },
      },
      percentRow('grass-length-variation', 'Length variation', 'lengthVariation'),
      colourRow('grass-base-color', {
        label: 'Base colour',
        value: grass.baseColor,
        disabled: isOff,
        onChange: (baseColor) => {
          controller.grass({ baseColor });
        },
      }),
      colourRow('grass-tip-color', {
        label: 'Tip colour',
        value: grass.tipColor,
        disabled: isOff,
        onChange: (tipColor) => {
          controller.grass({ tipColor });
        },
      }),
      colourRow('grass-dry-color', {
        label: 'Dry colour',
        value: grass.dryColor,
        disabled: isOff,
        onChange: (dryColor) => {
          controller.grass({ dryColor });
        },
      }),
      percentRow('grass-color-variation', 'Colour variation', 'colorVariation'),
      percentRow('grass-dry-patches', 'Dry patches', 'dryness'),
      {
        kind: 'range',
        id: 'grass-density',
        label: 'Density',
        value: grass.bladesPerSquareCm,
        min: 50,
        max: 5000,
        step: 50,
        unit: ' /cm²',
        disabled: isOff,
        onChange: (bladesPerSquareCm) => {
          controller.grass({ bladesPerSquareCm });
        },
      },
      percentRow('grass-coverage', 'Coverage', 'coverage'),
      percentRow('grass-clumping', 'Clumping', 'clumping'),
      {
        kind: 'range',
        id: 'grass-slope-limit',
        label: 'Slope limit',
        value: grass.slopeLimitDegrees,
        min: 10,
        max: 60,
        step: 1,
        unit: '°',
        disabled: isOff,
        onChange: (slopeLimitDegrees) => {
          controller.grass({ slopeLimitDegrees });
        },
      },
      percentRow('grass-altitude-limit', 'Altitude limit', 'altitudeLimit'),
      percentRow('grass-wind', 'Wind', 'wind'),
      hintRow(
        'grass-hint',
        'Experimental. Length and density are on the printed model. Grass avoids drawn roads, the sea, slopes steeper than the limit on the real ground, and the top of the relief above the altitude limit. Wind pauses with reduced motion. Hidden on terraced models; session-only and omitted from STL and 2D exports.',
      ),
    ],
  };
}

// === HELPERS ===

const grassLookOptions = [
  ...Object.entries(grassPresets).map(([value, preset]) => ({
    value: value as GrassPresetKey,
    label: preset.label,
  })),
  { value: 'custom' as const, label: 'Custom' },
];
