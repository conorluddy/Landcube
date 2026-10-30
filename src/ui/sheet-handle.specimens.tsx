import { useState } from 'react';
import { defineSpecimens } from './specimens';
import { SheetHandle, type SheetSnap } from './sheet-handle';

/** Stateful so keyboard journeys can watch aria-valuetext change. */
function StatefulSheetHandle({ initialSnap }: { initialSnap: SheetSnap }): React.JSX.Element {
  const [snap, setSnap] = useState<SheetSnap>(initialSnap);

  return <SheetHandle snap={snap} onSnapChange={setSnap} controlsId="specimen-sheet" />;
}

export default defineSpecimens('sheet-handle', [
  { variant: 'peek', render: () => <StatefulSheetHandle initialSnap="peek" /> },
  { variant: 'half', render: () => <StatefulSheetHandle initialSnap="half" /> },
  { variant: 'full', render: () => <StatefulSheetHandle initialSnap="full" /> },
  { variant: 'half', state: 'hover', render: () => <StatefulSheetHandle initialSnap="half" /> },
  { variant: 'half', state: 'focus', render: () => <StatefulSheetHandle initialSnap="half" /> },
  { variant: 'half', state: 'active', render: () => <StatefulSheetHandle initialSnap="half" /> },
  {
    variant: 'half',
    state: 'narrow',
    width: 160,
    render: () => <StatefulSheetHandle initialSnap="half" />,
  },
]);
