import { useState, type CSSProperties } from 'react';
import { BottomSheet } from '../ui/bottom-sheet';
import { BrandLockup } from '../ui/brand-lockup';
import { Button } from '../ui/button';
import { BarGroup, FloatingBar } from '../ui/floating-bar';
import { IconButton } from '../ui/icon-button';
import { ReadoutCell, ReadoutGrid } from '../ui/readout-grid';
import { Segmented } from '../ui/segmented';
import type { SheetSnap } from '../ui/sheet-handle';
import { StatusMessage } from '../ui/status-message';
import { Plate } from './plate';
import type { LayoutCell } from './registry.types';

/** One layout plate: the desktop frame as a diagram, or a live phone built from real components. */
export function LayoutPlate({ cell }: { cell: LayoutCell }): React.JSX.Element {
  switch (cell.k) {
    case 'desktopShell':
      return (
        <Plate label={cell.label} note={cell.note} isFullWidth isFlush>
          <DesktopShellDiagram />
        </Plate>
      );
    case 'mobileShell':
      return (
        <Plate label={cell.label} note={cell.note} isFullWidth>
          <MobileShell />
        </Plate>
      );
  }
}

// === DESKTOP ===

const desktopWidthPx = 1440;
const desktopHeightPx = 810;

/** Shell boxes in desktop pixels, the same numbers as `studio.css`, drawn to scale. */
const desktopBoxes: readonly DesktopBox[] = [
  { label: 'Brand', left: 12, top: 12, width: 128, height: 40 },
  { label: 'View', left: 146, top: 12, width: 76, height: 40 },
  { label: 'Source', left: 228, top: 12, width: 200, height: 40 },
  { label: 'Search', left: 434, top: 12, width: 300, height: 40 },
  { label: 'Actions', right: 12, top: 12, width: 230, height: 40 },
  { label: 'Inspector · 396', right: 12, top: 60, width: 396, bottom: 60 },
  { label: 'Readout · 300', left: 12, bottom: 60, width: 300, height: 330 },
  { label: 'Tools', left: 12, bottom: 12, width: 360, height: 36 },
  { label: 'Status', left: 378, bottom: 12, right: 12, height: 36 },
];

interface DesktopBox {
  label: string;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  width?: number;
  height?: number;
}

function DesktopShellDiagram(): React.JSX.Element {
  return (
    <div className="system-desktop-shell" role="img" aria-label={describeDesktopShell()}>
      <span className="system-desktop-shell__frame" />
      {desktopBoxes.map((box) => (
        <span key={box.label} className="system-desktop-shell__box" style={toPercentages(box)}>
          {box.label}
        </span>
      ))}
    </div>
  );
}

/** The diagram's content as text, since the boxes are hidden behind one image role. */
function describeDesktopShell(): string {
  return `Desktop shell layout, ${String(desktopWidthPx)} × ${String(desktopHeightPx)}: ${desktopBoxes.map((box) => box.label).join(', ')}`;
}

function toPercentages(box: DesktopBox): CSSProperties {
  const across = (value: number | undefined) =>
    value === undefined ? undefined : `${String((value / desktopWidthPx) * 100)}%`;
  const down = (value: number | undefined) =>
    value === undefined ? undefined : `${String((value / desktopHeightPx) * 100)}%`;

  return {
    left: across(box.left),
    right: across(box.right),
    width: across(box.width),
    top: down(box.top),
    bottom: down(box.bottom),
    height: down(box.height),
  };
}

// === MOBILE ===

const ignore = (): void => undefined;

const snapOptions = [
  { value: 'closed', label: 'Closed' },
  { value: 'peek', label: 'Peek' },
  { value: 'half', label: 'Half' },
  { value: 'full', label: 'Full' },
] as const satisfies readonly { value: SheetSnap; label: string }[];

/** A phone of real components at real size, so the sheet drags and snaps exactly as it ships. */
function MobileShell(): React.JSX.Element {
  const [snap, setSnap] = useState<SheetSnap>('half');

  return (
    <div className="system-mobile-shell">
      <Segmented
        label="Sheet snap"
        isLabelVisible={false}
        size="medium"
        value={snap}
        options={snapOptions}
        onChange={setSnap}
      />
      <div className="system-mobile-shell__device" data-sheet-snap={snap}>
        <FloatingBar size="mobile" className="system-mobile-shell__header">
          <BarGroup>
            <BrandLockup context="Studio" />
          </BarGroup>
          <BarGroup isSpacer />
          <BarGroup>
            <Button variant="text" size="small">
              Link
            </Button>
          </BarGroup>
        </FloatingBar>
        {/* Shown for placement only: there is no map here for them to act on. */}
        <div className="system-mobile-shell__controls" inert>
          <FloatingBar size="mobile">
            <IconButton glyph="N" label="Reset view" onClick={ignore} />
            <IconButton glyph="◫" label="Overlays" onClick={ignore} />
            <IconButton glyph="↔" label="Measure tool" onClick={ignore} />
            {/* The studio staggers these in once the sheet closes; the plate shows their resting place. */}
            {snap === 'closed' && (
              <div
                className="system-mobile-shell__shortcuts"
                role="group"
                aria-label="Open controls"
              >
                <IconButton glyph="▲" label="Terrain controls" onClick={ignore} />
                <IconButton glyph="≋" label="Contour controls" onClick={ignore} />
                <IconButton glyph="◐" label="Colour controls" onClick={ignore} />
                <IconButton glyph="↗" label="Export" onClick={ignore} />
              </div>
            )}
          </FloatingBar>
        </div>
        <BottomSheet
          as="div"
          label="Landscape controls"
          snap={snap}
          onSnapChange={setSnap}
          peek={
            <div className="system-mobile-shell__peek">
              <ReadoutGrid>
                <ReadoutCell label="High" value="751" unit="m" />
                <ReadoutCell label="Span" value="5.09" unit="km" />
              </ReadoutGrid>
              <Button variant="primary" size="small">
                Export ↗
              </Button>
            </div>
          }
        >
          {['Terrain', 'Contours', 'Colour', 'Scene'].map((section, index) => (
            <StatusMessage key={section} kind="ok" code={`0${String(index + 1)} · ${section}`}>
              Section controls.
            </StatusMessage>
          ))}
        </BottomSheet>
      </div>
    </div>
  );
}
