import { defineSpecimens } from './specimens';
import { SuccessSheet, type SuccessRow } from './success-sheet';

const noop = (): void => undefined;
const handOffRows: SuccessRow[] = [
  { glyph: '▤', label: 'Files', detail: 'Saved to your downloads folder.', onClick: noop },
  { glyph: '↗', label: 'Share', onClick: noop },
  { glyph: '⎙', label: 'Send to printer', onClick: noop, isDisabled: true, tag: 'Soon' },
  { glyph: '⧉', label: 'Copy style link', onClick: noop },
];

export default defineSpecimens('success-sheet', [
  {
    variant: 'default',
    width: 340,
    render: () => <SuccessSheet title="SVG downloaded" rows={handOffRows} onDone={noop} />,
  },
  {
    variant: 'default',
    state: 'narrow',
    width: 280,
    render: () => (
      <SuccessSheet title="3 frame parts downloaded" rows={handOffRows} onDone={noop} />
    ),
  },
  {
    variant: 'withoutShare',
    width: 340,
    render: () => (
      <SuccessSheet
        title="STL downloaded"
        rows={handOffRows.filter((row) => row.label !== 'Share')}
        onDone={noop}
      />
    ),
  },
]);
