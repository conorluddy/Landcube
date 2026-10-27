import { minimumFrameWallMm } from '../constants/frame';
import { operationErrorCodes } from '../constants/operations';
import { validateTerrainModelSettings } from '../terrain-model';
import type { TerrainModelSettings } from '../terrain-model';
import type { TerrainSurfaceBuffers } from '../terrain-surface';
import type { FrameAssembly, FrameFootprint, FramePart, FrameSettings } from '../types/frame';
import type { Result } from '../types/operations';
import { composeFrameProfiles } from './frame-composition';
import type { FramePartProfile } from './frame-composition';
import { getFrameFootprint } from './frame-outline';
import { measureNarrowestWallMm, validateProfileOverhang } from './frame-profiles';
import { sweepFrameProfile } from './frame-sweep';

const wallToleranceMm = 1e-9;

/** Where each display that does not build yet is planned. */
const pendingDisplayIssues = { wall: '#36', standing: '#33', 'wall-perpendicular': '#52' } as const;

// === PUBLIC API ===

/**
 * Builds printable frame parts that fit the model's footprint. Pure and deterministic:
 * the same inputs always give the same buffers. `overallHeightMm` lets a rim measure
 * down from the model's top.
 */
export function createFrameAssembly(
  model: TerrainModelSettings,
  overallHeightMm: number,
  frame: FrameSettings,
): Result<FrameAssembly> {
  // The model validator throws; the frame boundary reports the same rule as a Result.
  try {
    validateTerrainModelSettings(model);
  } catch (error) {
    return invalidSettings(error instanceof Error ? error.message : String(error));
  }

  if (!Number.isFinite(overallHeightMm) || overallHeightMm <= 0) {
    return invalidSettings(
      `overallHeightMm must be a positive number of millimetres; got ${overallHeightMm}. Rebuild the model and retry.`,
    );
  }

  const footprint = getFrameFootprint(model);
  const settingsError = findFrameSettingsError(footprint, frame);

  if (settingsError !== undefined) {
    return invalidSettings(settingsError);
  }

  const profiles = composeFrameProfiles(footprint, model, overallHeightMm, frame);

  if (!profiles.ok) {
    return profiles;
  }

  const parts: FramePart[] = [];

  for (const partProfile of profiles.data) {
    const printable = validatePartPrintability(partProfile);

    if (!printable.ok) {
      return printable;
    }

    const solid = sweepFrameProfile(footprint, partProfile.profile.points);

    parts.push({
      id: partProfile.id,
      solid,
      printOrientation: partProfile.profile.printOrientation,
      sizeMm: measureSolidSizeMm(solid),
    });
  }

  return {
    ok: true,
    data: {
      parts,
      outerSizeMm: measureOuterSizeMm(footprint, profiles.data),
      seatHeightMm: frame.tiers.reduce((sumMm, tier) => sumMm + tier.heightMm, 0),
      warnings: [],
    },
  };
}

// === PRINTABILITY ===

function validatePartPrintability(partProfile: FramePartProfile): Result<FramePartProfile> {
  const { id, profile, wall } = partProfile;

  if (wall !== undefined) {
    // An inner edge thins the rim land by its own size.
    const narrowestWallMm =
      measureNarrowestWallMm(profile.points, wall.innerOffsetMm, wall.floorHeightMm) -
      wall.innerEdgeMm;

    // Tolerance absorbs rounding in (clearance + border) - clearance at exactly the minimum.
    if (narrowestWallMm < minimumFrameWallMm - wallToleranceMm) {
      return invalidSettings(
        `Part ${id}'s surround wall is ${narrowestWallMm.toFixed(2)} mm at its narrowest; the minimum is ${minimumFrameWallMm} mm. Increase borderWidthMm or shrink its edges.`,
      );
    }
  }

  const overhang = validateProfileOverhang(profile);

  if (!overhang.ok) {
    return invalidSettings(`Part ${id}: ${overhang.error.message}`);
  }

  return { ok: true, data: partProfile };
}

function measureOuterSizeMm(
  footprint: FrameFootprint,
  profiles: readonly FramePartProfile[],
): FrameAssembly['outerSizeMm'] {
  if (profiles.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  const points = profiles.flatMap(({ profile }) => profile.points);
  const outerOffsetMm = Math.max(...points.map(({ offsetMm }) => offsetMm));
  const halfWidthMm = footprint.shape === 'circle' ? footprint.radiusMm : footprint.halfWidthMm;
  const halfLengthMm = footprint.shape === 'circle' ? footprint.radiusMm : footprint.halfLengthMm;

  return {
    x: (halfWidthMm + outerOffsetMm) * 2,
    y: Math.max(...points.map(({ heightMm }) => heightMm)),
    z: (halfLengthMm + outerOffsetMm) * 2,
  };
}

function measureSolidSizeMm(solid: TerrainSurfaceBuffers): FramePart['sizeMm'] {
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];

  for (let offset = 0; offset < solid.positions.length; offset += 3) {
    for (let axis = 0; axis < 3; axis++) {
      minimum[axis] = Math.min(minimum[axis], solid.positions[offset + axis]);
      maximum[axis] = Math.max(maximum[axis], solid.positions[offset + axis]);
    }
  }

  return { x: maximum[0] - minimum[0], y: maximum[1] - minimum[1], z: maximum[2] - minimum[2] };
}

// === SETTINGS ===

function findFrameSettingsError(
  footprint: FrameFootprint,
  frame: FrameSettings,
): string | undefined {
  if (!isOutlineMatchingFootprint(footprint, frame.outline)) {
    return `Outline ${frame.outline} does not match the model's ${footprint.shape} footprint. Mismatched outlines are not supported yet; use outline match.`;
  }

  if (frame.display !== 'table') {
    const issue = pendingDisplayIssues[frame.display] as string | undefined;

    return issue === undefined
      ? `Display ${frame.display} is unknown. Use table, wall, standing or wall-perpendicular.`
      : `Display ${frame.display} is not built yet (${issue}). Use display table.`;
  }

  if (frame.wallMount !== undefined) {
    return 'wallMount only applies to display wall-perpendicular (#52). Omit wallMount.';
  }

  if (frame.mounts.length > 0) {
    return 'Frames do not support mounts yet (#36). Pass mounts: [].';
  }

  return undefined;
}

function isOutlineMatchingFootprint(
  footprint: FrameFootprint,
  outline: FrameSettings['outline'],
): boolean {
  switch (outline) {
    case 'match':
      return true;
    case 'circle':
      return footprint.shape === 'circle';
    case 'square':
      return footprint.shape === 'rectangle' && footprint.halfWidthMm === footprint.halfLengthMm;
  }
}

function invalidSettings(message: string): Result<never> {
  return {
    ok: false,
    error: { code: operationErrorCodes.invalidSettings, message, retryable: true },
  };
}
