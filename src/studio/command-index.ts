/*
 * Command palette index (C-09). Every value row the section builders emit for the current state is
 * a `parameter` command keyed by its row id (the control's DOM id); studio actions, preset places
 * and section jumps are `action` commands; searched places become `location` commands. Rebuilt from
 * state on each change, so every `apply` closes over the latest row callback.
 */
import { realTerrainPresets } from '../constants/real-terrain';
import { resetDesignStyle } from '../design-settings';
import type { PlaceMatch } from '../place-search';
import type { CommandQuickValue, CommandResult } from '../ui/command-palette';
import type { Result } from '../types/operations';
import { controlGroupBuilders } from './control-groups';
import {
  getHiddenSections,
  type InspectorSection,
  type StudioController,
  type StudioState,
} from './controller';
import { describeValueControls, type ValueRowKind } from './command-values';
import { formatMapLocation } from './hud-readouts';
import { drawRoute, exportRouteGpx } from './route-actions';
import { isRouteComplete } from './route-editing';
import { getGroupCode, getSectionForGroup, studioSections } from './sections';

export interface ParameterCommand extends CommandResult {
  kind: 'parameter';
  groupId: string;
  code: string;
  sectionId: InspectorSection;
  rowKind: ValueRowKind;
  /** Formatted current value; also the result's `detail`. */
  current: string;
  quickValues: readonly CommandQuickValue[];
  /** Applies through the row's own `onChange`. */
  apply: (value: string) => Result<void>;
}

export interface ActionCommand extends CommandResult {
  kind: 'action';
  sectionId?: InspectorSection;
  run: () => void;
}

export interface LocationCommand extends CommandResult {
  kind: 'location';
  match: PlaceMatch;
  /** "56.7969°N 5.0035°W". */
  coordinates: string;
}

export type StudioCommand = ParameterCommand | ActionCommand | LocationCommand;

// === PUBLIC API ===

/** Parameters in builder order, then actions: view, panels, style, presets, sections. */
export function buildCommandIndex(
  controller: StudioController,
  state: StudioState,
): StudioCommand[] {
  return [...buildParameterCommands(controller, state), ...buildActionCommands(controller, state)];
}

/** Value controls in the groups visible for `state` (3D-only sections drop out in 2D). */
export function buildParameterCommands(
  controller: StudioController,
  state: StudioState,
): ParameterCommand[] {
  return controlGroupBuilders.flatMap((build) =>
    build(controller, state)
      .filter((group) => isSectionVisible(getSectionForGroup(group.id).id, state))
      .flatMap((group) => {
        const code = getGroupCode(group.id);
        const sectionId = getSectionForGroup(group.id).id;

        return group.rows.flatMap((row) =>
          row === false || row === undefined
            ? []
            : describeValueControls(row).map((control): ParameterCommand => ({
                ...control,
                kind: 'parameter',
                groupId: group.id,
                code,
                sectionId,
                detail: control.current,
              })),
        );
      }),
  );
}

export function buildLocationCommands(matches: readonly PlaceMatch[]): LocationCommand[] {
  return matches.map((match, index) => ({
    kind: 'location',
    id: `location-${String(index)}`,
    label: match.name,
    detail: match.detail === '' ? undefined : match.detail,
    match,
    coordinates: formatMapLocation({ kind: 'geographic', ...match }).join(' '),
  }));
}

// === ACTIONS ===

function buildActionCommands(controller: StudioController, state: StudioState): ActionCommand[] {
  const { workspace } = state;
  const otherView = workspace.view === '2d' ? '3d' : '2d';
  const actions: ActionCommand[] = [
    {
      kind: 'action',
      id: 'action-view',
      label: `Switch to ${otherView.toUpperCase()} view`,
      run: () => void controller.selectView(otherView),
    },
    {
      kind: 'action',
      id: 'action-export',
      label: 'Open export',
      run: () => {
        controller.workspace({ exporting: true });
      },
    },
    {
      kind: 'action',
      id: 'action-overlays',
      label: 'Open overlays',
      sectionId: 'Overlays',
      run: () => {
        controller.selectSection('Overlays');
      },
    },
    {
      kind: 'action',
      id: 'action-inspector',
      label: workspace.collapsed ? 'Show inspector' : 'Hide inspector',
      run: () => {
        controller.workspace({ collapsed: !workspace.collapsed });
      },
    },
    {
      kind: 'action',
      id: 'action-reset-style',
      label: 'Reset design style',
      sectionId: 'Colour',
      run: () => {
        controller.design(resetDesignStyle(state.design));
      },
    },
    {
      kind: 'action',
      id: 'action-copy-link',
      label: 'Copy style link',
      run: () => void controller.copyLink(),
    },
  ];

  if (state.source.terrain !== undefined) {
    actions.push(...buildRouteCommands(controller, state));
  }

  if (!state.seedLocked) {
    actions.push({
      kind: 'action',
      id: 'action-new-landscape',
      label: 'New landscape',
      sectionId: 'Terrain',
      run: () => {
        controller.newLandscape();
      },
    });
  }

  return [
    ...actions,
    ...realTerrainPresets.map((preset, index): ActionCommand => ({
      kind: 'action',
      id: `action-place-${String(index)}`,
      label: `Load ${preset.name}`,
      detail: preset.country,
      sectionId: 'Terrain',
      run: () => {
        void controller.autoplay({ enabled: false });
        controller.source({
          place: `${String(preset.latitude)},${String(preset.longitude)}`,
          latitude: preset.latitude,
          longitude: preset.longitude,
          spanKm: preset.spanKm,
        });
        controller.selectSection('Terrain');
        void controller.loadTerrain();
      },
    })),
    ...studioSections
      .filter((section) => isSectionVisible(section.id, state))
      .map((section): ActionCommand => ({
        kind: 'action',
        id: `action-section-${section.id.toLowerCase()}`,
        label: `Go to ${section.title}`,
        code: section.code,
        sectionId: section.id,
        run: () => {
          controller.selectSection(section.id);
        },
      })),
  ];
}

// === HELPERS ===

/** Route commands exist only on real terrain; the ones that need a route wait for one. */
function buildRouteCommands(controller: StudioController, state: StudioState): ActionCommand[] {
  const { route } = state.workspace;
  const isEditing = route !== null && route.editing.mode !== 'viewing';
  const commands: ActionCommand[] = [
    {
      kind: 'action',
      id: 'action-route-tool',
      label: 'Route tool',
      detail: 'R',
      run: () => {
        controller.workspace({ toolMode: state.workspace.toolMode === 'route' ? 'none' : 'route' });
      },
    },
    {
      kind: 'action',
      id: 'action-route-draw',
      label: 'Draw route',
      run: () => {
        drawRoute(controller);
      },
    },
  ];

  if (isEditing) {
    commands.push({
      kind: 'action',
      id: 'action-route-finish',
      label: 'Finish route',
      run: () => {
        controller.finishRoute();
      },
    });
  }

  if (route !== null) {
    commands.push(
      {
        kind: 'action',
        id: 'action-route-reverse',
        label: 'Reverse route',
        run: () => {
          controller.reverseRoute();
        },
      },
      {
        kind: 'action',
        id: 'action-route-clear',
        label: 'Clear route',
        run: () => {
          controller.clearRoute();
        },
      },
    );
  }

  if (route !== null && isRouteComplete(route.active)) {
    commands.push({
      kind: 'action',
      id: 'action-route-export',
      label: 'Export route GPX',
      run: () => {
        exportRouteGpx(controller, state);
      },
    });
  }

  return commands;
}

function isSectionVisible(sectionId: InspectorSection, state: StudioState): boolean {
  return !getHiddenSections(state).includes(sectionId);
}
