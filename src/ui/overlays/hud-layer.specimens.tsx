import { defineSpecimens } from '../specimens';
import { Compass } from './compass';
import { CoordinateTip } from './coordinate-tip';
import { Crosshair } from './crosshair';
import { HudFrame } from './hud-frame';
import { HudLayer } from './hud-layer';
import { ReadoutCard } from './readout-card';
import { ScaleBar } from './scale-bar';
import { SpecimenStage } from './specimen-stage';

export default defineSpecimens('hud-layer', [
  {
    variant: 'composed',
    width: 760,
    render: () => (
      <SpecimenStage tone="light" heightPx={460}>
        <HudLayer
          canvasTone="light"
          inspectorState="collapsed"
          pointer={
            <Crosshair position={{ xPx: 480, yPx: 160 }}>
              <CoordinateTip lines={['55.0343°N', '8.1130°W']} />
            </Crosshair>
          }
          frame={<HudFrame readouts={['View 2D · Plan']} trailingReadout="Contour 20 m" />}
          instruments={
            <>
              <ScaleBar totalKm={1} lengthPx={96} />
              <Compass headingDegrees={0} />
            </>
          }
          readout={
            <ReadoutCard
              title="Errigal"
              place="Ireland"
              sourceLabel="EU-DEM"
              signalKind="ok"
              cells={[
                { label: 'Lat', value: '55.0343°N' },
                { label: 'Lon', value: '8.1130°W' },
              ]}
            />
          }
        />
      </SpecimenStage>
    ),
  },
]);
