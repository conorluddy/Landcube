import { useState } from 'react';
import { defineSpecimens, type SpecimenEntry, type SpecimenState } from './specimens';
import { ValueChip } from './value-chip';

function ValueChipDemo({
  initialSelected = false,
  label = '25 M',
  disabled,
}: {
  initialSelected?: boolean;
  label?: string;
  disabled?: boolean;
}): React.JSX.Element {
  const [isSelected, setIsSelected] = useState(initialSelected);

  return (
    <ValueChip
      label={label}
      isSelected={isSelected}
      disabled={disabled}
      onClick={() => {
        setIsSelected((current) => !current);
      }}
    />
  );
}

const states: SpecimenState[] = ['default', 'hover', 'focus', 'active', 'disabled'];
const stateEntries: SpecimenEntry[] = [
  { variant: 'unselected', isSelected: false },
  { variant: 'selected', isSelected: true },
].flatMap(({ variant, isSelected }) =>
  states.map((state) => ({
    variant,
    state,
    render: () => <ValueChipDemo initialSelected={isSelected} disabled={state === 'disabled'} />,
  })),
);

export default defineSpecimens('value-chip', [
  ...stateEntries,
  {
    variant: 'long-label',
    width: 120,
    render: () => <ValueChipDemo label="A very long quick value" />,
  },
]);
