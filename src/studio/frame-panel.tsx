import type { ReactNode } from 'react';
import { frameStudioPresets, pedestalRecessDepthMm } from '../frame/frame-studio-settings';
import type { FrameStudioSettings } from '../frame/frame-studio-settings';
import { Group, Hint, NumberField, Select, Toggle } from './fields';
import type { PanelProps } from './panels';

const edgeShapeOptions: readonly FrameStudioSettings['edgeShape'][] = [
  'square',
  'chamfer',
  'cove',
  'round',
  'ogee',
  'step',
];

/** Picks a printable frame preset and its key dimensions; parts download from Export. */
export function FramePanel({ controller: c, state: s }: PanelProps): ReactNode {
  const { settings, assembly } = s.frame;
  const isTray = settings.preset === 'tray' || settings.preset === 'tray-on-plinth';
  const hasStand = settings.preset !== 'none' && settings.preset !== 'tray';

  return (
    <>
      <Group title="Frame">
        <Select
          label="Frame style"
          value={settings.preset}
          options={frameStudioPresets}
          onChange={(preset) => {
            c.frame({ preset });
          }}
        />
        {settings.preset === 'none' && (
          <Hint>Add a tray or pedestal printed separately to fit this model.</Hint>
        )}
        {settings.preset.includes('pedestal') && (
          <Hint>The model sits in a {pedestalRecessDepthMm} mm locating recess on top.</Hint>
        )}
      </Group>
      {settings.preset !== 'none' && (
        <Group title="Dimensions">
          <div className="control-grid">
            <NumberField
              label={isTray ? 'Border (mm)' : 'Overhang (mm)'}
              value={settings.borderWidthMm}
              min={1.2}
              max={200}
              onChange={(value) => {
                if (value !== undefined) {
                  c.frame({ borderWidthMm: value });
                }
              }}
            />
            <NumberField
              label="Clearance (mm)"
              value={settings.clearanceMm}
              min={-1}
              max={5}
              onChange={(value) => {
                if (value !== undefined) {
                  c.frame({ clearanceMm: value });
                }
              }}
            />
            {isTray && (
              <NumberField
                label="Rim above base (mm)"
                value={settings.rimAboveBaseMm}
                min={-50}
                max={200}
                onChange={(value) => {
                  if (value !== undefined) {
                    c.frame({ rimAboveBaseMm: value });
                  }
                }}
              />
            )}
            {hasStand && (
              <NumberField
                label="Stand height (mm)"
                value={settings.standHeightMm}
                min={1.2}
                max={200}
                onChange={(value) => {
                  if (value !== undefined) {
                    c.frame({ standHeightMm: value });
                  }
                }}
              />
            )}
          </div>
        </Group>
      )}
      {settings.preset !== 'none' && (
        <Group title="Edge">
          <Select
            label="Edge shape"
            value={settings.edgeShape}
            options={edgeShapeOptions}
            onChange={(edgeShape) => {
              c.frame({ edgeShape });
            }}
          />
          {settings.edgeShape !== 'square' && (
            <NumberField
              label="Edge size (mm)"
              value={settings.edgeSizeMm}
              min={0.2}
              max={50}
              onChange={(value) => {
                if (value !== undefined) {
                  c.frame({ edgeSizeMm: value });
                }
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
