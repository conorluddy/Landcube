export interface KbdProps {
  keys: string[];
  /** Spoken name for the whole shortcut, e.g. "Command K". Individual keys are then hidden. */
  label?: string;
}

/** Keyboard shortcut hint, one <kbd> per key (P-15). */
export function Kbd({ keys, label }: KbdProps): React.JSX.Element {
  return (
    <span className="lc-kbd" aria-label={label} role={label === undefined ? undefined : 'img'}>
      {keys.map((key, index) => (
        <kbd
          key={`${key}-${String(index)}`}
          className="lc-kbd__key"
          aria-hidden={label === undefined ? undefined : true}
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
