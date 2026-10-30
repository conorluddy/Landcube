import { defineSpecimens } from '../specimens';
import { SpecimenStage } from './specimen-stage';
import { Wipe } from './wipe';

const sideBMarkup =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160" preserveAspectRatio="none"><rect width="320" height="160" fill="#153c68"/><path d="M0,120C80,60 160,150 320,40M0,90C80,30 160,120 320,10" fill="none" stroke="#b9dbf5" stroke-width="1"/></svg>';

export default defineSpecimens('wipe', [
  {
    variant: 'midpoint',
    width: 320,
    render: () => (
      <SpecimenStage tone="dark" heightPx={160}>
        <Wipe
          sideBMarkup={sideBMarkup}
          sideBBackground="#153c68"
          dividerFraction={0.5}
          onDividerChange={() => undefined}
          inspectorState="collapsed"
        />
      </SpecimenStage>
    ),
  },
  {
    variant: 'previewing',
    width: 320,
    render: () => (
      <SpecimenStage tone="dark" heightPx={160}>
        <Wipe
          sideBMarkup={sideBMarkup}
          sideBBackground="#153c68"
          dividerFraction={0.3}
          onDividerChange={() => undefined}
          inspectorState="collapsed"
          isInteractive={false}
        />
      </SpecimenStage>
    ),
  },
]);
