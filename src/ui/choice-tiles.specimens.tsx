import { useState } from 'react';
import { ChoiceTiles, type ChoiceTileColumns, type ChoiceTileOption } from './choice-tiles';
import { defineSpecimens } from './specimens';

const plainOptions: ChoiceTileOption<string>[] = [
  'Tray',
  'Block',
  'Frame',
  'Plinth',
  'Float',
  'None',
].map((label) => ({ value: label.toLowerCase(), label }));
const swatchOptions: ChoiceTileOption<string>[] = [
  { value: 'slate', label: 'Slate', swatchColor: '#202326', swatchBorderColor: '#d9dad7' },
  { value: 'bone', label: 'Bone', swatchColor: '#f2f2f0', swatchBorderColor: '#2a2c2e' },
  { value: 'amber', label: 'Amber', swatchColor: '#ff6a13', swatchBorderColor: '#2a2c2e' },
];
const thumbnailOptions: ChoiceTileOption<string>[] = [
  { value: 'flat', label: 'Flat', description: 'Flat edge', thumbnail: <Thumbnail radius={0} /> },
  { value: 'soft', label: 'Soft', description: 'Soft edge', thumbnail: <Thumbnail radius={6} /> },
  {
    value: 'round',
    label: 'Round',
    description: 'Round edge',
    thumbnail: <Thumbnail radius={12} />,
  },
];

function Thumbnail({ radius }: { radius: number }): React.JSX.Element {
  return (
    <svg width="40" height="26" viewBox="0 0 40 26">
      <rect x="1" y="1" width="38" height="24" rx={radius} fill="none" stroke="currentColor" />
    </svg>
  );
}

interface DemoProps {
  options: ChoiceTileOption<string>[];
  columns: ChoiceTileColumns;
  disabled?: boolean;
  isComputed?: boolean;
}

function ChoiceTilesDemo({ options, columns, disabled, isComputed }: DemoProps): React.JSX.Element {
  const [value, setValue] = useState(options[0]?.value ?? '');
  // Computed mode marks the first two tiles pressed, like a palette preset spanning several keys.
  const computedValues = options.slice(0, 2).map((option) => option.value);

  return (
    <ChoiceTiles
      label="Choice"
      value={value}
      options={options}
      columns={columns}
      disabled={disabled}
      isPressedComputed={
        isComputed === true ? (option) => computedValues.includes(option.value) : undefined
      }
      onChange={setValue}
    />
  );
}

export default defineSpecimens('choice-tiles', [
  {
    variant: 'columns-3',
    render: () => <ChoiceTilesDemo options={plainOptions.slice(0, 3)} columns={3} />,
  },
  { variant: 'columns-5', render: () => <ChoiceTilesDemo options={plainOptions} columns={5} /> },
  { variant: 'columns-6', render: () => <ChoiceTilesDemo options={plainOptions} columns={6} /> },
  { variant: 'swatch', render: () => <ChoiceTilesDemo options={swatchOptions} columns={3} /> },
  {
    variant: 'thumbnail',
    render: () => <ChoiceTilesDemo options={thumbnailOptions} columns={3} />,
  },
  {
    variant: 'computed-pressed',
    render: () => <ChoiceTilesDemo options={plainOptions} columns={3} isComputed />,
  },
  {
    variant: 'columns-3',
    state: 'hover',
    render: () => <ChoiceTilesDemo options={plainOptions.slice(0, 3)} columns={3} />,
  },
  {
    variant: 'columns-3',
    state: 'focus',
    render: () => <ChoiceTilesDemo options={plainOptions.slice(0, 3)} columns={3} />,
  },
  {
    variant: 'columns-3',
    state: 'active',
    render: () => <ChoiceTilesDemo options={plainOptions.slice(0, 3)} columns={3} />,
  },
  {
    variant: 'columns-3',
    state: 'disabled',
    render: () => <ChoiceTilesDemo options={plainOptions.slice(0, 3)} columns={3} disabled />,
  },
  {
    variant: 'long-labels',
    width: 200,
    render: () => (
      <ChoiceTilesDemo
        columns={3}
        options={[
          { value: 'a', label: 'Extraordinarily long tile label' },
          { value: 'b', label: 'Short' },
          { value: 'c', label: 'Another lengthy one' },
        ]}
      />
    ),
  },
]);
