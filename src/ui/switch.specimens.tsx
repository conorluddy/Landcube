import { useState } from 'react';
import { defineSpecimens, type SpecimenEntry, type SpecimenState } from './specimens';
import { Switch } from './switch';

interface DemoProps {
  initialValue: boolean;
  label?: string;
  description?: string;
  disabled?: boolean;
}

function SwitchDemo({
  initialValue,
  label = 'Lock seed',
  description,
  disabled,
}: DemoProps): React.JSX.Element {
  const [value, setValue] = useState(initialValue);

  return (
    <Switch
      label={label}
      value={value}
      description={description}
      disabled={disabled}
      onChange={setValue}
    />
  );
}

const states: SpecimenState[] = ['default', 'hover', 'focus', 'active', 'disabled'];
const stateEntries: SpecimenEntry[] = [
  { variant: 'off', isOn: false },
  { variant: 'on', isOn: true },
].flatMap(({ variant, isOn }) =>
  states.map((state) => ({
    variant,
    state,
    render: () => <SwitchDemo initialValue={isOn} disabled={state === 'disabled'} />,
  })),
);

export default defineSpecimens('switch', [
  ...stateEntries,
  {
    variant: 'long-label',
    width: 200,
    render: () => (
      <SwitchDemo initialValue label="Show a very long label that has to wrap onto several lines" />
    ),
  },
  {
    variant: 'description',
    width: 240,
    render: () => (
      <SwitchDemo
        initialValue={false}
        description="Keeps the terrain stable when you shuffle the palette."
      />
    ),
  },
]);
