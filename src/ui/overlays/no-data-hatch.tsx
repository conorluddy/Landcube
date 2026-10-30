import { Tag } from '../tag';

export interface NoDataHatchProps {
  /** Tag in the middle of the hatched region. */
  label?: string;
}

/** No-data hatch overlay (O-09): diagonal hairlines over the part of the viewport with no data. */
export function NoDataHatch({ label = 'No data' }: NoDataHatchProps): React.JSX.Element {
  return (
    <div className="lc-no-data-hatch" aria-hidden="true">
      <Tag variant="outlineMuted">{label}</Tag>
    </div>
  );
}
