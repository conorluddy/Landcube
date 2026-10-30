import { useEffect, useState } from 'react';
import { BarGroup, FloatingBar } from '../ui/floating-bar';
import { BrandLockup } from '../ui/brand-lockup';
import { Button } from '../ui/button';
import { Crosshair } from '../ui/overlays/crosshair';
import { CoordinateTip } from '../ui/overlays/coordinate-tip';
import { HudFrame } from '../ui/overlays/hud-frame';
import { HudLayer } from '../ui/overlays/hud-layer';
import { SearchField, searchFieldInputClassName } from '../ui/search-field';
import { SignalMark } from '../ui/signal-mark';
import { formatCount } from './part-search';
import type { CodedPart, SystemSection } from './registry.types';

export const sourceRepositoryUrl = 'https://github.com/conorluddy/Topogra';

/** System top bar: brand, breadcrumb, Find, then back to the studio and the source link. */
export function SystemHeader({
  part,
  section,
  query,
  matchCount,
  onQueryChange,
  onExit,
}: {
  part: CodedPart;
  section: SystemSection;
  query: string;
  /** Undefined while Find is blank. */
  matchCount: number | undefined;
  onQueryChange: (query: string) => void;
  onExit: () => void;
}): React.JSX.Element {
  return (
    <FloatingBar as="header" className="studio-header">
      <BarGroup className="studio-brand">
        <BrandLockup context="System · Rev A" />
      </BarGroup>
      <BarGroup className="system-breadcrumb">
        <span className="system-breadcrumb__section">{section.code}</span>
        <span className="system-breadcrumb__divider" aria-hidden="true">
          /
        </span>
        <span className="system-breadcrumb__code">{part.code}</span>
        <span className="system-breadcrumb__name">{part.name}</span>
      </BarGroup>
      <div className="system-find">
        <SearchField
          label="Find a part"
          prefixLabel="Find"
          keyboardHint={[matchCount === undefined ? '⌘F' : formatCount(matchCount)]}
          isOpen={false}
          popover={null}
          input={
            <input
              type="search"
              className={searchFieldInputClassName}
              placeholder="Slider, glass, ink-6…"
              value={query}
              onChange={(event) => {
                onQueryChange(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Escape') {
                  return;
                }

                // Handled here, so the shell's Escape handler leaves it alone.
                event.preventDefault();

                if (query === '') {
                  onExit();
                } else {
                  onQueryChange('');
                }
              }}
            />
          }
        />
      </div>
      <BarGroup isSpacer />
      <BarGroup className="studio-actions">
        <Button variant="text" size="small" onClick={onExit}>
          ← Back to studio
        </Button>
        <Button variant="primary" size="small" href={sourceRepositoryUrl}>
          Source ↗
        </Button>
      </BarGroup>
    </FloatingBar>
  );
}

/** System footer: prev / position / next, then the system status line. */
export function SystemFooter({
  position,
  partCount,
  sectionCount,
  onStep,
  onExit,
}: {
  /** 1-based position of the shown part in browse order. */
  position: number;
  partCount: number;
  sectionCount: number;
  onStep: (delta: 1 | -1) => void;
  onExit: () => void;
}): React.JSX.Element {
  return (
    <FloatingBar as="footer" size="footer" className="studio-footer">
      <BarGroup className="studio-tools" role="group" label="Browse parts">
        <Button
          variant="text"
          size="small"
          onClick={() => {
            onStep(-1);
          }}
        >
          ← Prev
        </Button>
        <span className="system-position">
          {formatCount(position)} / {formatCount(partCount)}
        </span>
        <Button
          variant="text"
          size="small"
          onClick={() => {
            onStep(1);
          }}
        >
          Next →
        </Button>
      </BarGroup>
      <BarGroup className="studio-status">
        <SignalMark kind="ok" size="footer" />
        <span className="source-label">Design system</span>
        <span aria-hidden="true">/</span>
        <span className="studio-status-message">
          Rev A · {partCount} parts · {sectionCount} sections
        </span>
        <span className="attribution">Geist · Geist Mono · tokens.css</span>
        <button type="button" className="studio-mode-link" onClick={onExit}>
          ↩ Studio
        </button>
        <a className="studio-credit" href="https://conor.fyi" target="_blank" rel="noreferrer">
          conor.fyi ↗
        </a>
      </BarGroup>
    </FloatingBar>
  );
}

/** The studio HUD over the drafting ground: frame, a pixel crosshair, the specimen and grid readouts. */
export function SystemHud({
  part,
  plateCount,
}: {
  part: CodedPart;
  plateCount: number;
}): React.JSX.Element {
  const pointer = usePointerOverGround();

  return (
    <HudLayer
      canvasTone="light"
      inspectorState="expanded"
      pointer={
        <Crosshair position={pointer}>
          {pointer !== undefined && (
            <CoordinateTip
              lines={[`X ${formatPixels(pointer.xPx)} px`, `Y ${formatPixels(pointer.yPx)} px`]}
            />
          )}
        </Crosshair>
      }
      frame={
        <>
          <HudFrame readouts={[]} />
          <span className="system-hud-readout" data-edge="left">
            Specimen {part.code}
            {'   '}Scale 1:1{'   '}
            {formatCount(plateCount)} plates
          </span>
          <span className="system-hud-readout" data-edge="right">
            Grid 12 px
          </span>
        </>
      }
    />
  );
}

// === HELPERS ===

/** The pointer over bare ground; undefined over any UI surface or outside the window. */
function usePointerOverGround(): { xPx: number; yPx: number } | undefined {
  const [pointer, setPointer] = useState<{ xPx: number; yPx: number }>();

  useEffect(() => {
    const track = (event: PointerEvent) => {
      const isOverGround =
        event.pointerType !== 'touch' &&
        event.target instanceof Element &&
        event.target.closest('[data-ui-surface], header, footer, aside') === null;

      setPointer(isOverGround ? { xPx: event.clientX, yPx: event.clientY } : undefined);
    };

    const leave = () => {
      setPointer(undefined);
    };

    window.addEventListener('pointermove', track);
    document.documentElement.addEventListener('pointerleave', leave);

    return () => {
      window.removeEventListener('pointermove', track);
      document.documentElement.removeEventListener('pointerleave', leave);
    };
  }, []);

  return pointer;
}

function formatPixels(value: number): string {
  return String(Math.round(value)).padStart(4, '0');
}
