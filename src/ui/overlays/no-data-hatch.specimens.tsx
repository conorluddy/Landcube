import { defineSpecimens } from '../specimens';
import { NoDataHatch } from './no-data-hatch';

export default defineSpecimens('no-data-hatch', [
  {
    variant: 'default',
    render: () => (
      <div style={{ position: 'relative', width: 240, height: 160 }}>
        <NoDataHatch />
      </div>
    ),
  },
  {
    variant: 'customLabel',
    render: () => (
      <div style={{ position: 'relative', width: 160, height: 96 }}>
        <NoDataHatch label="Void" />
      </div>
    ),
  },
]);
