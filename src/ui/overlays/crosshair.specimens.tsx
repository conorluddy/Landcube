import { defineSpecimens } from '../specimens';
import { CoordinateTip } from './coordinate-tip';
import { Crosshair } from './crosshair';
import { HudLayer } from './hud-layer';
import { SpecimenStage } from './specimen-stage';

const position = { xPx: 96, yPx: 56 };

export default defineSpecimens('crosshair', [
  {
    variant: 'tracking',
    size: 'onLight',
    width: 320,
    render: () => (
      <SpecimenStage tone="light" heightPx={160}>
        <HudLayer
          canvasTone="light"
          inspectorState="collapsed"
          pointer={
            <Crosshair position={position}>
              <CoordinateTip lines={['55.0343°N', '8.1130°W']} />
            </Crosshair>
          }
        />
      </SpecimenStage>
    ),
  },
  {
    variant: 'tracking',
    size: 'onDark',
    width: 320,
    render: () => (
      <SpecimenStage tone="dark" heightPx={160}>
        <HudLayer
          canvasTone="dark"
          inspectorState="collapsed"
          pointer={
            <Crosshair position={position}>
              <CoordinateTip lines={['E 4,210 m', 'S 2,305 m']} />
            </Crosshair>
          }
        />
      </SpecimenStage>
    ),
  },
  {
    variant: 'hidden',
    width: 320,
    render: () => (
      <SpecimenStage tone="light" heightPx={160}>
        <HudLayer canvasTone="light" inspectorState="collapsed" pointer={<Crosshair />} />
      </SpecimenStage>
    ),
  },
]);
