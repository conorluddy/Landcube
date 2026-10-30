import type { ReactNode } from 'react';

export interface PresetCardProps {
  name: string;
  /** CSS colours drawn as stripes; decorative. */
  swatches: readonly string[];
  isActive?: boolean;
  onSelect: () => void;
}

export interface PresetStripProps {
  label: string;
  children: ReactNode;
}

/** One preset (C-12): swatch stripes over its name. A toggle button: `aria-pressed` marks the applied preset. */
export function PresetCard({
  name,
  swatches,
  isActive = false,
  onSelect,
}: PresetCardProps): React.JSX.Element {
  return (
    <button className="lc-preset-card" type="button" aria-pressed={isActive} onClick={onSelect}>
      <span className="lc-preset-card__swatches" aria-hidden="true">
        {swatches.map((colour, index) => (
          <span key={`${String(index)}-${colour}`} style={{ background: colour }} />
        ))}
      </span>
      <span className="lc-preset-card__name">{name}</span>
    </button>
  );
}

/** Horizontal scroll-snap strip of `PresetCard`s. */
export function PresetStrip({ label, children }: PresetStripProps): React.JSX.Element {
  return (
    <div className="lc-preset-strip" role="group" aria-label={label}>
      {children}
    </div>
  );
}
