import { useState } from 'react';
import { FieldPair } from './field-pair';
import { NumberField } from './number-field';
import { defineSpecimens } from './specimens';

function Demo(): React.JSX.Element {
  const [width, setWidth] = useState<number | undefined>(1200);
  const [height, setHeight] = useState<number | undefined>(800);

  return (
    <FieldPair>
      <NumberField label="Width" unit="px" value={width} onChange={setWidth} />
      <NumberField label="Height" unit="px" value={height} onChange={setHeight} />
    </FieldPair>
  );
}

export default defineSpecimens('field-pair', [
  { variant: 'default', width: 396, render: () => <Demo /> },
  { variant: 'default', state: 'narrow', width: 200, render: () => <Demo /> },
  { variant: 'default', state: 'just-under', width: 263, render: () => <Demo /> },
  { variant: 'default', state: 'at-threshold', width: 264, render: () => <Demo /> },
]);
