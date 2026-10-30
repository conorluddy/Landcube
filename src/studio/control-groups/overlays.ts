/*
 * Overlays popover groups: decorative grid and summit markers (2D); geographic decorations and
 * roads (3D); sea level and the GPX route (real terrain, both views). They register under SCEN (SCEN.07 to SCEN.12)
 * but render in the footer popover, not the Scene inspector; see ./scene.ts for the rest.
 */
import { summitMarkerSizes } from '../../constants/design';
import { floorStyles } from '../../terrain-floor-styles';
import type { ControlGroupDefinition } from '../../ui/control-rows';
import type { StudioController, StudioState } from '../controller';
import { designRangeRow, hintRow, selectRow, toggleRow } from '../control-rows';
import { buildRoadsGroup } from './scene-roads';
import { buildRouteGroup } from './scene-route';

// === PUBLIC API ===

export function buildOverlayPopoverGroups(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition[] {
  const viewGroups =
    state.workspace.view === '2d'
      ? [buildDecorativeGridGroup(controller, state), buildSummitMarkersGroup(controller, state)]
      : [buildGeographicDecorationsGroup(controller, state), buildRoadsGroup(controller, state)];

  const { terrain } = state.source;

  return terrain
    ? [
        ...viewGroups,
        buildSeaLevelGroup(controller, state),
        buildRouteGroup(controller, state, terrain),
      ]
    : viewGroups;
}

// === GROUPS ===

function buildDecorativeGridGroup(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition {
  return {
    id: 'decorative-grid',
    title: 'Decorative grid',
    rows: [
      selectRow('gridStyle', {
        label: 'Grid style',
        value: state.design.gridStyle,
        options: ['off', 'squares', 'crosses'],
        onChange: (gridStyle) => {
          controller.design({ gridStyle });
        },
      }),
      designRangeRow(controller, state, 'gridSpacing', 'Spacing', ' px'),
      designRangeRow(controller, state, 'gridOpacity', 'Grid opacity'),
      hintRow('decorative-grid-hint', 'Pixel-spaced grid included in 2D artwork.'),
    ],
  };
}

function buildSummitMarkersGroup(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition {
  return {
    id: 'summit-markers',
    title: 'Summit markers',
    rows: [
      selectRow('summitMarkerSize', {
        label: 'Marker size',
        value: state.design.summitMarkerSize,
        options: summitMarkerSizes,
        onChange: (summitMarkerSize) => {
          controller.design({ summitMarkerSize });
        },
      }),
      toggleRow('summit-triangles', {
        label: 'Triangles',
        value: state.design.summitTrianglesEnabled,
        onChange: (summitTrianglesEnabled) => {
          controller.design({ summitTrianglesEnabled });
        },
      }),
      toggleRow('summit-crosses', {
        label: 'Crosses',
        value: state.design.summitCrossesEnabled,
        onChange: (summitCrossesEnabled) => {
          controller.design({ summitCrossesEnabled });
        },
      }),
    ],
  };
}

function buildGeographicDecorationsGroup(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition {
  const { scene, source } = state;
  const isMapGridAvailable = Boolean(source.terrain && scene.ground && scene.base && scene.surface);

  return {
    id: 'geographic-decorations',
    title: 'Geographic decorations',
    rows: [
      toggleRow('scene-map-grid', {
        label: 'Map grid',
        value: scene.mapGrid,
        disabled: !isMapGridAvailable,
        onChange: (mapGrid) => {
          controller.scene({ mapGrid });
        },
      }),
      selectRow<string>('floorStyle', {
        label: 'Floor style',
        value: scene.floorStyle,
        options: Object.entries(floorStyles).map(([value, { label }]) => ({ value, label })),
        disabled: !isMapGridAvailable || !scene.mapGrid,
        onChange: (floorStyle) => {
          controller.scene({ floorStyle: floorStyle as typeof scene.floorStyle });
        },
      }),
      hintRow(
        'geographic-decorations-hint',
        'Map grid and floor styles require a real location, studio floor and solid base. Each floor style draws its own north marker. Omitted from STL.',
      ),
    ],
  };
}

function buildSeaLevelGroup(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition {
  return {
    id: 'sea-level',
    title: 'Sea level',
    rows: [
      toggleRow('sea-level-hatching', {
        label: 'Sea-level hatching',
        value: state.source.hatching,
        onChange: (isHatched) => {
          controller.hatching(isHatched);
        },
      }),
      hintRow(
        'sea-level-hint',
        'Marks elevations at or below 0 m, including 2D exports and the 3D hatched water treatment. Session-only.',
      ),
    ],
  };
}
