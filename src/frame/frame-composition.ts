import { minimumFrameWallMm } from '../constants/frame';
import { operationErrorCodes } from '../constants/operations';
import type { TerrainModelSettings } from '../terrain-model';
import type {
  FrameEdge,
  FrameFootEdge,
  FrameFootprint,
  FramePartId,
  FrameProfile,
  FrameProfilePoint,
  FrameRimHeight,
  FrameSettings,
  FrameSurround,
  FrameTier,
} from '../types/frame';
import type { Result } from '../types/operations';
import { getOutlineHalfExtentMm } from './frame-outline';
import { createInnerEdgePoints, createOuterEdgePoints } from './frame-profiles';
import { findFrameTiersError, findFrameSurroundError } from './frame-settings-validation';

/** One printed part's cross-section, plus what the wall check needs when it has a surround. */
export interface FramePartProfile {
  id: FramePartId;
  profile: FrameProfile;
  wall?: { innerOffsetMm: number; floorHeightMm: number; innerEdgeMm: number };
}

const wallToleranceMm = 1e-9;
const collinearToleranceMm2 = 1e-9;

// === PUBLIC API ===

/**
 * Stacks tiers bottom-up into printed parts: `join-below` tiers merge with the part beneath,
 * `separate` tiers start a new one. The surround joins the top tier. Parts sit in assembled
 * position, so a separate tier's profile starts at the height of the tiers below it.
 */
export function composeFrameProfiles(
  footprint: FrameFootprint,
  model: TerrainModelSettings,
  overallHeightMm: number,
  frame: FrameSettings,
): Result<FramePartProfile[]> {
  const settingsError = findFrameTiersError(frame);

  if (settingsError !== undefined) {
    return invalidSettings(settingsError);
  }

  const rimHeightMm =
    frame.surround === undefined
      ? 0
      : resolveRimHeightMm(frame.surround.rimHeight, model, overallHeightMm);

  if (frame.surround !== undefined) {
    const surroundError = findFrameSurroundError(footprint, frame, frame.surround, rimHeightMm);

    if (surroundError !== undefined) {
      return invalidSettings(surroundError);
    }
  }

  const groups = groupTiersIntoParts(frame.tiers);
  const parts: FramePartProfile[] = [];
  let bottomHeightMm = 0;

  for (const [index, group] of groups.entries()) {
    const id: FramePartId = index === 0 ? 'frame' : `frame-${index + 1}`;
    const surround = index === groups.length - 1 ? frame.surround : undefined;
    const part = composePart(id, group, bottomHeightMm, frame.clearanceMm, surround, rimHeightMm);

    if (!part.ok) {
      return part;
    }

    const minimumOffsetMm = Math.min(...part.data.profile.points.map(({ offsetMm }) => offsetMm));
    const halfExtentMm = getOutlineHalfExtentMm(footprint, minimumOffsetMm);

    if (halfExtentMm <= 0) {
      return invalidSettings(
        `Part ${id} reaches offset ${minimumOffsetMm} mm, which collapses its outline to a half-extent of ${halfExtentMm} mm. Increase the tier offsetMm or shrink its edge sizeMm.`,
      );
    }

    parts.push(part.data);
    bottomHeightMm += group.reduce((sumMm, tier) => sumMm + tier.heightMm, 0);
  }

  return { ok: true, data: parts };
}

/** Rim height above the floor top, where the model sits. */
export function resolveRimHeightMm(
  rimHeight: FrameRimHeight,
  model: TerrainModelSettings,
  overallHeightMm: number,
): number {
  switch (rimHeight.reference) {
    case 'model-base':
      return model.baseThicknessMm + rimHeight.aboveMm;
    case 'model-top':
      return overallHeightMm - rimHeight.belowMm;
    case 'floor':
      return rimHeight.heightMm;
  }
}

// === PART PROFILES ===

function composePart(
  id: FramePartId,
  tiers: readonly FrameTier[],
  bottomHeightMm: number,
  clearanceMm: number,
  surround: FrameSurround | undefined,
  rimHeightMm: number,
): Result<FramePartProfile> {
  const points: FrameProfilePoint[] = [];
  let heightMm = bottomHeightMm;

  for (const tier of tiers) {
    points.push(point(tier.offsetMm, heightMm));
    heightMm += tier.heightMm;
    points.push(...createOuterEdgePoints(tier.edge, { offsetMm: tier.offsetMm, heightMm }));
  }

  const floorThicknessMm = heightMm - bottomHeightMm;

  // Tolerance absorbs rounding when tier heights sum to exactly the minimum.
  if (floorThicknessMm < minimumFrameWallMm - wallToleranceMm) {
    return invalidSettings(
      `Part ${id} is ${floorThicknessMm} mm thick; the minimum is ${minimumFrameWallMm} mm. Increase its tiers' heightMm.`,
    );
  }

  if (surround !== undefined) {
    const outerOffsetMm = clearanceMm + surround.borderWidthMm;
    const rimTopMm = heightMm + rimHeightMm;

    points.push(
      point(outerOffsetMm, heightMm),
      ...createOuterEdgePoints(surround.rimEdge, { offsetMm: outerOffsetMm, heightMm: rimTopMm }),
      ...createInnerEdgePoints(surround.innerEdge, { offsetMm: clearanceMm, heightMm: rimTopMm }),
      point(clearanceMm, heightMm),
    );
  }

  const footed = applyFootEdge(simplifyProfile(points), tiers[0].footEdge);

  if (!footed.ok) {
    return invalidSettings(`Part ${id}: ${footed.error.message}`);
  }

  return {
    ok: true,
    data: {
      id,
      profile: { points: footed.data, printOrientation: 'upright' },
      wall:
        surround === undefined
          ? undefined
          : {
              innerOffsetMm: clearanceMm,
              floorHeightMm: heightMm,
              innerEdgeMm: getEdgeSizeMm(surround.innerEdge),
            },
    },
  };
}

/** An undercut toe replaces the bottom outer corner; it needs a straight wall above it. */
function applyFootEdge(
  points: FrameProfilePoint[],
  footEdge: FrameFootEdge | undefined,
): Result<FrameProfilePoint[]> {
  if (footEdge === undefined || footEdge.shape === 'square') {
    return { ok: true, data: points };
  }

  const [foot, above] = points;
  const straightWallMm = above.offsetMm === foot.offsetMm ? above.heightMm - foot.heightMm : 0;

  if (footEdge.sizeMm > straightWallMm) {
    return invalidSettings(
      `the undercut footEdge is ${footEdge.sizeMm} mm but the straight wall above the foot is ${straightWallMm} mm. Shrink footEdge sizeMm.`,
    );
  }

  return {
    ok: true,
    data: simplifyProfile([
      point(foot.offsetMm - footEdge.sizeMm, foot.heightMm),
      point(foot.offsetMm, foot.heightMm + footEdge.sizeMm),
      ...points.slice(1),
    ]),
  };
}

/** Drops repeated points and points midway along a straight run, where blocks meet flush. */
function simplifyProfile(points: readonly FrameProfilePoint[]): FrameProfilePoint[] {
  const simplified: FrameProfilePoint[] = [];

  for (const candidate of points) {
    const previous = simplified.at(-1);

    if (previous?.offsetMm === candidate.offsetMm && previous.heightMm === candidate.heightMm) {
      continue;
    }

    while (
      simplified.length >= 2 &&
      isMidway(simplified[simplified.length - 2], simplified[simplified.length - 1], candidate)
    ) {
      simplified.pop();
    }

    simplified.push(candidate);
  }

  return simplified;
}

function isMidway(
  start: FrameProfilePoint,
  middle: FrameProfilePoint,
  end: FrameProfilePoint,
): boolean {
  const firstOffset = middle.offsetMm - start.offsetMm;
  const firstHeight = middle.heightMm - start.heightMm;
  const secondOffset = end.offsetMm - middle.offsetMm;
  const secondHeight = end.heightMm - middle.heightMm;
  const cross = firstOffset * secondHeight - firstHeight * secondOffset;
  const dot = firstOffset * secondOffset + firstHeight * secondHeight;

  return Math.abs(cross) < collinearToleranceMm2 && dot > 0;
}

function groupTiersIntoParts(tiers: readonly FrameTier[]): FrameTier[][] {
  const groups: FrameTier[][] = [];

  for (const tier of tiers) {
    if (tier.part === 'separate' || groups.length === 0) {
      groups.push([tier]);
    } else {
      groups[groups.length - 1].push(tier);
    }
  }

  return groups;
}

// === HELPERS ===

function getEdgeSizeMm(edge: FrameEdge): number {
  return edge.shape === 'square' ? 0 : edge.sizeMm;
}

function point(offsetMm: number, heightMm: number): FrameProfilePoint {
  return { offsetMm, heightMm };
}

function invalidSettings(message: string): Result<never> {
  return {
    ok: false,
    error: { code: operationErrorCodes.invalidSettings, message, retryable: true },
  };
}
