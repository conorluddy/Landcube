import type { ReactNode } from 'react';
import { Button } from './button';

export interface EmptyStateProps {
  /** Large decorative character above the title. */
  glyph?: string;
  title: string;
  children?: ReactNode;
  action?: { label: string; onClick: () => void };
}

/** Empty state (C-16): nothing to show yet, and what to do about it. Not a live region. */
export function EmptyState({ glyph, title, children, action }: EmptyStateProps): React.JSX.Element {
  return (
    <section className="lc-empty-state">
      {glyph !== undefined && (
        <span className="lc-empty-state__glyph" aria-hidden="true">
          {glyph}
        </span>
      )}
      <p className="lc-empty-state__title">{title}</p>
      {children !== undefined && <div className="lc-empty-state__body">{children}</div>}
      {action !== undefined && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </section>
  );
}
