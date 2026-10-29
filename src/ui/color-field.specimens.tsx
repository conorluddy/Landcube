import { useState } from 'react';
import { ColorField } from './color-field';
import { defineSpecimens } from './specimens';

function Demo({
  initial = '#202326',
  label = 'Canvas color',
  disabled = false,
}: {
  initial?: string;
  label?: string;
  disabled?: boolean;
}): React.JSX.Element {
  const [value, setValue] = useState(initial);

  return <ColorField label={label} value={value} onChange={setValue} disabled={disabled} />;
}

export default defineSpecimens('color-field', [
  { variant: 'default', render: () => <Demo /> },
  { variant: 'default', state: 'hover', render: () => <Demo /> },
  { variant: 'default', state: 'focus', render: () => <Demo /> },
  { variant: 'default', state: 'active', render: () => <Demo /> },
  { variant: 'default', state: 'disabled', render: () => <Demo disabled /> },
  { variant: 'light-value', render: () => <Demo initial="#f2f2f0" label="Line color" /> },
  {
    variant: 'default',
    state: 'long',
    render: () => <Demo label="Background color behind the entire printed composition" />,
  },
  { variant: 'default', state: 'narrow', width: 200, render: () => <Demo /> },
]);
