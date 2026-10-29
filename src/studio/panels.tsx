import type { ReactNode } from 'react';
import type { StudioController, StudioState } from './controller';
import {
  Button,
  Color,
  Group,
  Hint,
  NumberField,
  Range,
  Select,
  Toggle,
  namedOptions,
} from './fields';
import { designNumberConstraints, indexContourStyles } from '../constants/design';
import { designPalettePresets } from '../constants/palettes';
import { createRandomPalette } from '../random-palette';
import { resetDesignStyle } from '../design-settings';
import { getRealContourInterval } from '../real-terrain-contours';
import { landFinishes, terrainMaterialPresets, waterFinishes } from '../terrain-materials';
import {
  elevationGradientPresets,
  getElevationGradientCss,
  landscapeGradientPresets,
  maximumElevationColorStops,
  type ElevationColorStop,
} from '../terrain-elevation-gradient';
import { getTerrainWaterColor } from '../terrain-water';
import type { DesignSettings } from '../types/design';

export interface PanelProps {
  controller: StudioController;
  state: StudioState;
}

export function DesignRange({
  controller,
  state,
  setting,
  label,
  suffix = '',
}: PanelProps & {
  setting: keyof typeof designNumberConstraints;
  label: string;
  suffix?: string;
}): ReactNode {
  const [min, max, step] = designNumberConstraints[setting];

  return (
    <Range
      id={setting}
      label={label}
      value={state.design[setting]}
      min={min}
      max={max}
      step={step}
      suffix={suffix}
      onChange={(value) => controller.design({ [setting]: value })}
    />
  );
}

export function ContoursPanel({ controller: c, state: s }: PanelProps): ReactNode {
  return (
    <>
      {s.source.terrain ? (
        <Group title="Contour interval">
          <Select
            id="terrain-contour-mode"
            label="Interval mode"
            value={s.source.interval === 'auto' ? 'auto' : 'fixed'}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'fixed', label: 'Fixed interval' },
            ]}
            onChange={(value) => c.interval(value === 'auto' ? 'auto' : s.source.fixedInterval)}
          />
          {s.source.interval !== 'auto' && (
            <NumberField
              id="terrain-contour-interval"
              label="Interval (m)"
              value={s.source.fixedInterval}
              min={1}
              max={5000}
              onChange={(value) => value !== undefined && c.interval(value)}
            />
          )}
          <Hint>
            Contours: {getRealContourInterval(s.source.terrain)} m. Levels are anchored to 0 m;
            spacing stays fixed while orbiting and cropping.
          </Hint>
        </Group>
      ) : (
        <DesignRange controller={c} state={s} setting="contourCount" label="Density" />
      )}
      <Group title="Contour appearance">
        <Color
          id="lineColor"
          label="Contour color"
          value={s.design.lineColor}
          onChange={(value) => c.design({ lineColor: value })}
        />
        <DesignRange controller={c} state={s} setting="strokeOpacity" label="Opacity" />
        <DesignRange controller={c} state={s} setting="strokeWidth" label="Weight" suffix=" px" />
      </Group>
      <Group title="Index contours">
        <Select
          id="indexStyle"
          label="Index style"
          value={s.design.indexStyle}
          options={indexContourStyles}
          onChange={(value) => c.design({ indexStyle: value })}
        />
        {(['indexEvery', 'indexStrokeWidth', 'dashLength', 'dashGap'] as const).map(
          (setting, index) => (
            <DesignRange
              key={setting}
              controller={c}
              state={s}
              setting={setting}
              label={['Every N levels', 'Index weight', 'Dash', 'Gap'][index]}
              suffix={index === 0 ? '' : ' px'}
            />
          ),
        )}
      </Group>
      {s.workspace.view === '3d' && (
        <Group title="3D contours">
          <Toggle
            label="Contour lines"
            value={s.scene.contours}
            onChange={(value) => {
              c.scene({ contours: value });
            }}
          />
          <Select
            label="Treatment"
            value={s.scene.engraving.treatment}
            options={['drawn', 'engraved']}
            onChange={(value) => {
              c.scene({ engraving: { ...s.scene.engraving, treatment: value } });
            }}
          />
          {s.scene.engraving.treatment === 'engraved' && (
            <>
              <Range
                label="Groove width"
                value={s.scene.engraving.widthMm}
                min={0.1}
                max={3}
                step={0.1}
                suffix=" mm"
                onChange={(value) => {
                  c.scene({ engraving: { ...s.scene.engraving, widthMm: value } });
                }}
              />
              <Range
                label="Groove depth"
                value={s.scene.engraving.depthMm}
                min={0}
                max={1}
                step={0.02}
                suffix=" mm"
                onChange={(value) => {
                  c.scene({ engraving: { ...s.scene.engraving, depthMm: value } });
                }}
              />
              <Hint>Engraving is a visual preview. Grooves do not change STL geometry.</Hint>
            </>
          )}
        </Group>
      )}
    </>
  );
}

function Gradient({ controller: c, state: s }: PanelProps): ReactNode {
  const gradient = s.scene.gradient;

  const update = (patch: Partial<typeof gradient>) => {
    c.scene({
      gradient: { ...gradient, ...patch },
      gradientPreset: 'custom',
      gradientSource: 'user',
    });
  };

  return (
    <Group title="Elevation gradient">
      <Toggle
        label="Color by elevation"
        value={gradient.enabled}
        onChange={(value) => {
          c.scene({ gradient: { ...gradient, enabled: value } });
        }}
      />
      {gradient.enabled && (
        <>
          <Select
            label="Gradient preset"
            value={s.scene.gradientSource === 'location' ? 'location' : s.scene.gradientPreset}
            options={[
              { value: 'location', label: 'Match location' },
              { value: 'custom', label: 'Custom' },
              { group: 'Studio', options: namedOptions(elevationGradientPresets) },
              { group: 'Landscapes', options: namedOptions(landscapeGradientPresets) },
            ]}
            onChange={(key) => {
              if (key === 'location') {
                c.scene({ gradientSource: 'location' });

                return;
              }

              const preset = (
                {
                  ...elevationGradientPresets,
                  ...landscapeGradientPresets,
                } as Partial<Record<string, { stops: readonly ElevationColorStop[] }>>
              )[key];

              if (preset) {
                c.scene({
                  gradient: { ...gradient, stops: preset.stops.map((stop) => ({ ...stop })) },
                  gradientPreset: key,
                  gradientSource: 'user',
                });
              }
            }}
          />
          <Select
            label="Transitions"
            value={gradient.transition}
            options={['soft', 'hard']}
            onChange={(value) => {
              c.scene({ gradient: { ...gradient, transition: value } });
            }}
          />
          <div
            className="elevation-gradient-preview"
            role="img"
            aria-label="Elevation colors from low to high"
            style={{ backgroundImage: getElevationGradientCss(gradient) }}
          />
          <div className="elevation-gradient-labels">
            <span>Low elevation</span>
            <span>High elevation</span>
          </div>
          {gradient.stops.map((stop, index) => (
            <div className="gradient-stop" key={index}>
              <Color
                label={`Stop ${index + 1} color`}
                value={stop.color}
                onChange={(value) => {
                  update({
                    stops: gradient.stops.map((item, i) =>
                      i === index ? { ...item, color: value } : item,
                    ),
                  });
                }}
              />
              <NumberField
                label={`Stop ${index + 1} position %`}
                value={Math.round(stop.position * 100)}
                min={index === 0 ? 0 : Math.round(gradient.stops[index - 1].position * 100) + 1}
                max={
                  index === gradient.stops.length - 1
                    ? 100
                    : Math.round(gradient.stops[index + 1].position * 100) - 1
                }
                disabled={index === 0 || index === gradient.stops.length - 1}
                onChange={(value) => {
                  if (value !== undefined) {
                    update({
                      stops: gradient.stops.map((item, i) =>
                        i === index ? { ...item, position: value / 100 } : item,
                      ),
                    });
                  }
                }}
              />
              <Button
                disabled={index === 0 || index === gradient.stops.length - 1}
                onClick={() => {
                  update({ stops: gradient.stops.filter((_, i) => i !== index) });
                }}
              >
                Remove stop {index + 1}
              </Button>
            </div>
          ))}
          <div className="actions">
            <Button
              disabled={gradient.stops.length >= maximumElevationColorStops}
              onClick={() => {
                let gap = 0;

                for (let i = 1; i < gradient.stops.length - 1; i++) {
                  if (
                    gradient.stops[i + 1].position - gradient.stops[i].position >
                    gradient.stops[gap + 1].position - gradient.stops[gap].position
                  ) {
                    gap = i;
                  }
                }

                const left = gradient.stops[gap];
                const right = gradient.stops[gap + 1];

                update({
                  stops: [
                    ...gradient.stops.slice(0, gap + 1),
                    { position: (left.position + right.position) / 2, color: left.color },
                    ...gradient.stops.slice(gap + 1),
                  ],
                });
              }}
            >
              Add color stop
            </Button>
            <Button
              onClick={() => {
                update({
                  stops: [...gradient.stops]
                    .reverse()
                    .map((stop) => ({ ...stop, position: 1 - stop.position })),
                });
              }}
            >
              Reverse
            </Button>
          </div>
          <Hint>
            Colors stay anchored to the landscape when cropping. Land finish controls texture and
            sheen.
          </Hint>
        </>
      )}
    </Group>
  );
}

export function ColourPanel({ controller: c, state: s }: PanelProps): ReactNode {
  const scene = s.scene;

  return (
    <>
      <Group title="Palette">
        <div className="presets">
          {Object.entries(designPalettePresets).map(([name, preset]) => (
            <button
              type="button"
              key={name}
              aria-pressed={Object.entries(preset).every(
                ([key, value]) => s.design[key as keyof DesignSettings] === value,
              )}
              onClick={() => c.design(preset)}
            >
              <span
                className="preset-swatch"
                style={{ background: preset.background, borderColor: preset.lineColor }}
              />
              {name}
            </button>
          ))}
          <Button onClick={() => c.design(createRandomPalette())}>Random</Button>
        </div>
        <Color
          id="background"
          label="Canvas color"
          value={s.design.background}
          onChange={(value) => c.design({ background: value })}
        />
        <Hint>
          Palette presets change both canvas and contour colours. Edit individual contour colour in
          Contours.
        </Hint>
      </Group>
      {s.workspace.view === '3d' && (
        <>
          <Group title="Materials">
            <Select
              label="Material preset"
              value={scene.materialPreset}
              options={[
                { value: 'custom', label: 'Custom' },
                ...namedOptions(terrainMaterialPresets),
              ]}
              onChange={(key) => {
                c.material(key);
              }}
            />
          </Group>
          <Group title="Land">
            <Select
              label="Land finish"
              value={scene.landFinish}
              options={namedOptions(landFinishes)}
              onChange={(value) => {
                c.scene({ landFinish: value as typeof scene.landFinish }, true);
              }}
            />
            {!scene.gradient.enabled && (
              <>
                <Toggle
                  label={
                    scene.landFinish === 'natural' ? 'Use natural palette' : 'Match background'
                  }
                  value={scene.surfaceMatch}
                  onChange={(value) => {
                    c.scene({ surfaceMatch: value }, true);
                  }}
                />
                <Color
                  label={scene.landFinish === 'natural' ? 'Surface tint' : 'Surface color'}
                  value={
                    scene.surfaceMatch
                      ? scene.landFinish === 'natural'
                        ? '#ffffff'
                        : s.design.background
                      : scene.surfaceColor
                  }
                  disabled={scene.surfaceMatch}
                  onChange={(value) => {
                    c.scene({ surfaceColor: value }, true);
                  }}
                />
              </>
            )}
            <Hint>
              Natural blends moss, soil and rock. White tint preserves the original colours.
            </Hint>
          </Group>
          <Gradient controller={c} state={s} />
          <Group title="Water material">
            <Select
              label="Water finish"
              value={scene.waterFinish}
              options={namedOptions(waterFinishes)}
              onChange={(value) => {
                c.scene({ waterFinish: value as typeof scene.waterFinish }, true);
              }}
            />
            <Toggle
              label="Match terrain"
              value={scene.waterMatch}
              onChange={(value) => {
                c.scene({ waterMatch: value }, true);
              }}
            />
            <Color
              label="Water color"
              value={
                scene.waterMatch
                  ? getTerrainWaterColor(
                      scene.surfaceMatch ? s.design.background : scene.surfaceColor,
                    )
                  : scene.waterColor
              }
              disabled={scene.waterMatch}
              onChange={(value) => {
                c.scene({ waterColor: value }, true);
              }}
            />
          </Group>
        </>
      )}
      <Button onClick={() => c.design(resetDesignStyle(s.design))}>Reset design style</Button>
      <Hint>
        Resets shared design and interaction settings; preserves the seed, output options and 3D
        setup.
      </Hint>
    </>
  );
}
