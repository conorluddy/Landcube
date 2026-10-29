/*
 * Terrain section (TERR.01 to TERR.03): autoplay and daylight, plus either the procedural seed
 * controls or the real-location search and coordinates, whichever matches the terrain source.
 * Row ids are the legacy field ids the e2e tests bind to. The pattern is in ./README.md.
 */
import { createElement } from 'react';
import {
  realTerrainPresetGroups,
  realTerrainPresets,
  realTerrainSpanStopsKm,
} from '../../constants/real-terrain';
import type { ControlGroupDefinition } from '../../ui/control-rows';
import type { SelectOption } from '../../ui/select';
import type { StudioController, StudioState } from '../controller';
import {
  buttonRow,
  customRow,
  designRangeRow,
  hintRow,
  numberRow,
  selectRow,
  statusRow,
  toggleRow,
} from '../control-rows';
import { EmptyState } from '../../ui/empty-state';
import { PlaceSearchField } from '../place-search-field';

// === PUBLIC API ===

export function buildTerrainGroups(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition[] {
  return [
    buildAutoplayGroup(controller, state),
    state.source.selected === 'generated'
      ? buildProceduralLandscapeGroup(controller, state)
      : buildRealLocationGroup(controller, state),
  ];
}

// === GROUPS ===

function buildAutoplayGroup(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition {
  const { autoplay } = state.source;
  const { daylightCycle } = state.scene;

  return {
    id: 'autoplay',
    title: 'Autoplay',
    rows: [
      toggleRow('autoplay-enabled', {
        label: 'Tour preset locations',
        value: autoplay.enabled,
        onChange: (isEnabled) => {
          void controller.autoplay({ enabled: isEnabled });
        },
      }),
      autoplay.enabled && {
        kind: 'range',
        id: 'autoplay-delay',
        label: 'Delay',
        value: autoplay.delaySeconds,
        min: 5,
        max: 60,
        step: 1,
        unit: ' s',
        onChange: (delaySeconds) => {
          void controller.autoplay({ delaySeconds });
        },
      },
      toggleRow('daylight-cycle-enabled', {
        label: 'Cycle daylight',
        value: daylightCycle.enabled,
        onChange: (isEnabled) => {
          controller.daylightCycle({ enabled: isEnabled });
        },
      }),
      daylightCycle.enabled && {
        kind: 'range',
        id: 'daylight-day-length',
        label: 'Day length',
        value: daylightCycle.daySeconds,
        min: 30,
        max: 180,
        step: 5,
        unit: ' s',
        onChange: (daySeconds) => {
          controller.daylightCycle({ daySeconds });
        },
      },
    ],
  };
}

function buildProceduralLandscapeGroup(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition {
  return {
    id: 'procedural-landscape',
    title: 'Procedural landscape',
    isPinnable: true,
    rows: [
      hintRow('seed-readout', [
        'Seed ',
        createElement('output', { key: 'seed', id: 'seed-value' }, state.design.seed),
      ]),
      toggleRow('lock-seed', {
        label: 'Lock seed',
        value: state.seedLocked,
        onChange: (isLocked) => {
          controller.lockSeed(isLocked);
        },
      }),
      buttonRow('new-landscape', {
        variant: 'primary',
        disabled: state.seedLocked,
        children: 'New landscape',
        onClick: () => {
          controller.newLandscape();
        },
      }),
      designRangeRow(controller, state, 'featureScale', 'Feature scale', ' px'),
      designRangeRow(controller, state, 'detail', 'Terrain detail'),
    ],
  };
}

function buildRealLocationGroup(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition {
  const { source } = state;

  return {
    id: 'real-location',
    title: 'Real location',
    rows: [
      customRow('terrain-place-search', () =>
        createElement(
          'div',
          { className: 'sidebar-place-search' },
          createElement(PlaceSearchField, { controller }),
        ),
      ),
      selectRow('terrain-place', {
        label: 'Location',
        value: source.place,
        options: listPlaceOptions(state),
        isPositionShown: false,
        onChange: (place) => {
          selectPlace(controller, state, place);
        },
      }),
      {
        kind: 'pair',
        id: 'terrain-coordinates',
        fields: [
          {
            kind: 'number',
            id: 'terrain-latitude',
            label: 'Latitude',
            value: source.latitude,
            min: -85,
            max: 85,
            onChange: (latitude) => {
              controller.source({ latitude });
            },
          },
          {
            kind: 'number',
            id: 'terrain-longitude',
            label: 'Longitude',
            value: source.longitude,
            min: -180,
            max: 180,
            onChange: (longitude) => {
              controller.source({ longitude });
            },
          },
        ],
      },
      {
        kind: 'range',
        id: 'terrain-span',
        label: 'Area span',
        value: getNearestSpanStopIndex(source.spanKm),
        min: 0,
        max: realTerrainSpanStopsKm.length - 1,
        step: 1,
        displayValue: `${source.spanKm} km`,
        onChange: (index) => {
          controller.source({ spanKm: realTerrainSpanStopsKm[index] });
        },
      },
      numberRow('terrain-max-depth', {
        label: 'Maximum depth below sea level (m)',
        value: source.maxDepth,
        min: 0,
        max: 11000,
        onChange: (maxDepth) => {
          controller.source({ maxDepth });
        },
      }),
      numberRow('terrain-elevation-floor', {
        label: 'Elevation floor (m, optional)',
        isOptional: true,
        value: source.elevationFloor,
        min: -11000,
        max: 8900,
        onChange: (elevationFloor) => {
          controller.source({ elevationFloor });
        },
      }),
      hintRow(
        'terrain-elevation-hint',
        'Elevation filters reduce coastal source artifacts; they do not trace a shoreline.',
      ),
      buttonRow('load-terrain', {
        variant: 'primary',
        disabled: source.loading,
        children: source.loading ? 'Loading terrain…' : 'Load terrain',
        onClick: () => {
          void controller.loadTerrain();
        },
      }),
      source.selected === 'real' &&
        !source.terrain &&
        !source.loading &&
        customRow('terrain-empty', () =>
          createElement(
            EmptyState,
            { glyph: '◇', title: 'No terrain loaded' },
            'Choose a place or enter coordinates, then load terrain.',
          ),
        ),
      statusRow('terrain-status', {
        kind: 'info',
        isAlwaysMounted: true,
        children: source.status,
      }),
      hintRow('terrain-session-hint', 'Locations are session-only and excluded from style links.'),
      source.terrain && hintRow('terrain-attribution', source.terrain.attribution),
      {
        kind: 'link',
        id: 'terrain-sources-link',
        label: 'Terrain data sources & attribution',
        href: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
        isExternal: true,
      },
    ],
  };
}

// === HELPERS ===

function formatPlaceValue(place: { latitude: number; longitude: number }): string {
  return `${place.latitude},${place.longitude}`;
}

function listPlaceOptions(state: StudioState): SelectOption<string>[] {
  return [
    ...(state.savedPlaces.length > 0
      ? [
          {
            group: 'Searched',
            options: state.savedPlaces.map((place) => ({
              value: formatPlaceValue(place),
              label: place.name,
            })),
          },
        ]
      : []),
    ...realTerrainPresetGroups.map((group) => ({
      group: group.country,
      options: group.locations.map((place) => ({
        value: formatPlaceValue(place),
        label: place.name,
      })),
    })),
  ];
}

function selectPlace(controller: StudioController, state: StudioState, place: string): void {
  const searched = state.savedPlaces.find((candidate) => formatPlaceValue(candidate) === place);
  const preset = realTerrainPresets.find((candidate) => formatPlaceValue(candidate) === place);

  // Searched places keep the current span; they were found by name, not framed.
  if (searched) {
    controller.source({ place, latitude: searched.latitude, longitude: searched.longitude });
  } else if (preset) {
    controller.source({
      place,
      latitude: preset.latitude,
      longitude: preset.longitude,
      spanKm: preset.spanKm,
    });
  }
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
