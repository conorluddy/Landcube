import { defineSpecimens } from '../specimens';
import { RouteLine } from './route-line';
import { SpecimenStage } from './specimen-stage';

const points = [
  { x: 24, y: 128 },
  { x: 76, y: 96 },
  { x: 128, y: 104 },
  { x: 176, y: 56 },
  { x: 232, y: 40 },
];
const waypoints = [
  { x: 24, y: 128, name: 'Start hut' },
  { x: 176, y: 56, name: 'Summit' },
];

function renderRoute(tone: 'light' | 'dark', routeWaypoints: typeof waypoints) {
  return (
    <SpecimenStage tone={tone} heightPx={160}>
      <RouteLine
        widthPx={256}
        heightPx={160}
        points={points}
        waypoints={routeWaypoints}
        label="Route: Ridge walk"
      />
    </SpecimenStage>
  );
}

export default defineSpecimens('route-line', [
  {
    variant: 'waypoints',
    size: 'onDark',
    width: 256,
    render: () => renderRoute('dark', waypoints),
  },
  {
    variant: 'waypoints',
    size: 'onLight',
    width: 256,
    render: () => renderRoute('light', waypoints),
  },
  { variant: 'lineOnly', width: 256, render: () => renderRoute('dark', []) },
]);
