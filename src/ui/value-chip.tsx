export interface ValueChipProps {
  label: string;
  isSelected?: boolean;
  onClick: () => void;
  disabled?: boolean;
}

/** Quick-value chip (P-13), pressed-state styled like a selected choice tile. */
export function ValueChip({
  label,
  isSelected = false,
  onClick,
  disabled = false,
}: ValueChipProps): React.JSX.Element {
  return (
    <button
      className="lc-value-chip"
      type="button"
      aria-pressed={isSelected}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
