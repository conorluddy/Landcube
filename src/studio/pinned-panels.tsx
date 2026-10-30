import { useEffect, type ReactNode } from 'react';
import type { ControlGroupDefinition } from '../ui/control-rows';
import { LayoutManager, type PinnedPanel } from '../ui/layout-manager';
import { getHiddenSections, type StudioController, type StudioState } from './controller';
import { buildSectionGroups } from './control-groups';
import type { CropPreview } from './crop-preview';
import { getGroupCode, studioSections } from './sections';

/** 396px inspector or 92px rail, plus its 12px inset. */
const openInspectorReservePx = 408;
const collapsedInspectorReservePx = 104;

/**
 * Desktop pinned groups (#101). Each panel renders the definition its section builds in the
 * current state; a group the builders stop emitting (e.g. 3D-only after switching to 2D) docks.
 */
export function StudioPinnedPanels({
  controller,
  state,
  cropPreview,
}: {
  controller: StudioController;
  state: StudioState;
  cropPreview: CropPreview;
}): ReactNode {
  const { pinnedGroups, collapsed } = state.workspace;
  const visibleGroups =
    pinnedGroups.length === 0
      ? new Map<string, ControlGroupDefinition>()
      : collectVisibleGroups(controller, state, cropPreview);
  const panels: PinnedPanel[] = pinnedGroups.flatMap((pinned) => {
    const group = visibleGroups.get(pinned.id);

    return group === undefined ? [] : [{ ...pinned, group, code: getGroupCode(pinned.id) }];
  });
  const vanishedGroupIds = pinnedGroups
    .filter(({ id }) => !visibleGroups.has(id))
    .map(({ id }) => id)
    .join(' ');

  useEffect(() => {
    for (const id of vanishedGroupIds.split(' ').filter(Boolean)) {
      controller.dockGroup(id);
    }
  }, [controller, vanishedGroupIds]);

  return (
    <LayoutManager
      panels={panels}
      reservedRightPx={collapsed ? collapsedInspectorReservePx : openInspectorReservePx}
      onMove={controller.moveGroup}
      onDock={controller.dockGroup}
      onRaise={controller.raiseGroup}
    />
  );
}

function collectVisibleGroups(
  controller: StudioController,
  state: StudioState,
  cropPreview: CropPreview,
): Map<string, ControlGroupDefinition> {
  const hiddenSections = getHiddenSections(state);
  const visibleSections = studioSections.filter(({ id }) => !hiddenSections.includes(id));

  return new Map(
    visibleSections.flatMap(({ id }) =>
      buildSectionGroups(id, controller, state, cropPreview).map(
        (group) => [group.id, group] as const,
      ),
    ),
  );
}
