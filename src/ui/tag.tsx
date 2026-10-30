export type TagVariant = 'outlineBone' | 'outlineMuted' | 'solidBone' | 'fileType';

export interface TagProps {
  variant: TagVariant;
  /** Authoring case is kept in the DOM; CSS applies the caps. */
  children: string;
}

/** Small status or file-type label (P-16). Never wraps. */
export function Tag({ variant, children }: TagProps): React.JSX.Element {
  return (
    <span className="lc-tag" data-variant={variant}>
      {children}
    </span>
  );
}
