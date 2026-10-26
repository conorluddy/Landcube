import {
  defaultTrayBorderWidthMm,
  defaultTrayClearanceMm,
  defaultTrayFloorThicknessMm,
  frameProfilePresets,
  maximumFrameDimensionMm,
  minimumFrameWallMm,
  trayWallAboveBaseMm,
} from '../constants/frame';
import { operationErrorCodes } from '../constants/operations';
import { validateTerrainModelSettings } from '../terrain-model';
import type { TerrainModelSettings } from '../terrain-model';
import type {
  FrameAssembly,
  FrameFootprint,
  FrameSettings,
  TrayFrameSettings,
} from '../types/frame';
import type { Result } from '../types/operations';
import { getFrameFootprint, getOutlineHalfExtentMm } from './frame-outline';
import {
  createTrayProfile,
  measureNarrowestWallMm,
  validateProfileOverhang,
} from './frame-profiles';
import { sweepFrameProfile } from './frame-sweep';

const wallToleranceMm = 1e-9;

// === PUBLIC API ===

/**
 * Builds printable frame parts that fit the model's footprint. Pure and deterministic:
 * the same inputs always give the same buffers. `overallHeightMm` sets shadow-box depth
 * (#36); the tray only validates it.
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

  if (frame.style === 'none') {
    return { ok: true, data: { parts: [], outerSizeMm: { x: 0, y: 0, z: 0 }, warnings: [] } };
  }

  return createTrayAssembly(getFrameFootprint(model), frame);
}

/** The rim clears the model's base by `trayWallAboveBaseMm`. */
export function createDefaultTrayFrame(model: TerrainModelSettings): TrayFrameSettings {
  return {
    style: 'tray',
    outline: 'match',
    profile: 'square',
    borderWidthMm: defaultTrayBorderWidthMm,
    wallHeightMm: model.baseThicknessMm + trayWallAboveBaseMm,
    floorThicknessMm: defaultTrayFloorThicknessMm,
    clearanceMm: defaultTrayClearanceMm,
    mounts: [],
  };
}

// === TRAY ===

function createTrayAssembly(
  footprint: FrameFootprint,
  tray: TrayFrameSettings,
): Result<FrameAssembly> {
  const settingsError = findTraySettingsError(footprint, tray);

  if (settingsError !== undefined) {
    return invalidSettings(settingsError);
  }

  const profile = createTrayProfile(tray.profile, {
    innerOffsetMm: tray.clearanceMm,
    outerOffsetMm: tray.clearanceMm + tray.borderWidthMm,
    floorHeightMm: tray.floorThicknessMm,
    topHeightMm: tray.floorThicknessMm + tray.wallHeightMm,
  });
  const narrowestWallMm = measureNarrowestWallMm(
    profile.points,
    tray.clearanceMm,
    tray.floorThicknessMm,
  );

  // Tolerance absorbs rounding in (clearance + border) - clearance at exactly the minimum.
  if (narrowestWallMm < minimumFrameWallMm - wallToleranceMm) {
    return invalidSettings(
      `The ${tray.profile} tray wall is ${narrowestWallMm.toFixed(2)} mm at its narrowest; the minimum is ${minimumFrameWallMm} mm. Increase borderWidthMm.`,
    );
  }

  const overhang = validateProfileOverhang(profile);

  if (!overhang.ok) {
    return overhang;
  }

  const outerOffsetMm = Math.max(...profile.points.map(({ offsetMm }) => offsetMm));
  const outerHalfWidthMm =
    (footprint.shape === 'circle' ? footprint.radiusMm : footprint.halfWidthMm) + outerOffsetMm;
  const outerHalfLengthMm =
    (footprint.shape === 'circle' ? footprint.radiusMm : footprint.halfLengthMm) + outerOffsetMm;

  return {
    ok: true,
    data: {
      parts: [
        {
          id: 'frame',
          solid: sweepFrameProfile(footprint, profile.points),
          printOrientation: profile.printOrientation,
        },
      ],
      outerSizeMm: {
        x: outerHalfWidthMm * 2,
        y: tray.floorThicknessMm + tray.wallHeightMm,
        z: outerHalfLengthMm * 2,
      },
      warnings: [],
    },
  };
}

function findTraySettingsError(
  footprint: FrameFootprint,
  tray: TrayFrameSettings,
): string | undefined {
  if (!isOutlineMatchingFootprint(footprint, tray.outline)) {
    return `Outline ${tray.outline} does not match the model's ${footprint.shape} footprint. Mismatched outlines are not supported yet; use outline match.`;
  }

  if (!frameProfilePresets.includes(tray.profile)) {
    return `Profile ${tray.profile} is unknown. Use one of ${frameProfilePresets.join(', ')}.`;
  }

  if (tray.mounts.length > 0 || tray.float !== undefined) {
    return 'Tray frames do not support mounts or a float yet. Pass mounts: [] and omit float.';
  }

  for (const [name, value] of [
    ['borderWidthMm', tray.borderWidthMm],
    ['clearanceMm', tray.clearanceMm],
  ] as const) {
    if (!Number.isFinite(value) || Math.abs(value) > maximumFrameDimensionMm) {
      return `${name} must be a number of millimetres up to ${maximumFrameDimensionMm}; got ${value}.`;
    }
  }

  for (const [name, value] of [
    ['wallHeightMm', tray.wallHeightMm],
    ['floorThicknessMm', tray.floorThicknessMm],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0 || value > maximumFrameDimensionMm) {
      return `${name} must be above 0 and at most ${maximumFrameDimensionMm} mm; got ${value}.`;
    }
  }

  if (tray.floorThicknessMm < minimumFrameWallMm - wallToleranceMm) {
    return `floorThicknessMm ${tray.floorThicknessMm} is too thin to print; the minimum is ${minimumFrameWallMm} mm.`;
  }

  // Every tray ring lies between the opening (clearance) and the outer edge (clearance + border).
  const openingHalfExtentMm = getOutlineHalfExtentMm(footprint, tray.clearanceMm);
  const outerHalfExtentMm = getOutlineHalfExtentMm(
    footprint,
    tray.clearanceMm + tray.borderWidthMm,
  );

  if (openingHalfExtentMm <= 0) {
    return `clearanceMm ${tray.clearanceMm} collapses the tray opening to a half-extent of ${openingHalfExtentMm} mm. Use a clearance above ${-getOutlineHalfExtentMm(footprint, 0)} mm.`;
  }

  if (outerHalfExtentMm <= 0) {
    return `borderWidthMm ${tray.borderWidthMm} with clearanceMm ${tray.clearanceMm} collapses the tray's outer edge to a half-extent of ${outerHalfExtentMm} mm. Increase borderWidthMm or clearanceMm so they sum to more than ${-getOutlineHalfExtentMm(footprint, 0)} mm.`;
  }

  return undefined;
}

function isOutlineMatchingFootprint(
  footprint: FrameFootprint,
  outline: TrayFrameSettings['outline'],
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
