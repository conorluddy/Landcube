import { useState } from 'react';
import { Checkbox } from './checkbox';
import { defineSpecimens, type SpecimenEntry, type SpecimenState } from './specimens';

interface DemoProps {
  initialValue: boolean;
  label?: string;
  detail?: string;
  disabled?: boolean;
}

function CheckboxDemo({
  initialValue,
  label = 'Terrain model',
  detail,
  disabled,
}: DemoProps): React.JSX.Element {
  const [value, setValue] = useState(initialValue);

  return (
    <Checkbox label={label} value={value} detail={detail} disabled={disabled} onChange={setValue} />
  );
}

const states: SpecimenState[] = ['default', 'hover', 'focus', 'active', 'disabled'];
const stateEntries: SpecimenEntry[] = [
  { variant: 'unchecked', isChecked: false },
  { variant: 'checked', isChecked: true },
].flatMap(({ variant, isChecked }) =>
  states.map((state) => ({
    variant,
    state,
    render: () => <CheckboxDemo initialValue={isChecked} disabled={state === 'disabled'} />,
  })),
);

export default defineSpecimens('checkbox', [
  ...stateEntries,
  {
    variant: 'detail',
    width: 260,
    render: () => <CheckboxDemo initialValue detail="12.4 MB" />,
  },
  {
    variant: 'long-label',
    width: 200,
    render: () => (
      <CheckboxDemo
        initialValue
        detail="12.4 MB"
        label="Include the engraved plaque and every optional part"
      />
    ),
  },
]);
