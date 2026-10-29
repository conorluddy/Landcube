import type { ReactNode, Ref } from 'react';

export interface IconButtonProps {
  /** Decorative glyph; `label` is the accessible name. */
  glyph: ReactNode;
  label: string;
  /** Toggle state; sets aria-pressed. Omit for a plain action button. */
  isActive?: boolean;
  onClick: () => void;
  disabled?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** 44px square glass button for map and sheet controls (P-04). */
export function IconButton({
  glyph,
  label,
  isActive,
  onClick,
  disabled = false,
  ref,
}: IconButtonProps): React.JSX.Element {
  return (
    <button
      ref={ref}
      type="button"
      className="lc-icon-button lc-glass"
      data-ui-surface
      aria-label={label}
      aria-pressed={isActive}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="lc-icon-button__glyph" aria-hidden="true">
        {glyph}
      </span>
    </button>
  );
}
