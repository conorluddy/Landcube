import { useState } from 'react';
import { Select, type SelectOption } from './select';
import { defineSpecimens } from './specimens';

const ungroupedOptions: SelectOption<string>[] = [
  { value: 'svg', label: 'SVG' },
  { value: 'png', label: 'PNG' },
  { value: 'stl', label: 'STL' },
];
const groupedOptions: SelectOption<string>[] = [
  {
    group: 'Alps',
    options: [
      { value: 'matterhorn', label: 'Matterhorn' },
      { value: 'eiger', label: 'Eiger' },
    ],
  },
  { group: 'Andes', options: [{ value: 'aconcagua', label: 'Aconcagua' }] },
];
const manyOptions = Array.from({ length: 13 }, (_, index) => `option-${String(index + 1)}`);

function SelectDemo({
  options,
  initialValue,
  label = 'Format',
  disabled,
}: {
  options: SelectOption<string>[];
  initialValue: string;
  label?: string;
  disabled?: boolean;
}): React.JSX.Element {
  const [value, setValue] = useState(initialValue);

  return (
    <Select label={label} value={value} options={options} disabled={disabled} onChange={setValue} />
  );
}

export default defineSpecimens('select', [
  {
    variant: 'ungrouped',
    state: 'default',
    render: () => <SelectDemo initialValue="svg" options={ungroupedOptions} />,
  },
  {
    variant: 'ungrouped',
    state: 'hover',
    render: () => <SelectDemo initialValue="svg" options={ungroupedOptions} />,
  },
  {
    variant: 'ungrouped',
    state: 'focus',
    render: () => <SelectDemo initialValue="svg" options={ungroupedOptions} />,
  },
  {
    variant: 'ungrouped',
    state: 'active',
    render: () => <SelectDemo initialValue="svg" options={ungroupedOptions} />,
  },
  {
    variant: 'ungrouped',
    state: 'disabled',
    render: () => <SelectDemo initialValue="svg" options={ungroupedOptions} disabled />,
  },
  {
    variant: 'grouped',
    render: () => <SelectDemo initialValue="matterhorn" options={groupedOptions} label="Place" />,
  },
  {
    variant: 'many-options',
    render: () => <SelectDemo initialValue="option-1" options={manyOptions} label="Preset" />,
  },
  {
    variant: 'long-label',
    width: 200,
    render: () => (
      <SelectDemo
        initialValue="svg"
        options={ungroupedOptions}
        label="A very long label that has to wrap"
      />
    ),
  },
]);
