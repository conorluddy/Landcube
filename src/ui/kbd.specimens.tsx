import { Kbd } from './kbd';
import { defineSpecimens } from './specimens';

export default defineSpecimens('kbd', [
  { variant: 'single', render: () => <Kbd keys={['↵']} label="Enter" /> },
  { variant: 'chord', render: () => <Kbd keys={['⌘', 'K']} label="Command K" /> },
  {
    variant: 'chord',
    state: 'long',
    width: 160,
    render: () => <Kbd keys={['Ctrl', 'Shift', 'Alt', 'Option', 'P']} />,
  },
]);
