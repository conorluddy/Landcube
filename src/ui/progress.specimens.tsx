import { Progress } from './progress';
import { defineSpecimens } from './specimens';

export default defineSpecimens('progress', [
  { variant: 'empty', render: () => <Progress fraction={0} label="Export" /> },
  { variant: 'partial', render: () => <Progress fraction={0.42} label="Export" /> },
  { variant: 'full', render: () => <Progress fraction={1} label="Export" /> },
  { variant: 'outOfRange', render: () => <Progress fraction={Number.NaN} label="Export" /> },
  {
    variant: 'indeterminate',
    render: () => <Progress fraction={0} label="Loading" isIndeterminate />,
  },
  {
    variant: 'partial',
    state: 'narrow',
    width: 160,
    render: () => <Progress fraction={0.42} label="Export" />,
  },
]);
