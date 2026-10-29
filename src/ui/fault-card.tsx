import { useId, type ReactNode } from 'react';
import { Button } from './button';
import { SignalMark } from './signal-mark';

export interface FaultCardAction {
  label: string;
  onClick: () => void;
}

export interface FaultCardProps {
  /** E-NNN code from `src/constants/faults.ts`, e.g. 'E-204'. */
  code: string;
  title: string;
  /** Short measure of the damage, e.g. '3 of 9 tiles'. */
  metric?: string;
  /** The explanation and how to fix it. */
  children: ReactNode;
  primaryAction: FaultCardAction;
  /** At most two. */
  secondaryActions?: readonly FaultCardAction[];
  /** True: sits inside a control group. False: floats over the viewport as glass. */
  isInline?: boolean;
}

const maximumSecondaryActions = 2;

/** Fault card (C-15): diamond, code and title, metric, explanation, then actions. */
export function FaultCard({
  code,
  title,
  metric,
  children,
  primaryAction,
  secondaryActions = [],
  isInline = false,
}: FaultCardProps): React.JSX.Element {
  const titleId = useId();

  if (secondaryActions.length > maximumSecondaryActions) {
    throw new Error(
      `FaultCard takes at most ${maximumSecondaryActions} secondary actions, got ${secondaryActions.length}. Move the extras into the body or a menu.`,
    );
  }

  return (
    <section
      className={isInline ? 'lc-fault-card' : 'lc-fault-card lc-glass'}
      data-inline={isInline ? 'true' : undefined}
      data-ui-surface
      role="alert"
      aria-labelledby={titleId}
    >
      <header className="lc-fault-card__header">
        <SignalMark kind="fault" />
        <p className="lc-fault-card__title" id={titleId}>
          <span className="lc-fault-card__code">{code}</span>
          <span aria-hidden="true"> · </span>
          <span>{title}</span>
        </p>
        {metric !== undefined && <span className="lc-fault-card__metric">{metric}</span>}
      </header>
      <div className="lc-fault-card__body">{children}</div>
      <div className="lc-fault-card__actions">
        <Button variant="primary" isFullWidth onClick={primaryAction.onClick}>
          {primaryAction.label}
        </Button>
        {secondaryActions.length > 0 && (
          <div className="lc-fault-card__secondary">
            {secondaryActions.map((action) => (
              <Button key={action.label} isFullWidth onClick={action.onClick}>
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
