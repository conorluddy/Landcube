import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ControlGroup } from './control-group';
import type { ControlGroupDefinition } from './control-rows';
import { GlassPanel } from './glass-panel';
import { GroupHeader } from './group-header';
import { IconButton } from './icon-button';
import type { PanelPosition } from './layout-manager';

export interface DetachablePanelProps {
  group: ControlGroupDefinition;
  /** Group code such as 'CONT.01'. */
  code?: string;
  /** Top-left corner in the layer's coordinates. */
  position: PanelPosition;
  /** Requested position; the LayoutManager snaps and clamps it. */
  onMove: (position: PanelPosition) => void;
  onDock: () => void;
  zIndex: number;
  /** Pointer or focus entered the panel: raise it above the others. */
  onFocus: () => void;
  /** Dialog name; defaults to "{title} (pinned)". */
  label?: string;
}

const keyboardStepPx = 12;
const keyboardLargeStepPx = 48;
const arrowDirections: Readonly<Record<string, PanelPosition>> = {
  ArrowLeft: { xPx: -1, yPx: 0 },
  ArrowRight: { xPx: 1, yPx: 0 },
  ArrowUp: { xPx: 0, yPx: -1 },
  ArrowDown: { xPx: 0, yPx: 1 },
};

interface DragOrigin {
  pointerId: number;
  clientX: number;
  clientY: number;
  position: PanelPosition;
}

/**
 * A control group floating on glass (C-08). The header is the drag handle: pointer drag or, when
 * focused, arrows move 12px (Shift 48px). Escape anywhere in the panel docks it.
 */
export function DetachablePanel({
  group,
  code,
  position,
  onMove,
  onDock,
  zIndex,
  onFocus,
  label = `${group.title} (pinned)`,
}: DetachablePanelProps): React.JSX.Element {
  const dragOrigin = useRef<DragOrigin | undefined>(undefined);
  const [isDragging, setIsDragging] = useState(false);

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as Element).closest('button') !== null) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragOrigin.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      position,
    };
    setIsDragging(true);
  };

  const drag = (event: PointerEvent<HTMLDivElement>) => {
    const origin = dragOrigin.current;

    if (origin?.pointerId !== event.pointerId) {
      return;
    }

    onMove({
      xPx: origin.position.xPx + event.clientX - origin.clientX,
      yPx: origin.position.yPx + event.clientY - origin.clientY,
    });
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragOrigin.current?.pointerId !== event.pointerId) {
      return;
    }

    drag(event);
    dragOrigin.current = undefined;
    setIsDragging(false);
  };

  const moveByKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = arrowDirections[event.key] as PanelPosition | undefined;

    if (direction === undefined || event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();

    const stepPx = event.shiftKey ? keyboardLargeStepPx : keyboardStepPx;

    onMove({
      xPx: position.xPx + direction.xPx * stepPx,
      yPx: position.yPx + direction.yPx * stepPx,
    });
  };

  return (
    <section
      className="lc-detachable-panel"
      role="dialog"
      aria-label={label}
      data-ui-surface
      data-pinned-group-id={group.id}
      data-dragging={isDragging ? 'true' : undefined}
      style={{ left: position.xPx, top: position.yPx, zIndex }}
      onPointerDownCapture={onFocus}
      onFocus={onFocus}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onDock();
        }
      }}
    >
      <GlassPanel padding="none" className="lc-detachable-panel__glass">
        <div
          className="lc-detachable-panel__handle"
          role="group"
          aria-roledescription="drag handle"
          aria-label={`Move ${group.title}`}
          aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Shift+ArrowUp Shift+ArrowDown Shift+ArrowLeft Shift+ArrowRight Escape"
          tabIndex={0}
          onPointerDown={startDrag}
          onPointerMove={drag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={moveByKeyboard}
        >
          <GroupHeader
            title={group.title}
            code={code}
            trailing={<IconButton glyph="⇲" label={`Dock ${group.title}`} onClick={onDock} />}
          />
        </div>
        <div className="lc-detachable-panel__body">
          <ControlGroup group={group} code={code} />
        </div>
      </GlassPanel>
    </section>
  );
}
