export type BrandLockupSize = 'bar' | 'splash';

export interface BrandLockupProps {
  /** Product area shown under the wordmark, e.g. 'Studio'. */
  context: string;
  size?: BrandLockupSize;
  /** Renders an h1 when true, a paragraph otherwise. */
  isHeading?: boolean;
}

/** Glyph, LANDCU.BE wordmark and context line (P-22). Accessible name: "LANDCU.BE {context}". */
export function BrandLockup({
  context,
  size = 'bar',
  isHeading = true,
}: BrandLockupProps): React.JSX.Element {
  const Element = isHeading ? 'h1' : 'p';

  return (
    <Element className="lc-brand-lockup" data-size={size}>
      <span className="lc-brand-lockup__glyph" aria-hidden="true">
        ≋
      </span>
      <span className="lc-brand-lockup__text">
        <span className="lc-brand-lockup__wordmark">LANDCU.BE</span>{' '}
        <span className="lc-brand-lockup__context">{context}</span>
      </span>
    </Element>
  );
}
