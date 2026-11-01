/*
 * Phone sheet shortcuts: the buttons that join the map controls column once the control sheet is
 * closed. Each opens the sheet full on a section and lands focus in one control group, so a
 * closed sheet still has one-tap routes to the controls people reach for most. Export keeps the
 * peek row's action reachable while that row is hidden.
 */
import { getHiddenSections, type InspectorSection, type StudioState } from './controller';
import type { ControlGroupId } from './sections';

export type GroupShortcutId = 'terrain' | 'contours' | 'colour' | 'camera';

export interface GroupShortcut {
  kind: 'group';
  id: GroupShortcutId;
  glyph: string;
  label: string;
  sectionId: InspectorSection;
  groupId: ControlGroupId;
}

export interface ExportShortcut {
  kind: 'export';
  id: 'export';
  glyph: string;
  label: string;
}

export type SheetShortcut = GroupShortcut | ExportShortcut;

/** `requestAnimationFrame` and `cancelAnimationFrame`, injectable for tests. */
export interface FrameScheduler {
  request: (callback: () => void) => number;
  cancel: (handle: number) => void;
}

export interface RevealPoller {
  /** Runs `attempt` once a frame until it returns true or the budget runs out, then `onGiveUp`. */
  schedule: (attempt: () => boolean, onGiveUp: () => void) => void;
  cancel: () => void;
}

/** Frames to wait for a newly selected section to lay out before giving up on the reveal. */
export const revealFrameBudget = 5;

// === PUBLIC API ===

/**
 * Terrain (the landscape source), Contours, Colour, Camera (3D only) and Export, in sheet order.
 * A shortcut into a hidden section drops out rather than rendering a dead button.
 */
export function describeSheetShortcuts(
  state: Pick<StudioState, 'workspace' | 'source'>,
): SheetShortcut[] {
  const hiddenSections = getHiddenSections(state);
  const isRealTerrain = state.source.terrain !== undefined;
  const groups: GroupShortcut[] = [
    {
      kind: 'group',
      id: 'terrain',
      glyph: '▲',
      label: 'Terrain controls',
      sectionId: 'Terrain',
      groupId: isRealTerrain ? 'real-location' : 'procedural-landscape',
    },
    {
      kind: 'group',
      id: 'contours',
      glyph: '≋',
      label: 'Contour controls',
      sectionId: 'Contours',
      groupId: 'contour-density',
    },
    {
      kind: 'group',
      id: 'colour',
      glyph: '◐',
      label: 'Colour controls',
      sectionId: 'Colour',
      groupId: 'palette',
    },
    {
      kind: 'group',
      id: 'camera',
      glyph: '◎',
      label: 'Camera controls',
      sectionId: 'Camera',
      groupId: 'lens',
    },
  ];

  return [
    ...groups.filter((shortcut) => !hiddenSections.includes(shortcut.sectionId)),
    { kind: 'export', id: 'export', glyph: '↗', label: 'Export' },
  ];
}

/**
 * Scrolls the group to the top of the sheet body and focuses its first control. Text entry is
 * skipped so a shortcut never raises the phone keyboard; a group with nothing else focusable
 * takes focus itself, which announces its title.
 */
export function revealControlGroup(root: ParentNode, groupId: string): boolean {
  const group = root.querySelector<HTMLElement>(`[data-group-id="${groupId}"]`);

  if (group === null) {
    return false;
  }

  group.scrollIntoView({ block: 'start' });

  const control = findFirstTapControl(group);

  if (control === null) {
    group.tabIndex = -1;
    group.focus({ preventScroll: true });
  } else {
    control.focus({ preventScroll: true });
  }

  return true;
}

/**
 * A poller for one pending reveal: a section mounts on a later frame than the tap, so the reveal
 * retries for `frameBudget` frames. Scheduling again, or cancelling, drops the pending attempt.
 */
export function createRevealPoller(
  frames: FrameScheduler,
  frameBudget = revealFrameBudget,
): RevealPoller {
  let pending: number | undefined;

  const cancel = () => {
    if (pending !== undefined) {
      frames.cancel(pending);
      pending = undefined;
    }
  };

  return {
    cancel,
    schedule(attempt, onGiveUp) {
      cancel();

      let framesLeft = frameBudget;

      const tick = () => {
        pending = undefined;

        if (attempt()) {
          return;
        }

        framesLeft -= 1;

        if (framesLeft > 0) {
          pending = frames.request(tick);
        } else {
          onGiveUp();
        }
      };

      pending = frames.request(tick);
    },
  };
}

// === HELPERS ===

const tapControlSelector = 'button, select, input, [role="button"], [tabindex]';
const textEntryTypes = new Set(['text', 'number', 'search', 'email', 'url', 'tel', 'password']);

function findFirstTapControl(group: HTMLElement): HTMLElement | null {
  for (const candidate of group.querySelectorAll<HTMLElement>(tapControlSelector)) {
    const isDisabled = candidate instanceof HTMLButtonElement && candidate.disabled;
    const isTextEntry = candidate instanceof HTMLInputElement && textEntryTypes.has(candidate.type);

    if (!isDisabled && !isTextEntry && candidate.tabIndex >= 0) {
      return candidate;
    }
  }

  return null;
}
