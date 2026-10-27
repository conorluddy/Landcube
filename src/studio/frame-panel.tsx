import type { ReactNode } from 'react';
import {
  frameFinishKeys,
  frameFinishes,
  frameStudioPresets,
  isPedestalPreset,
  pedestalRecessDepthMm,
} from '../frame/frame-studio-settings';
import type { FrameStudioPreset, FrameStudioSettings } from '../frame/frame-studio-settings';
import { Group, Hint, Range, Toggle } from './fields';
import type { PanelProps } from './panels';

type EdgeShape = FrameStudioSettings['edgeShape'];

/** Cross-sections of the frame's top outer corner, in the button's text colour. */
const edgeShapeProfiles: Record<EdgeShape, string> = {
  square: 'M4 20V4h16v16z',
  chamfer: 'M4 20V4h8l8 8v8z',
  cove: 'M4 20V4h8a8 8 0 0 0 8 8v8z',
  round: 'M4 20V4h8a8 8 0 0 1 8 8v8z',
  ogee: 'M4 20V4h8q4 0 4 4t4 4v8z',
  step: 'M4 20V4h8v4h4v4h4v8z',
};
const edgeShapes: readonly EdgeShape[] = ['square', 'chamfer', 'cove', 'round', 'ogee', 'step'];

/** Picks a printable frame preset and its key dimensions; parts download from Export. */
export function FramePanel({ controller: c, state: s }: PanelProps): ReactNode {
  const { settings, assembly } = s.frame;
  const isTray = settings.preset === 'tray' || settings.preset === 'tray-on-plinth';
  const hasStand = settings.preset !== 'none' && settings.preset !== 'tray';

  return (
    <>
      <Group title="Frame">
        <div role="group" aria-label="Frame style" className="frame-choices">
          {frameStudioPresets.map(({ value, label }) => (
            <button
              type="button"
              key={value}
              aria-pressed={settings.preset === value}
              title={label}
              onClick={() => {
                c.frame({ preset: value });
              }}
            >
              <FrameStyleThumbnail preset={value} />
              {label}
            </button>
          ))}
        </div>
        {settings.preset !== 'none' && (
          <div role="group" aria-label="Frame finish" className="frame-choices">
            {frameFinishKeys.map((finish) => (
              <button
                type="button"
                key={finish}
                aria-pressed={settings.finish === finish}
                title={frameFinishes[finish].label}
                onClick={() => {
                  c.frame({ finish });
                }}
              >
                <span
                  className="preset-swatch"
                  style={{ background: frameFinishes[finish].color }}
                />
                {frameFinishes[finish].label}
              </button>
            ))}
          </div>
        )}
        {settings.preset === 'none' && (
          <Hint>Add a tray or pedestal printed separately to fit this model.</Hint>
        )}
        {isPedestalPreset(settings.preset) && (
          <Hint>The model sits in a {pedestalRecessDepthMm} mm locating recess on top.</Hint>
        )}
      </Group>
      {settings.preset !== 'none' && (
        <Group title="Dimensions">
          <>
            <Range
              label={isTray ? 'Border' : 'Overhang'}
              value={settings.borderWidthMm}
              min={1.2}
              max={60}
              step={0.1}
              suffix=" mm"
              onChange={(value) => {
                c.frame({ borderWidthMm: value });
              }}
            />
            <Range
              label="Clearance"
              value={settings.clearanceMm}
              min={-1}
              max={2}
              step={0.05}
              suffix=" mm"
              onChange={(value) => {
                c.frame({ clearanceMm: value });
              }}
            />
            {isTray && (
              <Range
                label="Rim above base"
                value={settings.rimAboveBaseMm}
                min={-20}
                max={50}
                step={0.5}
                suffix=" mm"
                onChange={(value) => {
                  c.frame({ rimAboveBaseMm: value });
                }}
              />
            )}
            {hasStand && (
              <Range
                label="Stand height"
                value={settings.standHeightMm}
                min={1.2}
                max={100}
                step={0.5}
                suffix=" mm"
                onChange={(value) => {
                  c.frame({ standHeightMm: value });
                }}
              />
            )}
          </>
        </Group>
      )}
      {settings.preset !== 'none' && (
        <Group title="Edge">
          <div role="group" aria-label="Edge shape" className="frame-choices edge-choices">
            {edgeShapes.map((shape) => (
              <button
                type="button"
                key={shape}
                aria-pressed={settings.edgeShape === shape}
                onClick={() => {
                  c.frame({ edgeShape: shape });
                }}
              >
                <svg className="frame-thumbnail" viewBox="0 0 24 24" aria-hidden="true">
                  <path d={edgeShapeProfiles[shape]} fill="currentColor" />
                </svg>
                {shape[0].toUpperCase() + shape.slice(1)}
              </button>
            ))}
          </div>
          {settings.edgeShape !== 'square' && (
            <Range
              label="Edge size"
              value={settings.edgeSizeMm}
              min={0.2}
              max={20}
              step={0.1}
              suffix=" mm"
              onChange={(value) => {
                c.frame({ edgeSizeMm: value });
              }}
            />
          )}
          <Toggle
            label="Floating toe"
            value={settings.hasFloatingToe}
            onChange={(hasFloatingToe) => {
              c.frame({ hasFloatingToe });
            }}
          />
        </Group>
      )}
      {assembly?.ok === false && <p role="alert">{assembly.error.message}</p>}
      {settings.preset !== 'none' && <Hint>Download each part from Export → Frame STL.</Hint>}
    </>
  );
}

// === HELPERS ===

/** Side profiles: the model in green, frame parts in the button's text colour. */
const styleProfiles: Record<FrameStudioPreset, { frame: string; modelY: number }> = {
  none: { frame: '', modelY: 14 },
  tray: { frame: 'M4 6h4v12h24V6h4v16H4z', modelY: 12 },
  pedestal: { frame: 'M4 16h32v6H4z', modelY: 8 },
  'stacked-pedestal': { frame: 'M8 13h24v4H8zM3 17h34v5H3z', modelY: 5 },
  'tray-on-plinth': { frame: 'M6 4h3v10h22V4h3v12H6zM3 16h34v6H3z', modelY: 8 },
};

function FrameStyleThumbnail({ preset }: { preset: FrameStudioPreset }): ReactNode {
  const { frame, modelY } = styleProfiles[preset];

  return (
    <svg className="frame-thumbnail" viewBox="0 0 40 24" aria-hidden="true">
      <path d={`M10 ${modelY + 6}V${modelY + 2}l5-3 4 2 5-5 6 5v7z`} fill="#7f9a6a" />
      {frame && <path d={frame} fill="currentColor" />}
    </svg>
  );
}
