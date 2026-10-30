import type { ComponentPart, SpecRow, SystemSectionId } from '../registry.types';

const row = (property: string, value?: string, token?: string): SpecRow => ({
  property,
  value,
  token,
});

/** A part for the `src/ui` component whose `defineSpecimens` name is `component`; that name is also its id. */
function part(
  section: SystemSectionId,
  group: string,
  component: string,
  name: string,
  summary: string,
  {
    usedIn,
    spec = [],
    plates,
  }: { usedIn?: string; spec?: SpecRow[]; plates?: readonly string[] } = {},
): ComponentPart {
  return {
    kind: 'component',
    id: component,
    component,
    section,
    group,
    name,
    summary,
    usedIn,
    spec,
    plates,
  };
}

// === PRIMITIVES ===

const primitives: ComponentPart[] = [
  part(
    'PRIM',
    'Actions',
    'button',
    'Button',
    'One primary action per surface. Bone fill for the action, a hairline for the alternative, bare text for the way out.',
    {
      plates: [
        'primary/small',
        'primary/hover',
        'primary/extraLarge',
        'primary/busy',
        'secondary/small',
        'secondary/hover',
        'text/small',
        'primary/disabled',
      ],
      usedIn: '1 · 2C · 2F · 3A–3U',
      spec: [
        row('Height', '30 primary · 28 secondary · 52 mobile', '--lc-h-m, --lc-h-s, --lc-h-xl'),
        row('Label', 'Mono 10 / 500, caps', '--lc-fs-ui'),
        row('Glyph', '→ ↗ ↓ ↵ trailing, 10px gap'),
        row('Hover', 'Primary → white fill · secondary → bone border', '--lc-white'),
        row('Radius', undefined, '--lc-r-control'),
      ],
    },
  ),
  part(
    'PRIM',
    'Actions',
    'icon-button',
    'Icon button',
    'A 44px glass square for map and sheet controls. Pressed shows as a bone fill.',
    {
      usedIn: '3E · 3M',
      spec: [
        row('Size', '44 × 44', '--lc-h-l'),
        row('Pressed', 'aria-pressed, bone fill', '--lc-bone'),
      ],
    },
  ),
  part(
    'PRIM',
    'Actions',
    'segmented',
    'Segmented control',
    'Single-select. On a glass bar the container is the pill; inside a panel it takes a hairline. Arrow keys move the selection.',
    {
      plates: [
        'two-options/bar',
        'on-glass-bar/bar',
        'three-options/medium',
        'three-options/medium/hover',
        'three-options/medium/disabled',
        'four-options/large',
      ],
      usedIn: '1 · 2H · 3E · 3Q',
      spec: [
        row('Container', '3px padding, 2px gap, 1px line', '--lc-line'),
        row('Selected', 'Bone fill, ink-1 text', '--lc-bone'),
        row('Unselected', 'Bone on hover, fill 0.06', '--lc-fill-hover'),
        row('Sizes', 'Compact 22 · medium 26 · bar 34 · large 40'),
      ],
    },
  ),
  part(
    'PRIM',
    'Actions',
    'value-chip',
    'Value chip',
    'Quick values beside a control. Pressed is styled like a selected choice tile.',
    {
      plates: [
        'unselected/default',
        'selected/default',
        'unselected/hover',
        'selected/focus',
        'unselected/disabled',
      ],
      spec: [row('Pressed', 'Bone border + fill 0.10', '--lc-fill-selected')],
    },
  ),
  part(
    'PRIM',
    'Actions',
    'kbd',
    'Kbd hint',
    'Keyboard affordances sit inside the thing they open, at the far right.',
    {
      usedIn: '1 · 2C',
      spec: [
        row('Type', 'Mono 9, ink-6', '--lc-fs-label'),
        row('Box', '2px 5px, 1px white 0.14, radius 2'),
      ],
    },
  ),
  part(
    'PRIM',
    'Inputs',
    'switch',
    'Switch',
    'Two labelled cells instead of a pill. The state is readable as text, not just position.',
    {
      plates: ['off/default', 'on/default', 'on/hover', 'on/focus', 'off/disabled', 'description'],
      usedIn: '1 · 3F · 3G',
      spec: [
        row('Box', '2px padding, 1px line, radius 2', '--lc-line'),
        row('Cells', 'Mono 8.5, 0.1em, 3px 6px'),
        row('On', 'ON cell bone / ink · OFF ink-4'),
        row('Off', 'OFF cell fill 0.12 / ink-9 · ON ink-4', '--lc-fill-off'),
        row('Row', 'Label Geist 12 ink-8, min height 22', '--lc-h-xs'),
      ],
    },
  ),
  part(
    'PRIM',
    'Inputs',
    'checkbox',
    'Checkbox',
    'For lists of parts you include or leave out. A drawn box over a native checkbox that keeps the hit target.',
    {
      plates: [
        'unchecked/default',
        'checked/default',
        'checked/hover',
        'checked/focus',
        'unchecked/disabled',
        'detail',
      ],
      usedIn: '3R',
      spec: [
        row('Box', '18 × 18, radius 2'),
        row('On', 'Bone fill, ink ✓'),
        row('Off', '1px white 0.25'),
      ],
    },
  ),
  part(
    'PRIM',
    'Inputs',
    'ruler-slider',
    'Ruler slider',
    'A measuring rule, not a fader. Live value at the top right, tabular so it doesn’t jitter. Drag any of these.',
    {
      plates: [
        'default',
        'default/hover',
        'default/focus',
        'default/disabled',
        'unit',
        'display-value',
      ],
      usedIn: '1 · 3F · 3G · 3H',
      spec: [
        row('Track', '16px · rail 1px at y7, white 0.14'),
        row('Ticks', '4px at y10, every 10%', '--lc-ticks'),
        row('Thumb', '7 × 13 bone, radius 1', '--lc-ring-thumb'),
        row('Value', 'Mono 10.5 bone · unit ink-5', '--lc-fs-value-s'),
        row('Mobile', '36 track · 10 × 24 thumb · 6px ticks'),
      ],
    },
  ),
  part(
    'PRIM',
    'Inputs',
    'select',
    'Select',
    'A drawn frame around a native select, so keyboards, screen readers and phone pickers all work. The position readout shows how far down the list you are.',
    {
      usedIn: '1 · 3F',
      spec: [
        row('Box', '28 tall, min 150 wide, padding 0 9', '--lc-h-s'),
        row('Value', 'Geist 12', '--lc-fs-body'),
        row('Position', '01/03 · Mono 9 ink-6, up to 12 ungrouped options'),
        row('Hover', 'Border white 0.26', '--lc-line-hover'),
      ],
    },
  ),
  part(
    'PRIM',
    'Inputs',
    'number-field',
    'Number field',
    'Mono values in a hairline box. The unit sits with the label, so the box holds only the number. Edits commit on blur or Enter.',
    {
      usedIn: '1 · 3F · 3K',
      spec: [
        row('Box', '30 tall, padding 0 9, fill 0.03', '--lc-h-m, --lc-fill-field'),
        row('Value', 'Mono 11.5', '--lc-fs-value'),
        row('Focus', 'Bone border', '--lc-line-focus'),
        row('Empty', 'Placeholder “—”'),
      ],
    },
  ),
  part(
    'PRIM',
    'Inputs',
    'text-field',
    'Text field',
    'Free text in the same frame as the number field: plaque text, the manual style link.',
    {
      spec: [
        row('Box', '30 tall, fill 0.03', '--lc-h-m, --lc-fill-field'),
        row('Focus', 'Bone border', '--lc-line-focus'),
      ],
    },
  ),
  part(
    'PRIM',
    'Inputs',
    'field-pair',
    'Field pair',
    'Two fields side by side, 8px apart. Stacks when its container is narrower than 240px.',
    {
      usedIn: '1 · 3F',
      spec: [
        row('Columns', '2, 8px gap', '--lc-s-4'),
        row('Stacks', 'Below 240px container width'),
      ],
    },
  ),
  part(
    'PRIM',
    'Inputs',
    'color-field',
    'Colour field',
    'Hex first, swatch second. The swatch wraps the native colour input.',
    {
      usedIn: '1 · 3G',
      spec: [
        row('Hex', 'Mono 10 ink-6, 0.06em'),
        row('Swatch', '22 × 14, 1px white 0.2'),
        row('Gap', '8px', '--lc-s-4'),
      ],
    },
  ),
  part(
    'PRIM',
    'Inputs',
    'choice-tiles',
    'Choice tiles',
    'Three-up grid for picking a thing by name. Material tiles carry a swatch; colour here is data.',
    {
      plates: ['columns-3', 'swatch', 'thumbnail', 'columns-3/hover', 'columns-3/disabled'],
      usedIn: '1 · 3J',
      spec: [
        row('Tile', 'Min 32 tall, 6px 8px, Geist 11'),
        row('Selected', 'Bone border + fill 0.10', '--lc-fill-selected'),
        row('Unselected', 'Line 0.10, ink-7 → 0.28 hover'),
        row('Swatch', '10 × 10'),
      ],
    },
  ),
  part(
    'PRIM',
    'Inputs',
    'search-field',
    'Search field',
    'A glass pill with a caps prefix that says what it searches. Mobile grows to 46 and lights its border while focused.',
    {
      usedIn: '1 · 3C · 3L',
      spec: [
        row('Prefix', 'LOC · Mono 9 ink-5, 0.14em'),
        row('Input', 'Geist 12 · mobile 16', '--lc-fs-m-input'),
        row('Trailing', 'Kbd hint · mobile CLEAR'),
      ],
    },
  ),
  part(
    'PRIM',
    'Marks',
    'tag',
    'Tag',
    'Status and type labels. Outline bone for final, outline muted for draft, solid bone for identifiers and file types.',
    {
      usedIn: '2E · 2H · 3B · 3R',
      spec: [row('Type', 'Mono caps', '--lc-fs-label'), row('Box', '2px 5px', '--lc-r-inner')],
    },
  ),
  part(
    'PRIM',
    'Marks',
    'signal-mark',
    'Signal mark',
    'Squares mean live. Diamonds mean a place: outlined for a fault, solid for a waypoint.',
    {
      plates: [
        'ok/default',
        'live/default',
        'fault/default',
        'waypoint/default',
        'ok/amber',
        'ok/phosphor',
      ],
      usedIn: '1 · 2F · 2I',
      spec: [
        row('Square', '6 × 6 · 5 in footer', '--lc-signal'),
        row('Diamond', '10–12, rotated 45°'),
      ],
    },
  ),
  part('PRIM', 'Marks', 'progress', 'Progress', 'Two pixels. Indeterminate leaves out the value.', {
    usedIn: '2F · 3S',
    spec: [row('Height', '2px'), row('Track', 'White 0.08'), row('Fill', 'Bone', '--lc-bone')],
  }),
  part(
    'PRIM',
    'Text',
    'group-header',
    'Group header',
    'Code, caps label, then a hairline that fills the row. Every group is addressable.',
    {
      usedIn: '1 · 3F–3J',
      spec: [
        row('Label', 'Mono 9 ink-9', '--lc-track-head'),
        row('Rule', '1px white 0.08, flex 1'),
        row('Code', 'Mono 8.5 ink-4'),
      ],
    },
  ),
  part(
    'PRIM',
    'Text',
    'readout-grid',
    'Readout grid',
    'Labelled numbers in two columns with hairline rows.',
    {
      usedIn: '1 · 3E',
      spec: [
        row('Label', 'Mono 8.5 ink-5, 0.14em'),
        row('Value', 'Mono 11.5 bone, tabular', '--lc-fs-value'),
      ],
    },
  ),
  part(
    'PRIM',
    'Text',
    'brand-lockup',
    'Brand lockup',
    'The ≋ glyph and the wordmark, with a context line naming where you are.',
    {
      usedIn: '1 · 3A',
      spec: [
        row('Glyph', '≋ at 18px'),
        row('Wordmark', 'Mono 11 / 500', '--lc-track-brand'),
        row('Context', 'Mono 8.5 ink-6', '--lc-track-head'),
      ],
    },
  ),
  part(
    'PRIM',
    'Navigation',
    'section-rail',
    'Section rail',
    'Numbered section buttons. Vertical in the inspector, a horizontal tab strip on phones. Arrow keys, Home and End move focus.',
    {
      usedIn: '1 · 2B · 3F',
      spec: [
        row('Item', 'Index 8.5 over name 10, 9px 12px'),
        row('Active', 'Fill + 2px bone bar', '--lc-fill-active'),
      ],
    },
  ),
  part(
    'PRIM',
    'Navigation',
    'part-row',
    'Part row',
    'The rows down the side of this page: code, name and plate count.',
    {
      spec: [
        row('Grid', '62px · 1fr · auto, 8px gap'),
        row('Active', 'Fill + 2px bone bar, inset 5px', '--lc-fill-active'),
      ],
    },
  ),
  part(
    'PRIM',
    'Navigation',
    'sheet-handle',
    'Sheet handle',
    'The grabber at the top of the bottom sheet. Keyboard-operable; dragging belongs to the sheet.',
  ),
  part(
    'PRIM',
    'Navigation',
    'list-row',
    'List row',
    'Mobile list row, 56px with a hairline. A button, a link or a static row.',
    {
      usedIn: '3K · 3T',
      spec: [row('Height', '56px'), row('Leading', '28px glyph tile')],
    },
  ),
];

// === COMPOSITES ===

const composites: ComponentPart[] = [
  part(
    'COMP',
    'Surfaces',
    'glass-panel',
    'Glass panel',
    'Panel alpha, a hairline edge and the panel shadow. Every panel and popover starts here.',
    {
      usedIn: 'ALL PANELS',
      spec: [
        row('Fill', undefined, '--lc-glass-panel'),
        row('Edge', undefined, '--lc-line-panel'),
        row('Shadow', undefined, '--lc-shadow-panel'),
        row('Padding', '18 default · 0 for panels that lay out their own edges'),
      ],
    },
  ),
  part(
    'COMP',
    'Surfaces',
    'floating-bar',
    'Floating bar',
    'The top bar isn’t one bar. It’s a row of separate glass pills, 6px apart, 12px from the edge.',
    {
      usedIn: '1',
      spec: [
        row('Inset', '12px from viewport', '--lc-s-6'),
        row('Gap', '6px between pills', '--lc-s-3'),
        row('Order', 'Brand · view · source · search · spacer · secondary · primary'),
        row('Overflow', 'Search shrinks first, min 120. Buttons never wrap.'),
      ],
    },
  ),
  part(
    'COMP',
    'Surfaces',
    'inspector-panel',
    'Inspector',
    'A numbered section rail and a content column. In this mode it flips over and becomes the navigation.',
    {
      usedIn: '1 · 2B',
      spec: [
        row('Width', '396 · rail 92'),
        row('Header', 'NN / NN · Geist 15 · tag', '--lc-fs-lead'),
        row('Body', 'Padding 4 18 18, groups 16 apart'),
      ],
    },
  ),
  part(
    'COMP',
    'Surfaces',
    'control-group',
    'Control group',
    'A header and a stack of typed rows. The inspector is just a list of these, driven by data.',
    {
      plates: ['mixed', 'mixed/pinnable', 'toggle', 'range', 'select', 'tiles', 'status', 'hint'],
      usedIn: '1 · 3F–3J',
      spec: [
        row(
          'Row kinds',
          'toggle · range · select · segmented · number · pair · colour · tiles · hint · status · link · button',
        ),
        row('Row gap', '12px', '--lc-s-6'),
        row('Hint', 'Geist 11 ink-6, line-height 1.55', '--lc-fs-hint'),
      ],
    },
  ),
  part(
    'COMP',
    'Surfaces',
    'settings-group',
    'Settings group',
    'A group header over a hairline list of settings rows. The mobile account page is built from these.',
    {
      usedIn: '3T',
    },
  ),
  part(
    'COMP',
    'Surfaces',
    'detachable-panel',
    'Detachable panel',
    'A control group floating on glass. Drag the header, or focus it and use the arrow keys: 12px a step, 48 with Shift.',
    {
      usedIn: '2B',
      spec: [row('Snap', '12px grid', '--lc-s-6')],
    },
  ),
  part(
    'COMP',
    'Surfaces',
    'status-message',
    'Status message',
    'Inline confirmation after an action. Signal mark, the code in mono, then the plain sentence.',
    {
      usedIn: '1 · 3F',
      spec: [
        row('Box', '9px 10px, line 0.06, fill 0.03'),
        row('Code', 'Mono 9 ink-9, 0.14em'),
        row('Text', 'Geist 11.5 ink-8'),
      ],
    },
  ),
  part(
    'COMP',
    'Dialogs',
    'command-palette',
    'Command palette',
    'Every parameter, place and action behind ⌘K, with a preview of the active result.',
    {
      usedIn: '2C',
    },
  ),
  part(
    'COMP',
    'Dialogs',
    'export-sheet',
    'Export sheet',
    'Summary, 2D image, 3D still and 3D model, in one dialog.',
    {
      plates: ['svg', 'png', 'stl', 'stl/jobsRunning', 'fault', 'plaque'],
      usedIn: '1 · 3R',
    },
  ),
  part(
    'COMP',
    'Dialogs',
    'job-list',
    'Job list',
    'Export jobs in a polite live region: label, size, status tag, and a bar while meshing.',
    {
      usedIn: '3S',
    },
  ),
  part(
    'COMP',
    'Dialogs',
    'success-sheet',
    'Success sheet',
    'The hand-off after an export: a check tile, the title, then one row per next step.',
    {
      usedIn: '3U',
    },
  ),
  part(
    'COMP',
    'Dialogs',
    'model-dossier',
    'Model dossier',
    'A printable A4 sheet describing the model. Everything else on the page hides when printing.',
    {
      usedIn: '2E',
    },
  ),
  part(
    'COMP',
    'Cards',
    'readout-card',
    'Readout card',
    'Target lock. Where you are, what you’re looking at and at what scale.',
    {
      usedIn: '1 · 3E',
      spec: [
        row('Width', '300'),
        row('Name', 'Geist 22 / 300', '--lc-fs-title'),
        row('Scale bar', '4 alternating segments, 4 tall'),
        row('Hides', 'Below 700px viewport height'),
      ],
    },
  ),
  part(
    'COMP',
    'Cards',
    'model-card',
    'Model card',
    'A library entry: thumbnail, name with status tags, meta line. The whole card opens; delete is separate.',
    {
      usedIn: '3B',
    },
  ),
  part(
    'COMP',
    'Cards',
    'preset-card',
    'Preset card',
    'One preset as swatch stripes over its name. Pressed marks the applied preset.',
    {
      usedIn: '2H · 3Q',
    },
  ),
  part(
    'COMP',
    'Feedback',
    'fault-card',
    'Fault card',
    'Errors are coded and offer a way forward: one primary fix, then the alternatives.',
    {
      usedIn: '2F · 3P',
      spec: [
        row('Header', 'Diamond · E-NNN · title · metric right'),
        row('Actions', 'Full-width primary, then secondaries'),
      ],
    },
  ),
  part(
    'COMP',
    'Feedback',
    'loader-card',
    'Loader card',
    'Title, percent, detail, a 2px bar and a way out.',
    {
      usedIn: '2F · 3O',
      spec: [row('Bar', '2px progress'), row('Exit', 'CANCEL text button')],
    },
  ),
  part(
    'COMP',
    'Feedback',
    'empty-state',
    'Empty state',
    'Nothing to show yet, and what to do about it.',
    { usedIn: '3B' },
  ),
  part(
    'COMP',
    'Mobile',
    'bottom-sheet',
    'Bottom sheet',
    'The phone inspector: three snaps over a full-bleed map, dragged by its handle.',
    {
      usedIn: '3E–3J',
      spec: [
        row('Snaps', 'Peek · half 55% · full'),
        row('Radius', 'Top corners only', '--lc-r-sheet'),
        row('Motion', undefined, '--lc-dur-sheet'),
      ],
    },
  ),
  part(
    'COMP',
    'Mobile',
    'tab-bar',
    'Tab bar',
    'Four destinations. The active one is bone and carries a short bar on its top edge.',
    {
      usedIn: '3B · 3C · 3D',
      spec: [row('Item', 'Glyph over Mono 8.5'), row('Active', 'Bone + 24 × 2 top bar')],
    },
  ),
];

// === OVERLAYS ===

const overlays: ComponentPart[] = [
  part(
    'OVLY',
    'Frame',
    'hud-layer',
    'HUD layer',
    'Positions every overlay over the viewport, clear of the bars and the inspector. Never takes the pointer itself.',
  ),
  part(
    'OVLY',
    'Frame',
    'hud-frame',
    'HUD frame',
    'Corner brackets, a tick ruler and the camera readout, drawn in ink-3 straight onto the map.',
    {
      usedIn: '1',
      spec: [row('Brackets', '18px, 1px', '--lc-ink-3'), row('Readout', 'Mono 9, 0.12em')],
    },
  ),
  part(
    'OVLY',
    'Frame',
    'crosshair',
    'Crosshair',
    'Full-bleed hairlines through the pointer. It hides whenever the pointer is over UI; move over the empty grid to see it here.',
    {
      usedIn: '1',
      spec: [row('Lines', '1px ink at 0.28'), row('Hide', 'Over any glass surface')],
    },
  ),
  part(
    'OVLY',
    'Frame',
    'coordinate-tip',
    'Coordinate tip',
    'The glass box beside the crosshair with the place under the pointer.',
    {
      usedIn: '1',
      spec: [row('Fill', undefined, '--lc-glass-tip'), row('Offset', '12px below and right')],
    },
  ),
  part(
    'OVLY',
    'Frame',
    'callout-label',
    'Callout label',
    'A small label on a 20px leader above a point on the map.',
  ),
  part(
    'OVLY',
    'Instruments',
    'scale-bar',
    'Scale bar',
    'Four alternating segments with 0 / half / total ticks. 2D only: perspective has no single scale.',
  ),
  part(
    'OVLY',
    'Instruments',
    'compass',
    'Compass',
    'North arrow that turns with the 3D camera, fixed at 0 in the 2D plan.',
  ),
  part(
    'OVLY',
    'Tools',
    'crop-frame',
    'Crop frame',
    'The print area. Everything outside is dimmed, thirds guide the composition, and the size is printed above.',
    {
      usedIn: '2D · 3M',
      spec: [
        row('Surround', undefined, '--lc-crop-surround'),
        row('Thirds', 'Bone 0.25'),
        row('Handles', '24px, 3px strokes'),
      ],
    },
  ),
  part(
    'OVLY',
    'Tools',
    'measure-line',
    'Measure line',
    'A bone line on an ink halo with a tick every tenth and two draggable ends.',
  ),
  part(
    'OVLY',
    'Tools',
    'wipe',
    'A/B wipe',
    'Compare two presets on the same terrain. Drag the handle across.',
    {
      usedIn: '2H',
      spec: [row('Divider', '1px bone'), row('Handle', 'Bone, ⇔')],
    },
  ),
  part(
    'OVLY',
    'Tools',
    'route-line',
    'Route',
    'GPX tracks as a bone line on an ink halo, so they read on any terrain.',
    {
      usedIn: '2I',
      spec: [row('Line', '2.5px bone over 7px ink 0.5 halo'), row('Waypoints', 'Solid diamonds')],
    },
  ),
  part(
    'OVLY',
    'Tools',
    'route-editor',
    'Route editor',
    'Numbered waypoint handles with insert targets on each segment; start square, end diamond.',
    {
      spec: [
        row('Handles', 'Numbered, square start, diamond end'),
        row('Insert', 'Segment midpoints'),
      ],
    },
  ),
  part(
    'OVLY',
    'Readouts',
    'route-profile',
    'Route profile',
    'Elevation against ground distance, with gaps left open and steep spans named as well as coloured.',
    {
      spec: [
        row('Chart', 'Slider; arrows, Home/End, Page keys'),
        row('Steep', 'Climb and descent bands'),
      ],
    },
  ),
  part(
    'OVLY',
    'States',
    'no-data-hatch',
    'No data',
    'Where the source has nothing, the map says so instead of guessing.',
    {
      usedIn: '2F · 3P',
      spec: [row('Fill', undefined, '--lc-hatch'), row('Pairs with', 'Fault card E-204')],
    },
  ),
  part(
    'OVLY',
    'States',
    'tile-resolve',
    'Tile resolve',
    'Tiles fill from the centre outward under a scan line, so you can see the area arriving.',
    {
      usedIn: '2F · 3O',
    },
  ),
];

export const componentParts: ComponentPart[] = [...primitives, ...composites, ...overlays];
