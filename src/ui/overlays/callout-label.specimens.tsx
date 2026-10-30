import { defineSpecimens } from '../specimens';
import { CalloutLabel } from './callout-label';
import { SpecimenStage } from './specimen-stage';

export default defineSpecimens('callout-label', [
  {
    variant: 'distance',
    width: 260,
    render: () => (
      <SpecimenStage tone="light" heightPx={110}>
        <CalloutLabel anchor={{ xPx: 130, yPx: 90 }} value="850 m" meta={['Bearing 312°']} />
      </SpecimenStage>
    ),
  },
  {
    variant: 'offTerrain',
    width: 260,
    render: () => (
      <SpecimenStage tone="dark" heightPx={110}>
        <CalloutLabel anchor={{ xPx: 130, yPx: 90 }} value="—" meta={['Off terrain']} />
      </SpecimenStage>
    ),
  },
]);
