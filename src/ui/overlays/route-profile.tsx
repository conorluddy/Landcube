import { useId, type KeyboardEvent, type PointerEvent } from 'react';
import {
  maximumSlopeThresholdPercent,
  minimumSlopeThresholdPercent,
} from '../../constants/route-analysis';
import { validateSlopeThresholdPercent } from '../../route-analysis';
import type { RouteSummary } from '../../studio/route-overlay';
import { formatRouteDistance, formatRouteElevation } from '../../studio/route-overlay';
import type { ProfileSample, SteepSection } from '../../types/terrain-analysis';
import { NumberField } from '../number-field';

export interface RouteProfileData {
  groundMeters: number;
  samples: readonly ProfileSample[];
  steepSections: readonly SteepSection[];
}

export interface RouteProfileProps {
  summary: RouteSummary;
  /** Absent while the route has fewer than two points. */
  profile?: RouteProfileData;
  slopeThresholdPercent: number;
  inspectedDistanceMeters?: number;
  isCollapsed: boolean;
  onCollapsedChange: (isCollapsed: boolean) => void;
  /** Undefined clears the inspection (pointer left, focus lost). */
  onInspect: (distanceMeters: number | undefined) => void;
  onThresholdChange: (percent: number) => void;
}

const chartWidth = 1000;
const chartHeight = 200;
const keyboardStepFraction = 0.01;
const keyboardPageFraction = 0.1;

/**
 * Elevation profile of the active route (O-10): summary figures in the header, then an area chart
 * of elevation against ground distance. Gaps stay gaps, steep spans carry a colour and a text
 * label, and the chart is a slider that inspects the route at a distance. `data-route-profile`
 * and `data-route-cursor` are the test hooks.
 */
export function RouteProfile({
  summary,
  profile,
  slopeThresholdPercent,
  inspectedDistanceMeters,
  isCollapsed,
  onCollapsedChange,
  onInspect,
  onThresholdChange,
}: RouteProfileProps): React.JSX.Element {
  const bodyId = useId();

  return (
    <section
      className="lc-route-profile lc-glass"
      aria-label="Route profile"
      data-route-profile={isCollapsed ? 'collapsed' : 'open'}
      data-ui-surface
    >
      <header className="lc-route-profile__header">
        <button
          type="button"
          className="lc-route-profile__toggle"
          aria-expanded={!isCollapsed}
          aria-controls={bodyId}
          aria-label={isCollapsed ? 'Expand route profile' : 'Collapse route profile'}
          onClick={() => {
            onCollapsedChange(!isCollapsed);
          }}
        >
          <span aria-hidden="true">{isCollapsed ? '▴' : '▾'}</span>
        </button>
        <SummaryFigures summary={summary} />
      </header>
      <div id={bodyId} className="lc-route-profile__body" hidden={isCollapsed}>
        {profile === undefined ? (
          <p className="lc-route-profile__empty">Place at least two waypoints to see a profile.</p>
        ) : (
          <ProfileChart
            profile={profile}
            inspectedDistanceMeters={inspectedDistanceMeters}
            onInspect={onInspect}
          />
        )}
        <div className="lc-route-profile__threshold">
          <NumberField
            label="Steep threshold"
            unit="%"
            value={slopeThresholdPercent}
            min={minimumSlopeThresholdPercent}
            max={maximumSlopeThresholdPercent}
            step={1}
            onChange={(percent) => commitSlopeThreshold(percent, onThresholdChange)}
          />
        </div>
      </div>
    </section>
  );
}

// === PURE LOGIC ===

/** Applies a threshold only when it is 1-100%; false makes the field show its error (REQ-28). */
export function commitSlopeThreshold(
  percent: number | undefined,
  apply: (percent: number) => void,
): boolean {
  const result = validateSlopeThresholdPercent(percent ?? Number.NaN);

  if (!result.ok) {
    return false;
  }

  apply(result.data);

  return true;
}

/** Contiguous runs of samples that have an elevation; a missing one ends the run (REQ-31). */
export function splitElevationRuns(samples: readonly ProfileSample[]): ProfileSample[][] {
  const runs: ProfileSample[][] = [];
  let run: ProfileSample[] = [];

  for (const sample of samples) {
    if (sample.elevationMeters === undefined) {
      if (run.length > 0) {
        runs.push(run);
        run = [];
      }
    } else {
      run.push(sample);
    }
  }

  if (run.length > 0) {
    runs.push(run);
  }

  return runs;
}

/** Keyboard target for a slider key, or undefined when the key is not one the chart handles. */
export function moveInspection(
  key: string,
  currentMeters: number,
  groundMeters: number,
): number | undefined {
  const step = groundMeters * keyboardStepFraction;
  const page = groundMeters * keyboardPageFraction;
  const targets: Partial<Record<string, number>> = {
    ArrowRight: currentMeters + step,
    ArrowUp: currentMeters + step,
    ArrowLeft: currentMeters - step,
    ArrowDown: currentMeters - step,
    PageUp: currentMeters + page,
    PageDown: currentMeters - page,
    Home: 0,
    End: groundMeters,
  };
  const target = targets[key];

  return target === undefined ? undefined : Math.min(groundMeters, Math.max(0, target));
}

/** 1/2/5 x 10^n tick values covering [low, high]. */
export function chooseTicks(low: number, high: number, approximateCount: number): number[] {
  const span = Math.max(high - low, 1e-9);
  const rough = span / approximateCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 5, 10].find((multiple) => multiple * magnitude >= rough) ?? 10) * magnitude;
  const ticks: number[] = [];

  for (let tick = Math.floor(low / step) * step; tick < high + step; tick += step) {
    ticks.push(Math.round(tick / step) * step);

    if (tick >= high) {
      break;
    }
  }

  return ticks;
}

// === PARTS ===

function SummaryFigures({ summary }: { summary: RouteSummary }): React.JSX.Element {
  if (summary.status === 'incomplete') {
    return <p className="lc-route-profile__incomplete">Incomplete route</p>;
  }

  const figures: [string, string | undefined][] = [
    ['Ground', summary.ground],
    ['Surface', summary.surface],
    ['Ascent', summary.ascent],
    ['Descent', summary.descent],
    ['Net', summary.net],
  ];

  return (
    <>
      <dl className="lc-route-profile__figures">
        {figures.map(([name, value]) =>
          value === undefined ? null : (
            <div key={name} className="lc-route-profile__figure">
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ),
        )}
      </dl>
      <p className="lc-route-profile__flags">
        {summary.isPartial && (
          <span
            className="lc-route-profile__flag"
            title="Spans without elevation data are excluded"
          >
            Partial
          </span>
        )}
        {summary.isTerrainDerived && (
          <span className="lc-route-profile__flag">Terrain-derived</span>
        )}
      </p>
    </>
  );
}

function ProfileChart({
  profile,
  inspectedDistanceMeters,
  onInspect,
}: {
  profile: RouteProfileData;
  inspectedDistanceMeters?: number;
  onInspect: (distanceMeters: number | undefined) => void;
}): React.JSX.Element {
  const { groundMeters, samples, steepSections } = profile;
  const elevations = samples.flatMap(({ elevationMeters }) =>
    elevationMeters === undefined ? [] : [elevationMeters],
  );
  const hasElevation = elevations.length > 0;
  const elevationTicks = hasElevation
    ? chooseTicks(Math.min(...elevations), Math.max(...elevations), 3)
    : [];
  const floorMeters = elevationTicks[0] ?? 0;
  const ceilingMeters = Math.max(elevationTicks.at(-1) ?? 1, floorMeters + 1);
  const distanceTicks = chooseTicks(0, groundMeters, 4).filter((tick) => tick <= groundMeters);
  const toX = (distanceMeters: number): number =>
    groundMeters === 0 ? 0 : (distanceMeters / groundMeters) * chartWidth;
  const toY = (elevationMeters: number): number =>
    chartHeight * (1 - (elevationMeters - floorMeters) / (ceilingMeters - floorMeters));
  const toPercent = (distanceMeters: number): string =>
    `${groundMeters === 0 ? 0 : (distanceMeters / groundMeters) * 100}%`;
  const runs = splitElevationRuns(samples);
  const inspected = inspectedDistanceMeters;

  const inspectAt = (event: PointerEvent<HTMLDivElement>): void => {
    const box = event.currentTarget.getBoundingClientRect();

    if (box.width > 0) {
      const fraction = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));

      onInspect(fraction * groundMeters);
    }
  };

  const inspectKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    const target = moveInspection(event.key, inspected ?? 0, groundMeters);

    if (target !== undefined) {
      event.preventDefault();
      onInspect(target);
    }
  };

  return (
    <div className="lc-route-profile__chart">
      <div className="lc-route-profile__y-axis" aria-hidden="true">
        {elevationTicks.map((tick) => (
          <span key={tick} style={{ top: `${(toY(tick) / chartHeight) * 100}%` }}>
            {formatRouteElevation(tick)}
          </span>
        ))}
      </div>
      <div
        className="lc-route-profile__plot"
        role="slider"
        tabIndex={0}
        aria-label="Inspect route profile"
        aria-valuemin={0}
        aria-valuemax={Math.round(groundMeters)}
        aria-valuenow={Math.round(inspected ?? 0)}
        aria-valuetext={describeInspection(samples, inspected)}
        onPointerMove={inspectAt}
        onPointerDown={inspectAt}
        onPointerLeave={(event) => {
          // A lifted finger leaves too; touch keeps its marker until the next touch.
          if (event.pointerType !== 'touch') {
            onInspect(undefined);
          }
        }}
        onPointerCancel={() => {
          onInspect(undefined);
        }}
        onBlur={() => {
          onInspect(undefined);
        }}
        onKeyDown={inspectKey}
      >
        <svg
          className="lc-route-profile__svg"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {elevationTicks.map((tick) => (
            <line
              key={tick}
              className="lc-route-profile__grid"
              x1={0}
              x2={chartWidth}
              y1={toY(tick)}
              y2={toY(tick)}
            />
          ))}
          {steepSections.map((section) => (
            <rect
              key={`${section.direction}-${section.startMeters}`}
              className={`lc-route-profile__band lc-route-profile__band--${section.direction}`}
              x={toX(section.startMeters)}
              width={Math.max(toX(section.endMeters) - toX(section.startMeters), 1)}
              y={0}
              height={chartHeight}
            />
          ))}
          {runs.map((run) => {
            const points = run.map(
              ({ distanceMeters, elevationMeters = 0 }) =>
                `${toX(distanceMeters).toFixed(1)},${toY(elevationMeters).toFixed(1)}`,
            );
            const first = run[0];
            const last = run[run.length - 1];

            return (
              <g key={first.distanceMeters} data-profile-run={run.length}>
                <polygon
                  className="lc-route-profile__area"
                  points={`${toX(first.distanceMeters).toFixed(1)},${chartHeight} ${points.join(' ')} ${toX(last.distanceMeters).toFixed(1)},${chartHeight}`}
                />
                <polyline className="lc-route-profile__line" points={points.join(' ')} />
              </g>
            );
          })}
        </svg>
        {steepSections.map((section) => (
          <span
            key={`${section.direction}-${section.startMeters}`}
            className={`lc-route-profile__band-label lc-route-profile__band-label--${section.direction}`}
            style={{
              left: toPercent(section.startMeters),
              width: toPercent(section.endMeters - section.startMeters),
            }}
          >
            {section.direction === 'climb' ? 'Steep climb' : 'Steep descent'}
          </span>
        ))}
        {!hasElevation && <p className="lc-route-profile__no-data">No elevation data</p>}
        {inspected !== undefined && (
          <span
            className="lc-route-profile__cursor"
            data-route-cursor={Math.round(inspected)}
            style={{ left: toPercent(inspected) }}
          />
        )}
      </div>
      <div className="lc-route-profile__x-axis" aria-hidden="true">
        {distanceTicks.map((tick) => (
          <span key={tick} style={{ left: toPercent(tick) }}>
            {formatRouteDistance(tick)}
          </span>
        ))}
      </div>
    </div>
  );
}

function describeInspection(
  samples: readonly ProfileSample[],
  distanceMeters: number | undefined,
): string {
  if (distanceMeters === undefined) {
    return 'Not inspecting';
  }

  const nearest = samples.reduce<ProfileSample | undefined>(
    (best, sample) =>
      best === undefined ||
      Math.abs(sample.distanceMeters - distanceMeters) <
        Math.abs(best.distanceMeters - distanceMeters)
        ? sample
        : best,
    undefined,
  );
  const elevation =
    nearest?.elevationMeters === undefined
      ? 'no elevation data'
      : `elevation ${formatRouteElevation(nearest.elevationMeters)}`;

  return `${formatRouteDistance(distanceMeters)}, ${elevation}`;
}
