import type { ReactNode } from 'react';

export interface ModelCardProps {
  title: string;
  subtitle: string;
  /** Visual shown in the 132px thumbnail area. */
  thumbnail: ReactNode;
  /** Status tags beside the title, usually `Tag`s. */
  tags?: ReactNode;
  onOpen: () => void;
  /** Adds a delete button named "Delete {title}". */
  onDelete?: () => void;
}

/** Library card (C-11): thumbnail, name with status tags, meta line. The whole card opens; delete is separate. */
export function ModelCard({
  title,
  subtitle,
  thumbnail,
  tags,
  onOpen,
  onDelete,
}: ModelCardProps): React.JSX.Element {
  return (
    <article className="lc-model-card">
      <button className="lc-model-card__open" type="button" onClick={onOpen}>
        <span className="lc-model-card__thumbnail">{thumbnail}</span>
        <span className="lc-model-card__heading">
          <span className="lc-model-card__title">{title}</span>
          {tags === undefined ? null : <span className="lc-model-card__tags">{tags}</span>}
        </span>
        <span className="lc-model-card__subtitle">{subtitle}</span>
      </button>
      {onDelete === undefined ? null : (
        <button
          className="lc-model-card__delete"
          type="button"
          aria-label={`Delete ${title}`}
          onClick={onDelete}
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </article>
  );
}
