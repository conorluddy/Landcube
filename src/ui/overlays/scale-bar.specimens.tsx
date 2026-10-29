import { defineSpecimens } from '../specimens';
import { ScaleBar } from './scale-bar';

export default defineSpecimens('scale-bar', [
  { variant: 'kilometres', width: 300, render: () => <ScaleBar totalKm={2} lengthPx={248} /> },
  { variant: 'subKilometre', width: 300, render: () => <ScaleBar totalKm={0.5} lengthPx={180} /> },
  {
    variant: 'kilometres',
    state: 'narrow',
    width: 120,
    render: () => <ScaleBar totalKm={20} lengthPx={260} />,
  },
]);
