import { operationErrorCodes } from '../constants/operations';
import { coveProfileSegments, maximumFrameOverhangDegrees } from '../constants/frame';
import type { FrameProfile, FrameProfilePoint, FrameProfilePreset } from '../types/frame';
import type { Result } from '../types/operations';

/** Offsets are measured from the footprint edge; heights from the bed. */
export interface TrayProfileDimensions {
  innerOffsetMm: number;
  outerOffsetMm: number;
  floorHeightMm: number;
  topHeightMm: number;
}

const overhangToleranceDegrees = 1e-9;

// === PUBLIC API ===

/**
 * Builds the tray cross-section from the outer foot, up and over the rim, down to the floor
 * top. Every preset faces up or out, so all print upright without supports. Feature size
 * scales with the wall so presets stay proportional.
 */
export function createTrayProfile(
  preset: FrameProfilePreset,
  dimensions: TrayProfileDimensions,
): FrameProfile {
  const {
    innerOffsetMm: inner,
    outerOffsetMm: outer,
    floorHeightMm,
    topHeightMm: top,
  } = dimensions;
  const featureMm = Math.min(outer - inner, top - floorHeightMm) / 2;
  const rimToFloor = [point(inner, top), point(inner, floorHeightMm)];

  switch (preset) {
    case 'square':
      return upright([point(outer, 0), point(outer, top), ...rimToFloor]);
    case 'chamfer':
      return upright([
        point(outer, 0),
        point(outer, top - featureMm),
        point(outer - featureMm, top),
        ...rimToFloor,
      ]);
    case 'cove':
      return upright([
        point(outer, 0),
        point(outer, top - featureMm),
        ...createCovePoints(outer, top, featureMm),
        point(outer - featureMm, top),
        ...rimToFloor,
      ]);
    case 'stepped':
      return upright([
        point(outer, 0),
        point(outer, top - featureMm),
        point(outer - featureMm / 2, top - featureMm),
        point(outer - featureMm / 2, top - featureMm / 2),
        point(outer - featureMm, top - featureMm / 2),
        point(outer - featureMm, top),
        ...rimToFloor,
      ]);
    case 'floating':
      // A 45° undercut toe casts a shadow line and sits exactly on the overhang limit.
      return upright([
        point(outer - featureMm, 0),
        point(outer, featureMm),
        point(outer, top),
        ...rimToFloor,
      ]);
  }
}

/**
 * Rejects any face steeper than 45° from vertical that points down in the print orientation,
 * including the flat end caps. Faces resting on the bed are exempt.
 */
export function validateProfileOverhang(profile: FrameProfile): Result<FrameProfile> {
  const { points, printOrientation } = profile;
  const heights = points.map(({ heightMm }) => heightMm);
  const isUpright = printOrientation === 'upright';
  const bedHeightMm = isUpright ? Math.min(...heights) : Math.max(...heights);
  const axisOffsetMm = Math.min(...points.map(({ offsetMm }) => offsetMm)) - 1;
  const faces = [
    point(axisOffsetMm, heights[0]),
    ...points,
    point(axisOffsetMm, heights[heights.length - 1]),
  ];

  for (let index = 0; index < faces.length - 1; index++) {
    const start = faces[index];
    const end = faces[index + 1];
    const lengthMm = Math.hypot(end.offsetMm - start.offsetMm, end.heightMm - start.heightMm);
    const isOnBed = start.heightMm === bedHeightMm && end.heightMm === bedHeightMm;

    if (isOnBed || lengthMm === 0) {
      continue;
    }

    // The outward normal of a counter-clockwise profile has height component -Δoffset/length.
    const downwardNormal = ((isUpright ? 1 : -1) * (end.offsetMm - start.offsetMm)) / lengthMm;
    const overhangDegrees = (Math.asin(Math.min(1, downwardNormal)) * 180) / Math.PI;

    if (overhangDegrees > maximumFrameOverhangDegrees + overhangToleranceDegrees) {
      return {
        ok: false,
        error: {
          code: operationErrorCodes.invalidSettings,
          message: `${describeFace(index, faces.length, start, end)} overhangs ${overhangDegrees.toFixed(1)}° when printed ${printOrientation}; the limit is ${maximumFrameOverhangDegrees}°. Change the profile or its print orientation.`,
          retryable: true,
        },
      };
    }
  }

  return { ok: true, data: profile };
}

/** The narrowest horizontal span from the inner wall to the outer face, floor top to rim. */
export function measureNarrowestWallMm(
  points: readonly FrameProfilePoint[],
  innerOffsetMm: number,
  floorHeightMm: number,
): number {
  const wallHeights = [
    floorHeightMm,
    ...points.map(({ heightMm }) => heightMm).filter((heightMm) => heightMm >= floorHeightMm),
  ];

  return Math.min(
    ...wallHeights.map((heightMm) => getOuterOffsetAtMm(points, heightMm) - innerOffsetMm),
  );
}

// === HELPERS ===

function point(offsetMm: number, heightMm: number): FrameProfilePoint {
  return { offsetMm, heightMm };
}

function upright(points: FrameProfilePoint[]): FrameProfile {
  return { points, printOrientation: 'upright' };
}

/** A concave quarter-round centred on the outer top corner, excluding both end points. */
function createCovePoints(
  outerOffsetMm: number,
  topHeightMm: number,
  radiusMm: number,
): FrameProfilePoint[] {
  return Array.from({ length: coveProfileSegments - 1 }, (_, index) => {
    const angle = ((index + 1) / coveProfileSegments) * (Math.PI / 2);

    return point(
      outerOffsetMm - Math.sin(angle) * radiusMm,
      topHeightMm - Math.cos(angle) * radiusMm,
    );
  });
}

function getOuterOffsetAtMm(points: readonly FrameProfilePoint[], heightMm: number): number {
  let outerOffsetMm = -Infinity;

  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index];
    const end = points[index + 1];

    if (heightMm < Math.min(start.heightMm, end.heightMm)) {
      continue;
    }

    if (heightMm > Math.max(start.heightMm, end.heightMm)) {
      continue;
    }

    const offsetMm =
      start.heightMm === end.heightMm
        ? Math.max(start.offsetMm, end.offsetMm)
        : start.offsetMm +
          ((end.offsetMm - start.offsetMm) * (heightMm - start.heightMm)) /
            (end.heightMm - start.heightMm);

    outerOffsetMm = Math.max(outerOffsetMm, offsetMm);
  }

  return outerOffsetMm;
}

function describeFace(
  index: number,
  faceCount: number,
  start: FrameProfilePoint,
  end: FrameProfilePoint,
): string {
  if (index === 0) {
    return `The start cap at height ${roundMm(start.heightMm)} mm`;
  }

  if (index === faceCount - 2) {
    return `The end cap at height ${roundMm(start.heightMm)} mm`;
  }

  return `Profile segment ${index - 1} from (${roundMm(start.offsetMm)}, ${roundMm(start.heightMm)}) to (${roundMm(end.offsetMm)}, ${roundMm(end.heightMm)})`;
}

function roundMm(valueMm: number): number {
  return Math.round(valueMm * 100) / 100;
}
