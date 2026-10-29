import { useRef, type ReactNode } from 'react';
import type { StudioController, StudioState } from './controller';
import { Button, Color, Group, Hint, Range, Select, Toggle, namedOptions } from './fields';
import { designNumberConstraints, summitMarkerSizes } from '../constants/design';
import { formatTimeOfDay, terrainLightingControls } from '../terrain-lighting';
import { floorStyles } from '../terrain-floor-styles';
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

/** Experimental shell-textured grass; colour, length, density and wind restyle without regrowing it. */
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
        value={grass.bladesPerSquareCm}
        min={50}
        max={5000}
        step={50}
        suffix=" /cm²"
        disabled={off}
        onChange={(value) => {
          c.grass({ bladesPerSquareCm: value });
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
