import type { ReactNode } from 'react';

export interface ListRowProps {
  title: string;
  /** Mono line under the title. */
  detail?: string;
  /** Trailing value in mono. Empty string renders an em dash. */
  meta?: string;
  /** 28px tile before the title, usually a glyph. Decorative. */
  leading?: ReactNode;
  /** Replaces `meta` and the default chevron. */
  trailing?: ReactNode;
  /** Makes the row a button. */
  onClick?: () => void;
  /** Makes the row a link; wins over `onClick`. */
  href?: string;
}

/** Mobile list row (C-10): 56px with a hairline. A button, a link or a static row by props. */
export function ListRow({
  title,
  detail,
  meta,
  leading,
  trailing,
  onClick,
  href,
}: ListRowProps): React.JSX.Element {
  const isInteractive = href !== undefined || onClick !== undefined;
  const content = (
    <>
      {leading === undefined ? null : (
        <span className="lc-list-row__leading" aria-hidden="true">
          {leading}
        </span>
      )}
      <span className="lc-list-row__text">
        <span className="lc-list-row__title">{title}</span>
        {detail === undefined ? null : <span className="lc-list-row__detail">{detail}</span>}
      </span>
      {trailing ?? (
        <>
          {meta === undefined ? null : (
            <span className="lc-list-row__meta">{meta === '' ? '—' : meta}</span>
          )}
          {isInteractive ? (
            <span className="lc-list-row__chevron" aria-hidden="true">
              ›
            </span>
          ) : null}
        </>
      )}
    </>
  );

  if (href !== undefined) {
    return (
      <a className="lc-list-row" href={href}>
        {content}
      </a>
    );
  }

  if (onClick !== undefined) {
    return (
      <button className="lc-list-row" type="button" onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className="lc-list-row">{content}</div>;
}
