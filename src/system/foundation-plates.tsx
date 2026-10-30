import { useState, type CSSProperties } from 'react';
import { SignalMark } from '../ui/signal-mark';
import { Plate } from './plate';
import type { FoundationCell, TypeScaleRow } from './registry.types';
import { useTokenValue } from './token-value';

type CellOf<K extends FoundationCell['k']> = Extract<FoundationCell, { k: K }>;

/**
 * One foundation plate. Tokens aren't components, so these are the only hand-drawn specimens,
 * and every value they show is read live from the shipped stylesheet.
 */
export function FoundationPlate({ cell }: { cell: FoundationCell }): React.JSX.Element {
  switch (cell.k) {
    case 'swatch':
      return <SwatchPlate cell={cell} />;
    case 'textRole':
      return <TextRolePlate cell={cell} />;
    case 'line':
      return <LinePlate cell={cell} />;
    case 'glass':
      return <GlassPlate cell={cell} />;
    case 'shadow':
      return <ShadowPlate cell={cell} />;
    case 'pattern':
      return <PatternPlate cell={cell} />;
    case 'typeScale':
      return <TypeScalePlate cell={cell} />;
    case 'radius':
      return <RadiusPlate cell={cell} />;
    case 'space':
      return <SpacePlate cell={cell} />;
    case 'height':
      return <HeightPlate cell={cell} />;
    case 'signal':
      return <SignalPlate cell={cell} />;
    case 'motion':
      return <MotionPlate cell={cell} />;
  }
}

// === COLOUR ===

function SwatchPlate({ cell }: { cell: CellOf<'swatch'> }): React.JSX.Element {
  const value = useTokenValue(cell.token);

  return (
    <Plate label={cell.label} note={cell.note ?? value}>
      <div className="system-swatch" style={{ background: `var(${cell.token})` }} />
    </Plate>
  );
}

function TextRolePlate({ cell }: { cell: CellOf<'textRole'> }): React.JSX.Element {
  const value = useTokenValue(cell.token);

  return (
    <Plate label={cell.label} note={cell.note ?? value}>
      <div
        className="system-text-role"
        data-on-bone={cell.isOnBone === true ? 'true' : undefined}
        style={{ color: `var(${cell.token})` }}
      >
        <span className="system-text-role__sans">Show land surface</span>
        <span className="system-text-role__mono">55.0343°N</span>
      </div>
    </Plate>
  );
}

function LinePlate({ cell }: { cell: CellOf<'line'> }): React.JSX.Element {
  const shownToken = cell.fillToken ?? cell.borderToken ?? '';
  const value = useTokenValue(shownToken);

  return (
    <Plate label={cell.label} note={cell.note ?? describeOpacity(value)}>
      <div
        className="system-line"
        style={{
          borderColor: cell.borderToken === undefined ? 'transparent' : `var(${cell.borderToken})`,
          background: cell.fillToken === undefined ? 'transparent' : `var(${cell.fillToken})`,
        }}
      />
    </Plate>
  );
}

function SignalPlate({ cell }: { cell: CellOf<'signal'> }): React.JSX.Element {
  return (
    <Plate label={cell.label} note={cell.note}>
      <div className="system-signal">
        <SignalMark kind="ok" accent={cell.accent} size="large" />
        <span>Status · OK</span>
      </div>
    </Plate>
  );
}

// === SURFACE ===

function GlassPlate({ cell }: { cell: CellOf<'glass'> }): React.JSX.Element {
  const fill = useTokenValue(cell.token);
  const blur = useTokenValue(cell.blurToken);

  return (
    <Plate label={cell.label} note={cell.note} isFlush>
      <div className="system-ground-sample">
        <div
          className="system-glass-sample"
          style={{
            background: `var(${cell.token})`,
            backdropFilter: `blur(var(${cell.blurToken})) saturate(1.3)`,
            WebkitBackdropFilter: `blur(var(${cell.blurToken})) saturate(1.3)`,
          }}
        >
          <span>α {describeOpacity(fill)}</span>
          <span>Blur {blur.replace('px', '')}</span>
        </div>
      </div>
    </Plate>
  );
}

function ShadowPlate({ cell }: { cell: CellOf<'shadow'> }): React.JSX.Element {
  return (
    <Plate label={cell.label} note={cell.note} isFlush>
      <div className="system-ground-sample" data-plain="true">
        <div
          className="system-shadow-sample lc-glass"
          style={{ boxShadow: `var(${cell.token})` }}
        />
      </div>
    </Plate>
  );
}

function PatternPlate({ cell }: { cell: CellOf<'pattern'> }): React.JSX.Element {
  return (
    <Plate label={cell.label} note={cell.note} isFlush>
      <div className="system-pattern" data-on-glass={cell.isOnGlass === true ? 'true' : undefined}>
        <div className="system-pattern__layer" style={{ background: `var(${cell.token})` }} />
      </div>
    </Plate>
  );
}

// === TYPE ===

function TypeScalePlate({ cell }: { cell: CellOf<'typeScale'> }): React.JSX.Element {
  return (
    <Plate label={cell.label} note={cell.note} isFullWidth isFlush>
      <div className="system-type-list">
        {cell.rows.map((row) => (
          <TypeScaleLine key={`${row.role}-${row.sizeToken}-${row.tracking}`} row={row} />
        ))}
      </div>
    </Plate>
  );
}

function TypeScaleLine({ row }: { row: TypeScaleRow }): React.JSX.Element {
  const size = useTokenValue(row.sizeToken);

  return (
    <div className="system-type-list__row">
      <span className="system-type-list__spec">
        {size.replace('px', '')} · {row.role}
      </span>
      <span
        className="system-type-list__sample"
        style={{
          fontFamily: `var(--lc-font-${row.family})`,
          fontSize: `var(${row.sizeToken})`,
          fontWeight: row.weight,
          letterSpacing: row.tracking,
        }}
      >
        {row.sample}
      </span>
      <span className="system-type-list__token">{row.sizeToken}</span>
    </div>
  );
}

// === MEASURE ===

function RadiusPlate({ cell }: { cell: CellOf<'radius'> }): React.JSX.Element {
  const value = useTokenValue(cell.token);
  const radius = `var(${cell.token})`;

  return (
    <Plate label={cell.label} note={cell.note ?? value}>
      <div
        className="system-radius"
        style={{ borderRadius: cell.isTopOnly === true ? `${radius} ${radius} 0 0` : radius }}
      />
    </Plate>
  );
}

function SpacePlate({ cell }: { cell: CellOf<'space'> }): React.JSX.Element {
  const value = useTokenValue(cell.token);

  return (
    <Plate label={cell.label} note={cell.note ?? value}>
      <div className="system-space">
        <span className="system-space__bar" style={{ width: `var(${cell.token})` }} />
      </div>
    </Plate>
  );
}

function HeightPlate({ cell }: { cell: CellOf<'height'> }): React.JSX.Element {
  const value = useTokenValue(cell.token);

  return (
    <Plate label={cell.label} note={cell.note ?? value}>
      <div className="system-height" style={{ height: `var(${cell.token})` }} />
    </Plate>
  );
}

// === MOTION ===

function MotionPlate({ cell }: { cell: CellOf<'motion'> }): React.JSX.Element {
  const [isAtEnd, setIsAtEnd] = useState(false);
  const durationToken = /^var\((--lc-[a-z-]+)\)$/.exec(cell.duration)?.[1];
  const value = useTokenValue(durationToken ?? '--lc-dur');

  return (
    <Plate label={cell.label} note={cell.note ?? value}>
      <button
        type="button"
        className="system-motion"
        aria-label={`Run the ${cell.label} motion`}
        aria-pressed={isAtEnd}
        onClick={() => {
          setIsAtEnd(!isAtEnd);
        }}
        style={{ '--system-motion-duration': cell.duration } as CSSProperties}
      >
        <span className="system-motion__thumb" data-at-end={isAtEnd ? 'true' : undefined} />
      </button>
    </Plate>
  );
}

// === HELPERS ===

/** '0.06' for `rgba(255, 255, 255, 0.06)`; other values pass through. */
function describeOpacity(colour: string): string {
  const alpha = /^rgba\([^)]*,\s*([\d.]+)\)$/.exec(colour)?.[1];

  return alpha ?? colour;
}
