export type SignalMarkKind = 'ok' | 'live' | 'fault' | 'waypoint';
export type SignalMarkSize = 'footer' | 'default' | 'large';
export type SignalMarkAccent = 'bone' | 'amber' | 'phosphor';

export interface SignalMarkProps {
  kind: SignalMarkKind;
  size?: SignalMarkSize;
  accent?: SignalMarkAccent;
  /** Present: exposed as an image with this name. Absent: decorative. */
  label?: string;
}

/** Status square (ok, live) or diamond (fault outline, waypoint solid) (P-17). */
export function SignalMark({
  kind,
  size = 'default',
  accent = 'bone',
  label,
}: SignalMarkProps): React.JSX.Element {
  const accessibility =
    label === undefined
      ? { 'aria-hidden': true as const }
      : { role: 'img' as const, 'aria-label': label };

  return (
    <span
      className="lc-signal-mark"
      data-kind={kind}
      data-size={size}
      data-accent={accent}
      {...accessibility}
    />
  );
}
