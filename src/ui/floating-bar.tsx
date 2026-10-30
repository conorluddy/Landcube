import type { ReactNode } from 'react';

export type FloatingBarElement = 'header' | 'footer' | 'div';
/** Pill heights: bar 40, footer 36, mobile 44. */
export type FloatingBarSize = 'bar' | 'footer' | 'mobile';
export type BarGroupRole = 'group' | 'toolbar';

export interface FloatingBarProps {
  as?: FloatingBarElement;
  size?: FloatingBarSize;
  className?: string;
  /** BarGroups, plus any primitive that is its own glass pill (Segmented on a glass bar, SearchField). */
  children: ReactNode;
}

export interface BarGroupProps {
  children?: ReactNode;
  /** A flexible gap that pushes later pills to the far edge; renders no pill. */
  isSpacer?: boolean;
  role?: BarGroupRole;
  /** Accessible name; give one whenever `role` is set. */
  label?: string;
  className?: string;
}

/**
 * A row of separate glass pills (C-01). The bar itself is transparent and lets pointer events
 * through its gaps, so the canvas stays draggable between pills.
 */
export function FloatingBar({
  as: Element = 'div',
  size = 'bar',
  className,
  children,
}: FloatingBarProps): React.JSX.Element {
  return (
    <Element
      className={joinClassNames('lc-floating-bar', className)}
      data-size={size}
      data-ui-surface
    >
      {children}
    </Element>
  );
}

/** One glass pill in a FloatingBar, or a spacer between pills. */
export function BarGroup({
  children,
  isSpacer = false,
  role,
  label,
  className,
}: BarGroupProps): React.JSX.Element {
  if (isSpacer) {
    return <div className="lc-bar-group" data-spacer aria-hidden="true" />;
  }

  return (
    <div
      className={joinClassNames('lc-bar-group lc-glass', className)}
      data-ui-surface
      role={role}
      aria-label={label}
    >
      {children}
    </div>
  );
}

// === HELPERS ===

function joinClassNames(base: string, extra: string | undefined): string {
  return extra === undefined ? base : `${base} ${extra}`;
}
