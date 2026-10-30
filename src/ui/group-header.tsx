import type { ReactNode } from 'react';

export interface GroupHeaderProps {
  title: string;
  /** Group code such as 'CONT.03'. Decorative, so fieldset names stay the plain title. */
  code?: string;
  trailing?: ReactNode;
}

/** Caps group title with code, hairline rule and optional trailing slot (P-19). */
export function GroupHeader({ title, code, trailing }: GroupHeaderProps): React.JSX.Element {
  return (
    <div className="lc-group-header">
      {code === undefined ? null : (
        <span className="lc-group-header__code" aria-hidden="true">
          {code}
        </span>
      )}
      <span className="lc-group-header__title">{title}</span>
      <span className="lc-group-header__rule" aria-hidden="true" />
      {trailing === undefined ? null : (
        <span className="lc-group-header__trailing">{trailing}</span>
      )}
    </div>
  );
}
