import { defineSpecimens } from '../specimens';
import { CalloutLabel } from './callout-label';
import { MeasureLine } from './measure-line';
import { SpecimenStage } from './specimen-stage';

const noop = () => undefined;

export default defineSpecimens('measure-line', [
  {
    variant: 'measured',
    width: 520,
    render: () => (
      <SpecimenStage tone="light" heightPx={240}>
        <MeasureLine
          start={{ xPx: 80, yPx: 180 }}
          end={{ xPx: 420, yPx: 90 }}
          onSurfacePointer={noop}
          onEndpointMove={noop}
        >
          <CalloutLabel anchor={{ xPx: 250, yPx: 135 }} value="3.75 km" meta={['Bearing 075°']} />
        </MeasureLine>
      </SpecimenStage>
    ),
  },
  {
    variant: 'anchored',
    width: 520,
    render: () => (
      <SpecimenStage tone="dark" heightPx={160}>
        <MeasureLine start={{ xPx: 120, yPx: 80 }} onSurfacePointer={noop} onEndpointMove={noop} />
      </SpecimenStage>
    ),
  },
]);
