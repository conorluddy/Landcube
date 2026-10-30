import { defineSpecimens } from '../specimens';
import { HudFrame } from './hud-frame';
import { HudLayer } from './hud-layer';
import { SpecimenStage } from './specimen-stage';

const cameraReadouts = ['View 3D · Orbit', 'FOV 38°', 'AZ 312°', 'EL 34°'];

export default defineSpecimens('hud-frame', [
  {
    variant: 'orbit',
    size: 'onLight',
    width: 640,
    render: () => (
      <SpecimenStage tone="light" heightPx={240}>
        <HudLayer
          canvasTone="light"
          inspectorState="collapsed"
          frame={<HudFrame readouts={cameraReadouts} trailingReadout="Contour 20 m" />}
        />
      </SpecimenStage>
    ),
  },
  {
    variant: 'plan',
    size: 'onDark',
    width: 640,
    render: () => (
      <SpecimenStage tone="dark" heightPx={240}>
        <HudLayer
          canvasTone="dark"
          inspectorState="collapsed"
          frame={<HudFrame readouts={['View 2D · Plan']} trailingReadout="12 levels" />}
        />
      </SpecimenStage>
    ),
  },
]);
