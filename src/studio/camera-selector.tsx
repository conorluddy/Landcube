import { useRef, useState, type KeyboardEvent } from 'react';
import type { StudioController } from './controller';
import './camera-selector.css';

const directions = [
  { name: 'North', label: 'N', azimuth: 180 },
  { name: 'Northeast', label: 'NE', azimuth: 135 },
  { name: 'East', label: 'E', azimuth: 90 },
  { name: 'Southeast', label: 'SE', azimuth: 45 },
  { name: 'South', label: 'S', azimuth: 0 },
  { name: 'Southwest', label: 'SW', azimuth: -45 },
  { name: 'West', label: 'W', azimuth: -90 },
  { name: 'Northwest', label: 'NW', azimuth: -135 },
];
const elevations = [60, 30, 15];
// Stay just off the pole so the orbit retains a stable north-up orientation.
const overheadElevationDegrees = 89.95;

/** Camera position is expressed relative to the model, with north at the top of the dial. */
export function CameraSelector({
  controller,
}: {
  controller: StudioController;
}): React.JSX.Element {
  const toggle = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const select = (azimuth: number, elevation: number) => {
    controller.setCameraDirection(azimuth, elevation);
  };

  const activate = (event: KeyboardEvent<SVGElement>, azimuth: number, elevation: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(azimuth, elevation);
    }
  };

  return (
    <div
      className="camera-selector"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <button
        ref={toggle}
        className="camera-selector__toggle"
        type="button"
        aria-label="Camera angle shortcuts"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 7h3l1.5-2h7L17 7h3v12H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      </button>
      {open && (
        <svg
          className="camera-selector__dial"
          viewBox="-125 -125 250 250"
          role="group"
          aria-label="Camera angles"
        >
          {elevations.flatMap((elevation, ring) =>
            directions.map((direction, index) => (
              <path
                key={`${elevation}-${direction.name}`}
                d={sectorPath(28 + ring * 26, 54 + ring * 26, index * 45)}
                role="button"
                tabIndex={0}
                aria-label={`View from ${direction.name.toLowerCase()}, ${elevation}° elevation`}
                onClick={() => {
                  select(direction.azimuth, elevation);
                }}
                onKeyDown={(event) => {
                  activate(event, direction.azimuth, elevation);
                }}
              >
                <title>{`From ${direction.name}, ${elevation}° elevation`}</title>
              </path>
            )),
          )}
          <circle
            r="27"
            role="button"
            tabIndex={0}
            aria-label="North-up overhead view"
            onClick={() => {
              select(0, overheadElevationDegrees);
            }}
            onKeyDown={(event) => {
              activate(event, 0, overheadElevationDegrees);
            }}
          >
            <title>North-up overhead view</title>
          </circle>
          <text aria-hidden="true" x="0" y="4" textAnchor="middle">
            TOP
          </text>
          {directions.map((direction, index) => {
            const angle = (index * Math.PI) / 4;

            return (
              <text
                key={direction.name}
                aria-hidden="true"
                x={Math.sin(angle) * 118}
                y={-Math.cos(angle) * 118 + 4}
                textAnchor="middle"
              >
                {direction.label}
              </text>
            );
          })}
          {elevations.map((elevation, index) => (
            <text
              key={elevation}
              aria-hidden="true"
              x="0"
              y={-(41 + index * 26) + 4}
              textAnchor="middle"
            >
              {elevation}°
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

function sectorPath(inner: number, outer: number, bearing: number): string {
  const point = (radius: number, angle: number) => {
    const radians = (angle * Math.PI) / 180;

    return `${radius * Math.sin(radians)} ${-radius * Math.cos(radians)}`;
  };

  return `M ${point(inner, bearing - 22.5)} L ${point(outer, bearing - 22.5)} A ${outer} ${outer} 0 0 1 ${point(outer, bearing + 22.5)} L ${point(inner, bearing + 22.5)} A ${inner} ${inner} 0 0 0 ${point(inner, bearing - 22.5)} Z`;
}
