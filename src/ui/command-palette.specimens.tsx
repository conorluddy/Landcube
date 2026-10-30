import { CommandPalette, type CommandPaletteProps, type CommandResult } from './command-palette';
import { defineSpecimens } from './specimens';

const mixedResults: CommandResult[] = [
  {
    kind: 'parameter',
    id: 'terrain-contour-interval',
    label: 'Interval (m)',
    code: 'CONT.01',
    detail: '20 m',
  },
  {
    kind: 'parameter',
    id: 'terrain-contour-mode',
    label: 'Interval mode',
    code: 'CONT.01',
    detail: 'Fixed interval',
  },
  { kind: 'location', id: 'location-0', label: 'Interlaken', detail: 'Bern, Switzerland' },
  { kind: 'action', id: 'action-section-contours', label: 'Go to Contours', code: 'CONT' },
];

const longResults: CommandResult[] = [
  {
    kind: 'parameter',
    id: 'terrain-elevation-floor',
    label: 'Elevation floor in metres, optional, for trimming coastal source artefacts',
    code: 'TERR.03',
    detail: 'None (source minimum elevation)',
  },
  {
    kind: 'location',
    id: 'location-0',
    label: 'Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch',
    detail: 'Isle of Anglesey, Wales, United Kingdom',
  },
];

const quickValues = [
  { label: '1 m', value: '1' },
  { label: '10 m', value: '10' },
  { label: '20 m', value: '20' },
  { label: '30 m', value: '30' },
  { label: '5000 m', value: '5000' },
];

function Demo(props: Partial<CommandPaletteProps>): React.JSX.Element {
  return (
    <CommandPalette
      isOpen
      query=""
      onQueryChange={() => undefined}
      results={[]}
      activeIndex={-1}
      onActivate={() => undefined}
      onSelect={() => undefined}
      onClose={() => undefined}
      {...props}
    />
  );
}

export default defineSpecimens('command-palette', [
  { variant: 'desktop', state: 'empty', width: 560, render: () => <Demo /> },
  {
    variant: 'desktop',
    state: 'results',
    width: 560,
    render: () => (
      <Demo
        query="inter"
        results={mixedResults}
        activeIndex={0}
        quickValues={quickValues}
        preview={{ label: 'Interval (m)', from: '20 m' }}
      />
    ),
  },
  {
    variant: 'desktop',
    state: 'value-step',
    width: 560,
    render: () => (
      <Demo
        query="interval"
        results={mixedResults.slice(0, 2)}
        activeIndex={0}
        quickValues={quickValues}
        preview={{ label: 'Interval (m)', from: '20 m', to: '25' }}
        valueDraft="25"
      />
    ),
  },
  {
    variant: 'desktop',
    state: 'error',
    width: 560,
    render: () => (
      <Demo
        query="opacity"
        results={[
          {
            kind: 'parameter',
            id: 'strokeOpacity',
            label: 'Opacity',
            code: 'CONT.02',
            detail: '0.29',
          },
        ]}
        activeIndex={0}
        preview={{
          label: 'Opacity',
          from: '0.29',
          to: '7',
          error: 'Opacity takes 0.05 to 1; got "7".',
        }}
      />
    ),
  },
  {
    variant: 'desktop',
    state: 'long',
    width: 560,
    render: () => (
      <Demo
        query="ll"
        results={longResults}
        activeIndex={1}
        preview={{ label: longResults[1].label, from: '53.2240°N 4.1990°W' }}
        status="Searching places…"
      />
    ),
  },
  {
    variant: 'mobile',
    state: 'results',
    width: 390,
    render: () => (
      <Demo
        isMobile
        query="inter"
        results={mixedResults}
        activeIndex={0}
        quickValues={quickValues}
        preview={{ label: 'Interval (m)', from: '20 m' }}
      />
    ),
  },
  {
    variant: 'mobile',
    state: 'empty',
    width: 390,
    render: () => <Demo isMobile query="zzz" status="No matches." />,
  },
]);
