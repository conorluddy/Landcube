import type { ControlGroupDefinition } from './control-rows';
import { DetachablePanel } from './detachable-panel';
import { defineSpecimens } from './specimens';

const noop = () => undefined;

function createContourGroup(prefix: string): ControlGroupDefinition {
  return {
    id: `${prefix}-contour-density`,
    title: 'Contour density',
    isPinnable: true,
    rows: [
      {
        kind: 'range',
        id: `${prefix}-contour-count`,
        label: 'Density',
        value: 24,
        min: 4,
        max: 60,
        step: 1,
        onChange: noop,
      },
      {
        kind: 'hint',
        id: `${prefix}-contour-hint`,
        children: 'Lines per height band. Higher values draw more contours.',
      },
    ],
  };
}

function renderPanel(prefix: string) {
  return (
    <DetachablePanel
      group={createContourGroup(prefix)}
      code="CONT.01"
      position={{ xPx: 0, yPx: 0 }}
      zIndex={1}
      onMove={noop}
      onDock={noop}
      onFocus={noop}
    />
  );
}

export default defineSpecimens('detachable-panel', [
  { variant: 'default', width: 360, render: () => renderPanel('default') },
  { variant: 'default', state: 'focus', width: 360, render: () => renderPanel('focus') },
  {
    variant: 'default',
    state: 'dragging',
    width: 360,
    render: () => <div data-force-state="dragging">{renderPanel('dragging')}</div>,
  },
  { variant: 'default', state: 'narrow', width: 240, render: () => renderPanel('narrow') },
]);
