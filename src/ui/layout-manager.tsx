/*
 * C-08 LayoutManager: floats pinned control groups over the studio as DetachablePanels.
 * Placement (position, z-order) is the caller's session state; this module only snaps, clamps
 * and re-clamps it on resize. Pure geometry helpers first, then the component.
 */
import { useEffect, useRef } from 'react';
import type { ControlGroupDefinition } from './control-rows';
import { DetachablePanel } from './detachable-panel';

export interface PanelPosition {
  xPx: number;
  yPx: number;
}

export interface PanelSize {
  widthPx: number;
  heightPx: number;
}

/** The rectangle a panel must stay inside, in layer coordinates. */
export interface PanelBounds {
  leftPx: number;
  topPx: number;
  rightPx: number;
  bottomPx: number;
}

/** Session-only placement of one pinned group. */
export interface PinnedGroupPlacement {
  id: string;
  position: PanelPosition;
  zIndex: number;
}

export interface PinnedPanel extends PinnedGroupPlacement {
  group: ControlGroupDefinition;
  code?: string;
}

export interface LayoutManagerProps {
  panels: readonly PinnedPanel[];
  /** Width kept clear on the right for the inspector, including its inset. */
  reservedRightPx: number;
  onMove: (id: string, position: PanelPosition) => void;
  onDock: (id: string) => void;
  onRaise: (id: string) => void;
}

export const panelGridPx = 12;
/** Pinned panels keep clear of the header and footer bars. */
const chromeBandPx = 60;
const edgeInsetPx = 12;
const cascadeOrigin: PanelPosition = { xPx: 24, yPx: 72 };
const cascadeStepPx = 24;

// === GEOMETRY ===

export function snapToGrid(position: PanelPosition, gridPx = panelGridPx): PanelPosition {
  return {
    xPx: Math.round(position.xPx / gridPx) * gridPx + 0,
    yPx: Math.round(position.yPx / gridPx) * gridPx + 0,
  };
}

/** Keeps the whole panel inside `bounds`; when it cannot fit, its top-left edge wins. */
export function clampToViewport(
  position: PanelPosition,
  size: PanelSize,
  bounds: PanelBounds,
): PanelPosition {
  return {
    xPx: Math.max(bounds.leftPx, Math.min(position.xPx, bounds.rightPx - size.widthPx)),
    yPx: Math.max(bounds.topPx, Math.min(position.yPx, bounds.bottomPx - size.heightPx)),
  };
}

/** One above the highest pinned panel, so the raised panel lands on top. */
export function nextZIndex(pinned: readonly PinnedGroupPlacement[]): number {
  return pinned.reduce((highest, { zIndex }) => Math.max(highest, zIndex), 0) + 1;
}

/** Where the n-th pinned panel first appears: a 24px cascade from the top-left. */
export function cascadePosition(index: number): PanelPosition {
  return {
    xPx: cascadeOrigin.xPx + index * cascadeStepPx,
    yPx: cascadeOrigin.yPx + index * cascadeStepPx,
  };
}

/** What the inspector shows in place of a pinned group, so its row ids stay unique. */
export function createPinnedPlaceholder(
  group: ControlGroupDefinition,
  onDock: () => void,
): ControlGroupDefinition {
  return {
    id: group.id,
    title: group.title,
    rows: [
      { kind: 'hint', id: `${group.id}-pinned`, children: `Pinned: ${group.title}` },
      { kind: 'button', id: `${group.id}-dock`, size: 'small', children: 'Dock', onClick: onDock },
    ],
  };
}

// === COMPONENT ===

export function LayoutManager({
  panels,
  reservedRightPx,
  onMove,
  onDock,
  onRaise,
}: LayoutManagerProps): React.JSX.Element {
  const layer = useRef<HTMLDivElement>(null);
  const latestPanels = useRef(panels);
  const knownPanelIds = useRef<readonly string[]>([]);

  latestPanels.current = panels;

  const constrain = (id: string, position: PanelPosition): PanelPosition => {
    const element = layer.current?.querySelector(`[data-pinned-group-id="${CSS.escape(id)}"]`);

    if (!layer.current || !element) {
      return snapToGrid(position);
    }

    const { width, height } = element.getBoundingClientRect();

    return clampToViewport(
      snapToGrid(position),
      { widthPx: width, heightPx: height },
      readBounds(layer.current, reservedRightPx),
    );
  };

  const latestConstrain = useRef(constrain);

  latestConstrain.current = constrain;

  // Re-clamp when the window or the space beside the inspector changes, and when a panel arrives.
  useEffect(() => {
    const reclampAll = () => {
      for (const panel of latestPanels.current) {
        const position = latestConstrain.current(panel.id, panel.position);

        if (position.xPx !== panel.position.xPx || position.yPx !== panel.position.yPx) {
          onMove(panel.id, position);
        }
      }
    };

    reclampAll();
    window.addEventListener('resize', reclampAll);

    return () => {
      window.removeEventListener('resize', reclampAll);
    };
  }, [onMove, reservedRightPx, panels.length]);

  // A freshly pinned panel takes focus so the keyboard can move or dock it straight away.
  useEffect(() => {
    const newPanelId = panels
      .map(({ id }) => id)
      .filter((id) => !knownPanelIds.current.includes(id))
      .at(-1);

    knownPanelIds.current = panels.map(({ id }) => id);

    if (newPanelId !== undefined) {
      layer.current
        ?.querySelector<HTMLElement>(
          `[data-pinned-group-id="${CSS.escape(newPanelId)}"] .lc-detachable-panel__handle`,
        )
        ?.focus();
    }
  }, [panels]);

  return (
    <div ref={layer} className="lc-layout-manager">
      {panels.map((panel) => (
        <DetachablePanel
          key={panel.id}
          group={panel.group}
          code={panel.code}
          position={panel.position}
          zIndex={panel.zIndex}
          onMove={(position) => {
            onMove(panel.id, constrain(panel.id, position));
          }}
          onDock={() => {
            onDock(panel.id);
          }}
          onFocus={() => {
            onRaise(panel.id);
          }}
        />
      ))}
    </div>
  );
}

// === HELPERS ===

function readBounds(layer: HTMLElement, reservedRightPx: number): PanelBounds {
  const { width, height } = layer.getBoundingClientRect();

  return {
    leftPx: edgeInsetPx,
    topPx: chromeBandPx,
    rightPx: width - reservedRightPx - edgeInsetPx,
    bottomPx: height - chromeBandPx,
  };
}
