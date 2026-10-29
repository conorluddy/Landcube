import type { AriaAttributes, ReactNode, Ref } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'text';
export type ButtonSize = 'small' | 'medium' | 'large' | 'extraLarge';

export interface ButtonProps extends AriaAttributes {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  /** Arrow-style glyph after the label (→ ↗ ↓ ↵). Decorative. */
  trailingGlyph?: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  /** Sets aria-busy; the label stays visible. */
  isBusy?: boolean;
  isFullWidth?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** Primary, secondary and text buttons (P-01, P-02, P-03). Never wraps. */
export function Button({
  variant = 'secondary',
  size = 'medium',
  children,
  trailingGlyph,
  onClick,
  type = 'button',
  disabled = false,
  isBusy = false,
  isFullWidth = false,
  ref,
  ...ariaAttributes
}: ButtonProps): React.JSX.Element {
  return (
    <button
      {...ariaAttributes}
      ref={ref}
      type={type}
      className="lc-button"
      data-variant={variant}
      data-size={size}
      data-full-width={isFullWidth ? 'true' : undefined}
      disabled={disabled}
      aria-busy={isBusy ? true : undefined}
      onClick={onClick}
    >
      <span className="lc-button__label">{children}</span>
      {trailingGlyph === undefined ? null : (
        <span className="lc-button__glyph" aria-hidden="true">
          {trailingGlyph}
        </span>
      )}
    </button>
  );
}
