import type { ReactNode } from 'react';
import { BrandLockup } from '../../ui/brand-lockup';
import { Button } from '../../ui/button';

/** Phone launch screen: the splash lockup over a grid field, anchored bottom-left, with one primary action. */
export function SplashPage({ onEnter }: { onEnter: () => void }): ReactNode {
  return (
    <section className="studio-splash" aria-label="Welcome">
      <BrandLockup context="Studio" size="splash" />
      <p className="studio-splash__tagline">Any landscape, on your desk.</p>
      <Button variant="primary" size="extraLarge" trailingGlyph="→" isFullWidth onClick={onEnter}>
        Enter studio
      </Button>
    </section>
  );
}
