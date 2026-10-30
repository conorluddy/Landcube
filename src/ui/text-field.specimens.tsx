import { useState } from 'react';
import { defineSpecimens } from './specimens';
import { TextField } from './text-field';

function Demo({
  initial,
  label = 'Plaque text',
  ...rest
}: {
  initial: string;
  label?: string;
  disabled?: boolean;
  isMonospace?: boolean;
  error?: string;
}): React.JSX.Element {
  const [value, setValue] = useState(initial);

  return <TextField label={label} value={value} onChange={setValue} {...rest} />;
}

export default defineSpecimens('text-field', [
  { variant: 'default', render: () => <Demo initial="Ben Nevis" /> },
  { variant: 'default', state: 'hover', render: () => <Demo initial="Ben Nevis" /> },
  { variant: 'default', state: 'focus', render: () => <Demo initial="Ben Nevis" /> },
  { variant: 'default', state: 'disabled', render: () => <Demo initial="Ben Nevis" disabled /> },
  { variant: 'empty', render: () => <Demo initial="" /> },
  { variant: 'sans', render: () => <Demo initial="Ben Nevis" isMonospace={false} /> },
  {
    variant: 'invalid',
    render: () => <Demo initial="not a link" label="Link" error="Paste a LANDCU.BE design link." />,
  },
  {
    variant: 'default',
    state: 'long',
    render: () => (
      <Demo
        initial="A rather long value that overflows the field"
        label="Plaque text shown beneath the map in the frame"
      />
    ),
  },
  { variant: 'default', state: 'narrow', width: 200, render: () => <Demo initial="Ben Nevis" /> },
]);
