import { ReadoutCell, ReadoutGrid } from './readout-grid';
import { defineSpecimens } from './specimens';

export default defineSpecimens('readout-grid', [
  {
    variant: 'filled',
    width: 300,
    render: () => (
      <ReadoutGrid>
        <ReadoutCell label="Elevation" value="412" unit="m" />
        <ReadoutCell label="Slope" value="12.4" unit="deg" />
        <ReadoutCell label="Lat" value="53.3498" />
        <ReadoutCell label="Lon" value="-6.2603" />
      </ReadoutGrid>
    ),
  },
  {
    variant: 'empty',
    width: 300,
    render: () => (
      <ReadoutGrid>
        <ReadoutCell label="Elevation" unit="m" />
        <ReadoutCell label="Slope" value="" unit="deg" />
      </ReadoutGrid>
    ),
  },
  {
    variant: 'nonTabular',
    width: 300,
    render: () => (
      <ReadoutGrid>
        <ReadoutCell label="Source" value="Terrarium" isTabular={false} />
        <ReadoutCell label="Tiles" value="1111" />
      </ReadoutGrid>
    ),
  },
  {
    variant: 'filled',
    state: 'narrow',
    width: 160,
    render: () => (
      <ReadoutGrid>
        <ReadoutCell label="Elevation above sea level" value="412.55" unit="metres" />
        <ReadoutCell label="Slope" value="12.4" unit="deg" />
      </ReadoutGrid>
    ),
  },
]);
