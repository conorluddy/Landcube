import { useState } from 'react';
import { RulerSlider } from './ruler-slider';
import { defineSpecimens } from './specimens';

function Demo({
  initial,
  label = 'Line weight',
  min = 0,
  max = 100,
  step = 1,
  ...rest
}: {
  initial: number;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  displayValue?: string;
  disabled?: boolean;
  id?: string;
}): React.JSX.Element {
  const [value, setValue] = useState(initial);

  return (
    <RulerSlider
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={setValue}
      {...rest}
    />
  );
}

export default defineSpecimens('ruler-slider', [
  { variant: 'default', render: () => <Demo initial={40} id="specimen-slider-default" /> },
  { variant: 'default', state: 'hover', render: () => <Demo initial={40} /> },
  { variant: 'default', state: 'focus', render: () => <Demo initial={40} /> },
  { variant: 'default', state: 'active', render: () => <Demo initial={40} /> },
  { variant: 'default', state: 'disabled', render: () => <Demo initial={40} disabled /> },
  { variant: 'fraction', state: '0', render: () => <Demo initial={0} /> },
  { variant: 'fraction', state: '25', render: () => <Demo initial={25} /> },
  { variant: 'fraction', state: '75', render: () => <Demo initial={75} /> },
  { variant: 'fraction', state: '1', render: () => <Demo initial={100} /> },
  {
    variant: 'fraction',
    state: 'min-equals-max',
    render: () => <Demo initial={5} min={5} max={5} />,
  },
  { variant: 'unit', render: () => <Demo initial={12} label="Delay" min={5} max={60} unit=" s" /> },
  {
    variant: 'display-value',
    render: () => <Demo initial={2} label="Scale" min={0} max={4} displayValue="1:50 000" />,
  },
  {
    variant: 'default',
    state: 'long',
    render: () => (
      <Demo initial={40} label="Terrain detail multiplier for the very high resolution preview" />
    ),
  },
  {
    variant: 'default',
    state: 'narrow',
    width: 200,
    render: () => <Demo initial={40} unit=" m" />,
  },
]);
