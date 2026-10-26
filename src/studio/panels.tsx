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
import {
  designNumberConstraints,
  indexContourStyles,
  summitMarkerSizes,
} from '../constants/design';
import {
  realTerrainBounds,
  realTerrainPresetGroups,
  realTerrainPresets,
} from '../constants/real-terrain';
import { designPalettePresets } from '../constants/palettes';
import { createRandomPalette } from '../random-palette';
import { resetDesignStyle } from '../design-settings';
import { getRealContourInterval } from '../real-terrain-contours';
import { landFinishes, terrainMaterialPresets, waterFinishes } from '../terrain-materials';
import { terrainLightingControls } from '../terrain-lighting';
import { floorStyles } from '../terrain-floor-styles';
import {
  elevationGradientPresets,
  getElevationGradientCss,
  maximumElevationColorStops,
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

export function TerrainPanel({ controller: c, state: s }: PanelProps): ReactNode {
  const source = s.source;

  return (
    <>
      {source.selected === 'generated' ? (
        <Group title="Procedural landscape">
          <Hint>
            Seed <output id="seed-value">{s.design.seed}</output>
          </Hint>
          <Toggle
            label="Lock seed"
            value={s.seedLocked}
            onChange={(value) => {
              c.lockSeed(value);
            }}
          />
          <Button
            primary
            disabled={s.seedLocked}
            onClick={() => {
              c.newLandscape();
            }}
          >
            New landscape
          </Button>
          <DesignRange
            controller={c}
            state={s}
            setting="featureScale"
            label="Feature scale"
            suffix=" px"
          />
          <DesignRange controller={c} state={s} setting="detail" label="Terrain detail" />
        </Group>
      ) : (
        <Group title="Real location">
          <label className="field-row">
            <span>Location</span>
            <select
              id="terrain-place"
              value={source.place}
              onChange={(event) => {
                const preset = realTerrainPresets.find(
                  (place) => `${place.latitude},${place.longitude}` === event.target.value,
                );

                if (preset) {
                  c.source({
                    place: event.target.value,
                    latitude: preset.latitude,
                    longitude: preset.longitude,
                    spanKm: preset.spanKm,
                  });
                }
              }}
            >
              {realTerrainPresetGroups.map((group) => (
                <optgroup label={group.country} key={group.country}>
                  {group.locations.map((place) => (
                    <option key={place.name} value={`${place.latitude},${place.longitude}`}>
                      {place.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="control-grid">
            <NumberField
              id="terrain-latitude"
              label="Latitude"
              value={source.latitude}
              min={-85}
              max={85}
              onChange={(value) => {
                c.source({ latitude: value });
              }}
            />
            <NumberField
              id="terrain-longitude"
              label="Longitude"
              value={source.longitude}
              min={-180}
              max={180}
              onChange={(value) => {
                c.source({ longitude: value });
              }}
            />
          </div>
          <NumberField
            id="terrain-span"
            label="Area span (km)"
            value={source.spanKm}
            min={realTerrainBounds.minimumSpanKm}
            max={realTerrainBounds.maximumSpanKm}
            onChange={(value) => {
              c.source({ spanKm: value });
            }}
          />
          <NumberField
            id="terrain-max-depth"
            label="Maximum depth below sea level (m)"
            value={source.maxDepth}
            min={0}
            max={11000}
            onChange={(value) => {
              c.source({ maxDepth: value });
            }}
          />
          <NumberField
            id="terrain-elevation-floor"
            label="Elevation floor (m, optional)"
            optional
            value={source.elevationFloor}
            min={-11000}
            max={8900}
            onChange={(value) => {
              c.source({ elevationFloor: value });
            }}
          />
          <Hint>
            Elevation filters reduce coastal source artifacts; they do not trace a shoreline.
          </Hint>
          <Button
            primary
            disabled={source.loading}
            onClick={() => {
              void c.loadTerrain();
            }}
          >
            {source.loading ? 'Loading terrain…' : 'Load terrain'}
          </Button>
          <p role="status">{source.status}</p>
          <Hint>Locations are session-only and excluded from style links.</Hint>
          {source.terrain && <Hint>{source.terrain.attribution}</Hint>}
          <a
            href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md"
            target="_blank"
            rel="noreferrer"
          >
            Terrain data sources & attribution ↗
          </a>
        </Group>
      )}
    </>
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
    c.scene({ gradient: { ...gradient, ...patch }, gradientPreset: 'custom' });
  };

  return (
    <Group title="Elevation gradient">
      <Toggle
        label="Color by elevation"
        value={gradient.enabled}
        onChange={(value) => {
          update({ enabled: value });
        }}
      />
      {gradient.enabled && (
        <>
          <Select
            label="Gradient preset"
            value={s.scene.gradientPreset}
            options={[
              { value: 'custom', label: 'Custom' },
              ...namedOptions(elevationGradientPresets),
            ]}
            onChange={(key) => {
              const preset = (
                elevationGradientPresets as Partial<
                  Record<
                    string,
                    (typeof elevationGradientPresets)[keyof typeof elevationGradientPresets]
                  >
                >
              )[key];

              if (preset) {
                c.scene({
                  gradient: { ...gradient, stops: preset.stops.map((stop) => ({ ...stop })) },
                  gradientPreset: key,
                });
              }
            }}
          />
          <Select
            label="Transitions"
            value={gradient.transition}
            options={['soft', 'hard']}
            onChange={(value) => {
              update({ transition: value });
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

export function ScenePanel({ controller: c, state: s }: PanelProps): ReactNode {
  const scene = s.scene;

  if (s.workspace.view === '2d') {
    return (
      <Group title="Cursor interaction">
        <Toggle
          label="Enable interaction"
          value={s.design.cursorEnabled}
          disabled={s.source.terrain !== undefined}
          onChange={(value) => c.design({ cursorEnabled: value })}
        />
        {(['cursorRadius', 'cursorHeight', 'cursorResponseMs'] as const).map((setting, i) => (
          <DesignRange
            key={setting}
            controller={c}
            state={s}
            setting={setting}
            label={['Radius', 'Strength', 'Response time'][i]}
            suffix={[' px', '', ' ms'][i]}
          />
        ))}
        <Hint>
          Cursor deformation is disabled for real terrain and excluded from static exports.
        </Hint>
      </Group>
    );
  }

  return (
    <>
      <Group title="Surface">
        <Toggle
          label="Show land surface"
          value={scene.surface}
          onChange={(value) => {
            c.scene({ surface: value });
          }}
        />
        <Toggle
          label="Solid base"
          value={scene.base}
          onChange={(value) => {
            c.scene({ base: value });
          }}
        />
        <Hint>Visibility affects the preview. STL always includes terrain and a solid base.</Hint>
      </Group>
      <Group title="Ground">
        <Toggle
          label="Studio floor"
          value={scene.ground}
          onChange={(value) => {
            c.scene({ ground: value });
          }}
        />
        <Toggle
          label="Match canvas"
          value={scene.groundMatch}
          onChange={(value) => {
            c.scene({ groundMatch: value });
          }}
        />
        <Color
          label="Floor color"
          value={scene.groundMatch ? s.design.background : scene.groundColor}
          disabled={scene.groundMatch}
          onChange={(value) => {
            c.scene({ groundColor: value });
          }}
        />
      </Group>
      <Group title="Water">
        <Select
          label="Water style"
          value={scene.waterStyle}
          options={['hatched', 'solid', 'off']}
          onChange={(value) => {
            c.scene({ waterStyle: value }, true);
          }}
        />
        {scene.waterStyle === 'solid' && scene.waterFinish === 'translucent' && (
          <Range
            label="Water opacity"
            value={scene.waterOpacity * 100}
            min={0}
            max={100}
            step={1}
            suffix="%"
            onChange={(value) => {
              c.scene({ waterOpacity: value / 100 });
            }}
          />
        )}
        <Toggle
          label="Preview water level"
          value={scene.previewWater}
          onChange={(value) => {
            c.scene({ previewWater: value });
          }}
        />
        {scene.previewWater && (
          <Range
            label="Water level"
            value={scene.previewWaterLevel * 100}
            min={0}
            max={100}
            step={1}
            suffix="%"
            onChange={(value) => {
              c.scene({ previewWaterLevel: value / 100 });
            }}
          />
        )}
        <Hint>
          Uses real terrain sea level, or a relative preview level. Water is omitted from STL.
        </Hint>
      </Group>
      <Group title="Lighting">
        <Select
          label="Light source"
          value={scene.lighting.mode}
          options={['sun', 'moon', 'off']}
          onChange={(value) => {
            c.lighting({ mode: value });
          }}
        />
        {terrainLightingControls.map((control) => (
          <Range
            key={control.key}
            id={`terrain-light-${control.key}`}
            label={control.label}
            value={scene.lighting[control.key]}
            min={control.min}
            max={control.max}
            step={control.step}
            suffix={control.suffix}
            onChange={(value) => {
              c.lighting({ [control.key]: value });
            }}
          />
        ))}
        <Button
          onClick={() => {
            c.resetLighting();
          }}
        >
          Reset lighting
        </Button>
        <Hint>Direction is clockwise from north. Locations suggest an artistic sunrise angle.</Hint>
      </Group>
    </>
  );
}

export function OverlaysPanel({ controller: c, state: s }: PanelProps): ReactNode {
  return (
    <>
      {s.workspace.view === '2d' ? (
        <>
          <Group title="Decorative grid">
            <Select
              id="gridStyle"
              label="Grid style"
              value={s.design.gridStyle}
              options={['off', 'squares', 'crosses']}
              onChange={(value) => c.design({ gridStyle: value })}
            />
            <DesignRange
              controller={c}
              state={s}
              setting="gridSpacing"
              label="Spacing"
              suffix=" px"
            />
            <DesignRange controller={c} state={s} setting="gridOpacity" label="Grid opacity" />
            <Hint>Pixel-spaced grid included in 2D artwork.</Hint>
          </Group>
          <Group title="Summit markers">
            <Select
              id="summitMarkerSize"
              label="Marker size"
              value={s.design.summitMarkerSize}
              options={summitMarkerSizes}
              onChange={(value) => c.design({ summitMarkerSize: value })}
            />
            <Toggle
              label="Triangles"
              value={s.design.summitTrianglesEnabled}
              onChange={(value) => c.design({ summitTrianglesEnabled: value })}
            />
            <Toggle
              label="Crosses"
              value={s.design.summitCrossesEnabled}
              onChange={(value) => c.design({ summitCrossesEnabled: value })}
            />
          </Group>
        </>
      ) : (
        <Group title="Geographic decorations">
          <Toggle
            label="Map grid"
            value={s.scene.mapGrid}
            disabled={!s.source.terrain || !s.scene.ground || !s.scene.base || !s.scene.surface}
            onChange={(value) => {
              c.scene({ mapGrid: value });
            }}
          />
          <Select
            id="floorStyle"
            label="Floor style"
            value={s.scene.floorStyle}
            options={namedOptions(floorStyles)}
            disabled={
              !s.source.terrain ||
              !s.scene.ground ||
              !s.scene.base ||
              !s.scene.surface ||
              !s.scene.mapGrid
            }
            onChange={(value) => {
              c.scene({ floorStyle: value as typeof s.scene.floorStyle });
            }}
          />
          <Toggle
            label="North arrow"
            value={s.scene.north}
            disabled={!s.source.terrain || !s.scene.ground || !s.scene.base || !s.scene.surface}
            onChange={(value) => {
              c.scene({ north: value });
            }}
          />
          <Hint>
            Map grid, floor styles and north arrow require a real location, studio floor and solid
            base. Floor styles other than Grid draw their own north marker. Omitted from STL.
          </Hint>
        </Group>
      )}
      {s.source.terrain && (
        <Group title="Sea level">
          <Toggle
            label="Sea-level hatching"
            value={s.source.hatching}
            onChange={(value) => {
              c.hatching(value);
            }}
          />
          <Hint>
            Marks elevations at or below 0 m, including 2D exports and the 3D hatched water
            treatment. Session-only.
          </Hint>
        </Group>
      )}
    </>
  );
}
