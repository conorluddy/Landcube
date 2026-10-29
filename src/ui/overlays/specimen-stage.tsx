import type { ReactNode } from 'react';

/** Specimens only: a positioned stand-in for the canvas, so full-bleed overlays have a box. */
export function SpecimenStage({
  tone,
  heightPx,
  children,
}: {
  tone: 'light' | 'dark';
  heightPx: number;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        position: 'relative',
        height: heightPx,
        overflow: 'hidden',
        background: tone === 'light' ? 'var(--lc-ink-7)' : 'var(--lc-ink-2)',
      }}
    >
      {children}
    </div>
  );
}
