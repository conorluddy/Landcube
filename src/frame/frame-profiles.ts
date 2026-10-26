import { frameEdgeArcSegments, maximumFrameOverhangDegrees } from '../constants/frame';
import { operationErrorCodes } from '../constants/operations';
import type { FrameEdge, FrameProfile, FrameProfilePoint } from '../types/frame';
import type { Result } from '../types/operations';

/** A top corner of a profile block: its vertical face meets its top face here. */
export interface FrameCorner {
  offsetMm: number;
  heightMm: number;
}

/** In edge space, `inwardMm` runs from the vertical face and `downMm` from the top face. */
interface EdgePoint {
  inwardMm: number;
  downMm: number;
}

const overhangToleranceDegrees = 1e-9;
/** Computed bed heights can miss the minimum by rounding; that face still rests on the bed. */
const bedToleranceMm = 1e-9;

// === PUBLIC API ===

/**
 * Cuts `edge` into an outer top corner, from the outer face up to the top face. Every shape
 * faces up or out, so none adds an overhang when printed upright.
 */
export function createOuterEdgePoints(edge: FrameEdge, corner: FrameCorner): FrameProfilePoint[] {
  return createEdgeShape(edge).map(({ inwardMm, downMm }) =>
    point(corner.offsetMm - inwardMm, corner.heightMm - downMm),
  );
}

/** Cuts `edge` into an inner top corner, from the top face down to the inner face. */
export function createInnerEdgePoints(edge: FrameEdge, corner: FrameCorner): FrameProfilePoint[] {
  return createEdgeShape(edge)
    .map(({ inwardMm, downMm }) => point(corner.offsetMm + inwardMm, corner.heightMm - downMm))
    .reverse();
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
    const isOnBed =
      Math.abs(start.heightMm - bedHeightMm) < bedToleranceMm &&
      Math.abs(end.heightMm - bedHeightMm) < bedToleranceMm;

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

/**
 * The narrowest horizontal span from the inner wall to the outer face, floor top to rim.
 * Each band between neighbouring vertex heights is measured with only the segments that
 * span it, so a notch bounded by horizontal faces is not hidden by those faces. In a
 * non-self-intersecting profile the outer face is one linear segment per band, so its
 * narrowest point is at a band edge.
 */
export function measureNarrowestWallMm(
  points: readonly FrameProfilePoint[],
  innerOffsetMm: number,
  floorHeightMm: number,
): number {
  const bandEdges = [
    ...new Set([
      floorHeightMm,
      ...points.map(({ heightMm }) => heightMm).filter((heightMm) => heightMm >= floorHeightMm),
    ]),
  ].sort((a, b) => a - b);
  let narrowestMm = Infinity;

  for (let index = 0; index < bandEdges.length - 1; index++) {
    const lowerMm = bandEdges[index];
    const upperMm = bandEdges[index + 1];

    for (const heightMm of [lowerMm, upperMm]) {
      const outerOffsetMm = getBandOuterOffsetMm(points, lowerMm, upperMm, heightMm);

      narrowestMm = Math.min(narrowestMm, outerOffsetMm - innerOffsetMm);
    }
  }

  return narrowestMm;
}

// === HELPERS ===

function point(offsetMm: number, heightMm: number): FrameProfilePoint {
  return { offsetMm, heightMm };
}

/** Edge points from the vertical face (`downMm` = size) to the top face (`inwardMm` = size). */
function createEdgeShape(edge: FrameEdge): EdgePoint[] {
  if (edge.shape === 'square') {
    return [edgePoint(0, 0)];
  }

  const size = edge.sizeMm;
  const half = size / 2;

  switch (edge.shape) {
    case 'chamfer':
      return [edgePoint(0, size), edgePoint(size, 0)];
    case 'cove':
      // Concave quarter-round centred on the corner.
      return createArc((sin, cos) => edgePoint(sin * size, cos * size));
    case 'round':
      // Convex quarter-round centred one size in from both faces.
      return createArc((sin, cos) => edgePoint(size - cos * size, size - sin * size));
    case 'ogee':
      // A half-size cove below a half-size round: an S-curve with no downward face.
      return [
        ...createArc((sin, cos) => edgePoint(sin * half, half + cos * half)),
        ...createArc((sin, cos) => edgePoint(size - cos * half, half - sin * half)).slice(1),
      ];
    case 'step':
      return [
        edgePoint(0, size),
        edgePoint(half, size),
        edgePoint(half, half),
        edgePoint(size, half),
        edgePoint(size, 0),
      ];
  }
}

/** Samples a quarter-turn, both ends included and exact so edges meet their faces flush. */
function createArc(sample: (sin: number, cos: number) => EdgePoint): EdgePoint[] {
  return Array.from({ length: frameEdgeArcSegments + 1 }, (_, index) => {
    if (index === 0) {
      return sample(0, 1);
    }

    if (index === frameEdgeArcSegments) {
      return sample(1, 0);
    }

    const angle = (index / frameEdgeArcSegments) * (Math.PI / 2);

    return sample(Math.sin(angle), Math.cos(angle));
  });
}

function edgePoint(inwardMm: number, downMm: number): EdgePoint {
  return { inwardMm, downMm };
}

/** The outermost offset at `heightMm` among segments spanning the whole band. */
function getBandOuterOffsetMm(
  points: readonly FrameProfilePoint[],
  lowerMm: number,
  upperMm: number,
  heightMm: number,
): number {
  let outerOffsetMm = -Infinity;

  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index];
    const end = points[index + 1];

    if (Math.min(start.heightMm, end.heightMm) > lowerMm) {
      continue;
    }

    if (Math.max(start.heightMm, end.heightMm) < upperMm) {
      continue;
    }

    const offsetMm =
      start.offsetMm +
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
