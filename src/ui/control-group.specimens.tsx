import { ControlGroup } from './control-group';
import {
  controlRowKinds,
  type ControlGroupDefinition,
  type ControlRow,
  type ControlRowKind,
} from './control-rows';
import { defineSpecimens, type SpecimenEntry } from './specimens';

const noop = (): void => undefined;
const inspectorWidthPixels = 396;

/** One representative row per kind; ids are prefixed per specimen so the page keeps unique ids. */
function createRowsByKind(prefix: string): Record<ControlRowKind, ControlRow> {
  return {
    toggle: {
      kind: 'toggle',
      id: `${prefix}-lock-seed`,
      label: 'Lock seed',
      value: true,
      onChange: noop,
    },
    range: {
      kind: 'range',
      id: `${prefix}-stroke-width`,
      label: 'Weight',
      value: 1.2,
      min: 0.3,
      max: 3,
      step: 0.05,
      unit: ' px',
      onChange: noop,
    },
    select: {
      kind: 'select',
      id: `${prefix}-terrain-shape`,
      label: 'Terrain shape',
      value: 'smooth',
      options: ['smooth', 'terraced'],
      onChange: noop,
    },
    segmented: {
      kind: 'segmented',
      id: `${prefix}-projection`,
      label: 'Projection',
      value: 'perspective',
      options: [
        { value: 'perspective', label: 'Perspective' },
        { value: 'orthographic', label: 'Axonometric' },
      ],
      onChange: noop,
    },
    number: {
      kind: 'number',
      id: `${prefix}-base-thickness`,
      label: 'Base thickness',
      value: 3,
      unit: 'mm',
      onChange: noop,
    },
    pair: {
      kind: 'pair',
      id: `${prefix}-coordinates`,
      fields: [
        {
          kind: 'number',
          id: `${prefix}-latitude`,
          label: 'Latitude',
          value: 53.0685,
          onChange: noop,
        },
        {
          kind: 'number',
          id: `${prefix}-longitude`,
          label: 'Longitude',
          value: -4.076,
          onChange: noop,
        },
      ],
    },
    colour: {
      kind: 'colour',
      id: `${prefix}-road-color`,
      label: 'Road color',
      value: '#b4b4b4',
      onChange: noop,
    },
    tiles: {
      kind: 'tiles',
      id: `${prefix}-edge-shape`,
      label: 'Edge shape',
      value: 'chamfer',
      options: [
        { value: 'square', label: 'Square' },
        { value: 'chamfer', label: 'Chamfer' },
        { value: 'round', label: 'Round' },
      ],
      onChange: noop,
    },
    hint: {
      kind: 'hint',
      id: `${prefix}-hint`,
      children: 'Elevation filters reduce coastal source artifacts; they do not trace a shoreline.',
    },
    status: {
      kind: 'status',
      id: `${prefix}-status`,
      statusKind: 'ok',
      children: 'Real terrain loaded',
    },
    link: {
      kind: 'link',
      id: `${prefix}-attribution`,
      label: 'Terrain data sources',
      href: '#attribution',
      isExternal: true,
    },
    button: {
      kind: 'button',
      id: `${prefix}-new-landscape`,
      variant: 'primary',
      children: 'New landscape',
      onClick: noop,
    },
    buttons: {
      kind: 'buttons',
      id: `${prefix}-view-presets`,
      label: 'View presets',
      buttons: [
        { key: 'top', children: 'Top', onClick: noop },
        { key: 'front', children: 'Front', onClick: noop },
        { key: 'side', children: 'Side', onClick: noop },
      ],
    },
    custom: {
      kind: 'custom',
      id: `${prefix}-custom`,
      render: () => <span className="lc-group__hint">Custom content</span>,
    },
  };
}

const kindSpecimens: SpecimenEntry[] = controlRowKinds.map((kind) => ({
  variant: kind,
  width: inspectorWidthPixels,
  render: () => (
    <ControlGroup
      group={{ id: `kind-${kind}`, title: kind, rows: [createRowsByKind(`kind-${kind}`)[kind]] }}
    />
  ),
}));

function createMixedGroup(prefix: string): ControlGroupDefinition {
  const rows = createRowsByKind(prefix);

  return {
    id: 'procedural-landscape',
    title: 'Procedural landscape',
    isPinnable: true,
    rows: [
      rows.hint,
      rows.toggle,
      false,
      rows.button,
      rows.range,
      undefined,
      rows.segmented,
      rows.pair,
    ],
  };
}

export default defineSpecimens('control-group', [
  ...kindSpecimens,
  {
    variant: 'mixed',
    width: inspectorWidthPixels,
    render: () => <ControlGroup group={createMixedGroup('mixed')} code="TERR.02" />,
  },
  {
    variant: 'mixed',
    state: 'narrow',
    width: 320,
    render: () => <ControlGroup group={createMixedGroup('narrow')} code="TERR.02" />,
  },
  {
    variant: 'mixed',
    state: 'pinnable',
    width: inspectorWidthPixels,
    render: () => <ControlGroup group={createMixedGroup('pinnable')} code="TERR.02" onPin={noop} />,
  },
]);
