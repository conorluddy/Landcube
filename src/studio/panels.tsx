import { useRef, type ReactNode } from 'react';
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
  realTerrainPresetGroups,
  realTerrainPresets,
  realTerrainSpanStopsKm,
} from '../constants/real-terrain';
import { designPalettePresets } from '../constants/palettes';
import { createRandomPalette } from '../random-palette';
import { resetDesignStyle } from '../design-settings';
import { getRealContourInterval } from '../real-terrain-contours';
import { landFinishes, terrainMaterialPresets, waterFinishes } from '../terrain-materials';
import { formatTimeOfDay, terrainLightingControls } from '../terrain-lighting';
import { floorStyles } from '../terrain-floor-styles';
import {
  elevationGradientPresets,
  getElevationGradientCss,
  landscapeGradientPresets,
  maximumElevationColorStops,
  type ElevationColorStop,
} from '../terrain-elevation-gradient';
import { getTerrainWaterColor } from '../terrain-water';
import type { DesignSettings } from '../types/design';
import type { RoadDetail } from '../types/roads';
import type { GrassPresetKey } from '../types/grass';
import { grassPresets } from '../constants/grass';
import {
  roadAttribution,
  roadAttributionUrl,
  roadWidthMmLimits,
  roadWidthMmPerModelKm,
} from '../constants/roads';
import { describeRoadNetwork } from './controller';

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
      <Group title="Autoplay">
        <Toggle
          label="Tour preset locations"
          value={source.autoplay.enabled}
          onChange={(value) => {
            void c.autoplay({ enabled: value });
          }}
        />
        {source.autoplay.enabled && (
          <Range
            id="autoplay-delay"
            label="Delay"
            value={source.autoplay.delaySeconds}
            min={5}
            max={60}
            step={1}
            suffix=" s"
            onChange={(value) => {
              void c.autoplay({ delaySeconds: value });
            }}
          />
        )}
        <Toggle
          label="Cycle daylight"
          value={s.scene.daylightCycle.enabled}
          onChange={(value) => {
            c.daylightCycle({ enabled: value });
          }}
        />
        {s.scene.daylightCycle.enabled && (
          <Range
            id="daylight-day-length"
            label="Day length"
            value={s.scene.daylightCycle.daySeconds}
            min={30}
            max={180}
            step={5}
            suffix=" s"
            onChange={(value) => {
              c.daylightCycle({ daySeconds: value });
            }}
          />
        )}
      </Group>
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
          <Range
            id="terrain-span"
            label="Area span"
            value={getNearestSpanStopIndex(source.spanKm)}
            min={0}
            max={realTerrainSpanStopsKm.length - 1}
            step={1}
            displayValue={`${source.spanKm} km`}
            onChange={(index) => {
              c.source({ spanKm: realTerrainSpanStopsKm[index] });
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
      <GrassGroup controller={c} state={s} />
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
        <Range
          id="terrain-light-time"
          label="Time of day"
          value={scene.lighting.timeOfDay}
          min={0}
          max={24}
          step={0.25}
          displayValue={formatTimeOfDay(scene.lighting.timeOfDay)}
          onChange={(timeOfDay) => {
            c.lighting({ timeOfDay });
          }}
        />
        <Toggle
          label="Flat light"
          value={scene.lighting.flat}
          onChange={(flat) => {
            c.lighting({ flat });
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
        <Range
          id="terrain-light-haze"
          label="Haze"
          value={scene.lighting.haze * 100}
          min={0}
          max={100}
          step={1}
          suffix="%"
          onChange={(value) => {
            c.lighting({ haze: value / 100 });
          }}
        />
        <Button
          onClick={() => {
            c.resetLighting();
          }}
        >
          Reset lighting
        </Button>
        <Hint>
          Time of day sets sun height, colour and studio tint; night switches to moonlight.
          Direction is clockwise from north. Locations suggest an artistic sunrise angle.
        </Hint>
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
          <Hint>
            Map grid and floor styles require a real location, studio floor and solid base. Each
            floor style draws its own north marker. Omitted from STL.
          </Hint>
        </Group>
      )}
      {s.workspace.view === '3d' && <RoadsGroup controller={c} state={s} />}
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

const grassLookOptions = [
  ...Object.entries(grassPresets).map(([value, preset]) => ({
    value: value as GrassPresetKey,
    label: preset.label,
  })),
  { value: 'custom' as const, label: 'Custom' },
];

/** Experimental instanced grass; colour, length and wind restyle without re-placing tufts. */
function GrassGroup({ controller: c, state: s }: PanelProps): ReactNode {
  const grass = s.scene.grass;
  const off = !grass.enabled;
  const percent = (
    label: string,
    key:
      | 'coverage'
      | 'clumping'
      | 'lengthVariation'
      | 'colorVariation'
      | 'dryness'
      | 'altitudeLimit'
      | 'wind',
  ) => (
    <Range
      label={label}
      value={Math.round(grass[key] * 100)}
      min={0}
      max={100}
      step={1}
      suffix="%"
      disabled={off}
      onChange={(value) => {
        c.grass({ [key]: value / 100 });
      }}
    />
  );

  return (
    <Group title="Grass">
      <Toggle
        label="Grass"
        value={grass.enabled}
        onChange={(value) => {
          c.grass({ enabled: value });
        }}
      />
      <Select
        id="grassLook"
        label="Look"
        value={grass.preset}
        options={grassLookOptions}
        disabled={off}
        onChange={(value) => {
          c.grass({ preset: value });
        }}
      />
      <Range
        label="Blade length"
        value={grass.lengthMm}
        min={0.2}
        max={4}
        step={0.05}
        suffix=" mm"
        disabled={off}
        onChange={(value) => {
          c.grass({ lengthMm: value });
        }}
      />
      {percent('Length variation', 'lengthVariation')}
      <Color
        label="Base colour"
        value={grass.baseColor}
        disabled={off}
        onChange={(value) => {
          c.grass({ baseColor: value });
        }}
      />
      <Color
        label="Tip colour"
        value={grass.tipColor}
        disabled={off}
        onChange={(value) => {
          c.grass({ tipColor: value });
        }}
      />
      <Color
        label="Dry colour"
        value={grass.dryColor}
        disabled={off}
        onChange={(value) => {
          c.grass({ dryColor: value });
        }}
      />
      {percent('Colour variation', 'colorVariation')}
      {percent('Dry patches', 'dryness')}
      <Range
        label="Density"
        value={grass.density}
        min={0}
        max={200}
        step={5}
        suffix=" /cm²"
        disabled={off}
        onChange={(value) => {
          c.grass({ density: value });
        }}
      />
      {percent('Coverage', 'coverage')}
      {percent('Clumping', 'clumping')}
      <Range
        label="Slope limit"
        value={grass.slopeLimitDegrees}
        min={10}
        max={60}
        step={1}
        suffix="°"
        disabled={off}
        onChange={(value) => {
          c.grass({ slopeLimitDegrees: value });
        }}
      />
      {percent('Altitude limit', 'altitudeLimit')}
      {percent('Wind', 'wind')}
      <Hint>
        Experimental. Length and density are on the printed model. Grass avoids drawn roads, the
        sea, slopes steeper than the limit on the real ground, and the top of the relief above the
        altitude limit. Wind pauses with reduced motion. Hidden on terraced models; session-only and
        omitted from STL and 2D exports.
      </Hint>
    </Group>
  );
}

const roadDetailOptions: readonly { value: RoadDetail; label: string }[] = [
  { value: 'major', label: 'Major roads' },
  { value: 'all', label: 'All roads' },
  { value: 'tracks', label: 'Roads and tracks' },
];

/** Mapped OSM roads draped over real terrain; fetched once per location when first enabled. */
function RoadsGroup({ controller: c, state: s }: PanelProps): ReactNode {
  const statusRef = useRef<HTMLParagraphElement>(null);
  const style = s.scene.roads;
  const isTerraced = s.model.dimensions.terrainShape === 'terraced';
  const network = s.roads.network;
  let status = s.roads.status;

  if (!s.source.terrain) {
    status = 'Roads need a real location.';
  } else if (isTerraced) {
    status = 'Roads are hidden on terraced models.';
  } else if (style.enabled && network && !s.roads.loading && status === '') {
    status = describeRoadNetwork(network, style);
  }

  return (
    <Group title="Roads">
      <Toggle
        label="Mapped roads"
        value={style.enabled}
        disabled={!s.source.terrain}
        onChange={(value) => {
          c.roads({ enabled: value });
        }}
      />
      <Select
        id="roadDetail"
        label="Detail"
        value={network?.detail === 'major' ? 'major' : style.detail}
        options={
          network?.detail === 'major'
            ? roadDetailOptions.filter((option) => option.value === 'major')
            : roadDetailOptions
        }
        disabled={!style.enabled}
        onChange={(value) => {
          c.roads({ detail: value });
        }}
      />
      <Color
        label="Road color"
        value={style.color}
        disabled={!style.enabled}
        onChange={(value) => {
          c.roads({ color: value });
        }}
      />
      <Range
        label="Road width"
        value={style.widthMm}
        min={roadWidthMmLimits.minimum}
        max={roadWidthMmLimits.maximum}
        step={roadWidthMmLimits.step}
        suffix=" mm"
        disabled={!style.enabled}
        onChange={(value) => {
          c.roads({ widthMm: value, autoWidth: false });
        }}
      />
      <Toggle
        label="Auto width for area"
        value={style.autoWidth}
        disabled={!style.enabled}
        onChange={(value) => {
          c.roads({ autoWidth: value });
        }}
      />
      <Range
        label="Road texture"
        value={style.texture * 100}
        min={0}
        max={100}
        step={1}
        suffix="%"
        disabled={!style.enabled}
        onChange={(value) => {
          c.roads({ texture: value / 100 });
        }}
      />
      {/* Always mounted, so screen readers announce download progress and failures. */}
      <p ref={statusRef} role="status" className="export-hint" tabIndex={-1}>
        {status}
      </p>
      {style.enabled && s.roads.canRetry && (
        <Button
          onClick={() => {
            // Retrying unmounts this button, so keyboard focus moves to the status it updates.
            statusRef.current?.focus();
            c.retryRoads();
          }}
        >
          Retry download
        </Button>
      )}
      <Hint>
        Experimental. Width is on the printed model; auto width is {roadWidthMmPerModelKm} mm per km
        of model area. Tunnels and bridges are hidden. Session-only and omitted from STL.
      </Hint>
      <a
        href={roadAttributionUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`${roadAttribution} (opens in a new tab)`}
      >
        {roadAttribution} ↗
      </a>
    </Group>
  );
}

/** Preset spans are stops; any other span shows on its nearest stop. */
function getNearestSpanStopIndex(spanKm: number): number {
  return realTerrainSpanStopsKm.reduce(
    (nearest, stopKm, index) =>
      Math.abs(stopKm - spanKm) < Math.abs(realTerrainSpanStopsKm[nearest] - spanKm)
        ? index
        : nearest,
    0,
  );
}
