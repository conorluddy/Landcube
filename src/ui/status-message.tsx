import type { ReactNode, Ref } from 'react';
import { SignalMark, type SignalMarkKind } from './signal-mark';

export type StatusMessageKind = 'ok' | 'fault' | 'info';

export interface StatusMessageProps {
  kind: StatusMessageKind;
  /** Fault code such as 'E-204'. Announced with the message, so it is not aria-hidden. */
  code?: string;
  children?: ReactNode;
  /** True: `role="alert"` (assertive). False: `role="status"` with `aria-live="polite"`. */
  isAlert?: boolean;
  /** Renders the live region even when empty, so it exists before text arrives and can take focus. */
  isAlwaysMounted?: boolean;
  ref?: Ref<HTMLDivElement>;
  tabIndex?: number;
  id?: string;
}

/** Status or fault line (C-06): signal mark, then the code over the text. */
export function StatusMessage({
  kind,
  code,
  children,
  isAlert = false,
  isAlwaysMounted = false,
  ref,
  tabIndex,
  id,
}: StatusMessageProps): React.JSX.Element | null {
  const isEmpty = isEmptyContent(children);

  if (isEmpty && !isAlwaysMounted) {
    return null;
  }

  return (
    <div
      ref={ref}
      id={id}
      className="lc-status-message"
      data-kind={kind}
      role={isAlert ? 'alert' : 'status'}
      aria-live={isAlert ? undefined : 'polite'}
      tabIndex={tabIndex}
    >
      {!isEmpty && (
        <>
          <span className="lc-status-message__mark">
            <SignalMark kind={signalMarkKinds[kind]} />
          </span>
          <span className="lc-status-message__body">
            {code !== undefined && <span className="lc-status-message__code">{code}</span>}
            <span className="lc-status-message__text">{children}</span>
          </span>
        </>
      )}
    </div>
  );
}

// === HELPERS ===

/** Info has no designed mark; the solid diamond keeps it distinct from ok without a pulse. */
const signalMarkKinds: Record<StatusMessageKind, SignalMarkKind> = {
  ok: 'ok',
  fault: 'fault',
  info: 'waypoint',
};

function isEmptyContent(children: ReactNode): boolean {
  return children === undefined || children === null || children === false || children === '';
}
