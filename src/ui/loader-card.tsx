import { Button } from './button';
import { Progress } from './progress';

export interface LoaderCardProps {
  title: string;
  /** 0 to 1. NaN means progress is unknown: the bar slides and no percentage shows. */
  fraction: number;
  /** Secondary line such as '3 of 9 tiles'. */
  detail?: string;
  onCancel?: () => void;
}

/** Loader card (C-17): title, percent, detail, a 2px progress bar and CANCEL. */
export function LoaderCard({
  title,
  fraction,
  detail,
  onCancel,
}: LoaderCardProps): React.JSX.Element {
  const isIndeterminate = Number.isNaN(fraction);

  return (
    <div className="lc-loader-card lc-glass" data-ui-surface role="status">
      <div className="lc-loader-card__header">
        <p className="lc-loader-card__title">{title}</p>
        {!isIndeterminate && (
          <span className="lc-loader-card__percent">{Math.round(fraction * 100)}%</span>
        )}
      </div>
      {detail !== undefined && <p className="lc-loader-card__detail">{detail}</p>}
      <Progress fraction={fraction} label={title} isIndeterminate={isIndeterminate} />
      {onCancel !== undefined && (
        <Button variant="text" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </div>
  );
}
