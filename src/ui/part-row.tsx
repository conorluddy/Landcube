export interface PartRowProps {
  /** System code such as 'PRIM.04'. */
  code: string;
  name: string;
  /** Trailing count, already formatted, e.g. '03'. */
  count: string;
  /** Exposed as `aria-current="true"`. */
  isActive: boolean;
  onSelect: () => void;
}

/** Design-system navigation row (P-23): code, name and plate count. Full-bleed inside a 18px-padded body. */
export function PartRow({
  code,
  name,
  count,
  isActive,
  onSelect,
}: PartRowProps): React.JSX.Element {
  return (
    <button
      type="button"
      className="lc-part-row"
      aria-current={isActive ? 'true' : undefined}
      onClick={onSelect}
    >
      <span className="lc-part-row__code">{code}</span>
      <span className="lc-part-row__name">{name}</span>
      <span className="lc-part-row__count" aria-hidden="true">
        {count}
      </span>
    </button>
  );
}
