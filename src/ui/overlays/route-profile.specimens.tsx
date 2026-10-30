import { defineSpecimens } from '../specimens';
import { RouteProfile, type RouteProfileProps } from './route-profile';
import { SpecimenStage } from './specimen-stage';

const point = { latitude: 55, longitude: -8 };
const samples = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((index) => ({
  distanceMeters: index * 500,
  point,
  elevationMeters: index === 5 ? undefined : 120 + 90 * Math.sin(index / 1.6),
}));
const baseProps: RouteProfileProps = {
  summary: {
    status: 'ready',
    ground: '4.0 km',
    surface: '4.1 km',
    ascent: '210 m',
    descent: '95 m',
    net: '+115 m',
    isPartial: false,
    isTerrainDerived: false,
  },
  profile: {
    groundMeters: 4000,
    samples,
    steepSections: [
      { startMeters: 500, endMeters: 1500, direction: 'climb' },
      { startMeters: 3000, endMeters: 3500, direction: 'descent' },
    ],
  },
  slopeThresholdPercent: 15,
  isCollapsed: false,
  onCollapsedChange: () => undefined,
  onInspect: () => undefined,
  onThresholdChange: () => undefined,
};

function renderProfile(tone: 'light' | 'dark', props: Partial<RouteProfileProps>) {
  return (
    <SpecimenStage tone={tone} heightPx={230}>
      <div style={{ position: 'absolute', inset: 12 }}>
        <RouteProfile {...baseProps} {...props} />
      </div>
    </SpecimenStage>
  );
}

export default defineSpecimens('route-profile', [
  { variant: 'gapAndBands', size: 'onDark', width: 720, render: () => renderProfile('dark', {}) },
  {
    variant: 'gapAndBands',
    size: 'onLight',
    width: 720,
    render: () => renderProfile('light', {}),
  },
  {
    variant: 'inspecting',
    width: 720,
    render: () => renderProfile('dark', { inspectedDistanceMeters: 1800 }),
  },
  { variant: 'collapsed', width: 720, render: () => renderProfile('dark', { isCollapsed: true }) },
  {
    variant: 'incomplete',
    width: 720,
    render: () =>
      renderProfile('dark', {
        summary: { status: 'incomplete', isPartial: false, isTerrainDerived: false },
        profile: undefined,
      }),
  },
]);
