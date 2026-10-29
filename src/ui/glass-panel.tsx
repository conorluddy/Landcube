import type { ReactNode } from 'react';

export type GlassPanelElement = 'div' | 'aside' | 'section';
export type GlassPanelPadding = 'none' | 'default';

export interface GlassPanelProps {
  as?: GlassPanelElement;
  id?: string;
  /** Accessible name; an `aside` or `section` with a name becomes a landmark or region. */
  label?: string;
  /** 'default' pads 18px for free-standing cards; 'none' when the content lays out its own edges. */
  padding?: GlassPanelPadding;
  className?: string;
  /** Variant and state hooks for the caller's CSS, e.g. `{ 'data-collapsed': 'true' }`. */
  dataAttributes?: Readonly<Record<`data-${string}`, string | undefined>>;
  children: ReactNode;
}

/** A frosted-glass container (panel alpha, hairline edge, panel shadow) for panels and popovers. */
export function GlassPanel({
  as: Element = 'div',
  id,
  label,
  padding = 'default',
  className,
  dataAttributes,
  children,
}: GlassPanelProps): React.JSX.Element {
  return (
    <Element
      {...dataAttributes}
      id={id}
      className={
        className === undefined ? 'lc-glass-panel lc-glass' : `lc-glass-panel lc-glass ${className}`
      }
      data-padding={padding}
      data-ui-surface
      aria-label={label}
    >
      {children}
    </Element>
  );
}
