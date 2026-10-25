import {
  createCircularTerrainSurface,
  defaultTerrainCrop,
  getTerrainCropBounds,
  type TerrainCropSettings,
  type TerrainCropShape,
} from './terrain-crop';
import { createTerrainSurfaceBuffers } from './terrain-surface';
import type { TerrainSurfaceBuffers } from './terrain-surface';
import type { HeightField } from './types/terrain';

export interface TerrainModelSettings {
  widthMm: number;
  lengthMm: number;
  baseThicknessMm: number;
  cropShape?: TerrainCropShape;
}

export const defaultTerrainModelSettings: Readonly<TerrainModelSettings> = Object.freeze({
  widthMm: 150,
  lengthMm: 150,
  baseThicknessMm: 3,
});

export interface TerrainModel {
  surface: TerrainSurfaceBuffers;
  base: TerrainSurfaceBuffers;
  solid: TerrainSurfaceBuffers;
  overallHeightMm: number;
  elevationOffsetMm: number;
  elevationScaleMm: number;
}

export function validateTerrainModelSettings(settings: TerrainModelSettings): void {
  for (const value of [settings.widthMm, settings.lengthMm]) {
    if (!Number.isFinite(value) || value < 1 || value > 1000) {
      throw new Error('Model width and length must be between 1 and 1000 mm.');
    }
  }

  if (
    !Number.isFinite(settings.baseThicknessMm) ||
    settings.baseThicknessMm < 0.1 ||
    settings.baseThicknessMm > 100
  ) {
    throw new Error('Base thickness must be between 0.1 and 100 mm.');
  }
}

/** A translated view of the original field keeps crops centered and lossless. */
export function cropTerrainModelField(
  field: HeightField,
  width: number,
  height: number,
  settings: TerrainModelSettings,
  crop: TerrainCropSettings = defaultTerrainCrop,
): { field: HeightField; width: number; height: number } {
  validateTerrainModelSettings(settings);
  const ratio = settings.cropShape === 'circle' ? 1 : settings.widthMm / settings.lengthMm;
  const bounds = getTerrainCropBounds(width, height, ratio, crop);

  return {
    field: { ...field, originX: field.originX - bounds.x, originY: field.originY - bounds.y },
    width: bounds.width,
    height: bounds.height,
  };
}

/** Builds one indexed closed solid in millimeters, Y up, with a flat bottom at zero. */
export function createTerrainModel(
  field: HeightField,
  width: number,
  height: number,
  settings: TerrainModelSettings,
  exaggeration: number,
): TerrainModel {
  validateTerrainModelSettings(settings);

  if (!Number.isFinite(exaggeration) || exaggeration < 0 || exaggeration > 1) {
    throw new Error('Height exaggeration must be between 0 and 1.');
  }

  const sampled =
    settings.cropShape === 'circle'
      ? createCircularTerrainSurface(field, width)
      : createTerrainSurfaceBuffers(field, width, height);
  const mmPerUnit =
    (settings.cropShape === 'circle'
      ? settings.widthMm
      : Math.max(settings.widthMm, settings.lengthMm)) / 2;
  const elevationScaleMm = mmPerUnit * exaggeration;
  let minimum = Infinity;
  let maximum = -Infinity;

  for (let offset = 1; offset < sampled.positions.length; offset += 3) {
    const value = sampled.positions[offset];

    if (!Number.isFinite(value)) {
      throw new Error('Terrain contains invalid elevations. Reload terrain and retry.');
    }

    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }

  const elevationOffsetMm = settings.baseThicknessMm - minimum * elevationScaleMm;
  const positions = Array.from(sampled.positions, (value, index) =>
    index % 3 === 1 ? value * elevationScaleMm + elevationOffsetMm : value * mmPerUnit,
  );
  const surface = { positions: new Float32Array(positions), indices: sampled.indices };
  const edges = new Map<string, [number, number]>();

  for (let offset = 0; offset < sampled.indices.length; offset += 3) {
    for (let side = 0; side < 3; side++) {
      const a = sampled.indices[offset + side];
      const b = sampled.indices[offset + ((side + 1) % 3)];
      const key = `${Math.min(a, b)}:${Math.max(a, b)}`;

      if (edges.has(key)) {
        edges.delete(key);
      } else {
        edges.set(key, [a, b]);
      }
    }
  }

  const bottom = new Map<number, number>();

  for (const [a, b] of edges.values()) {
    for (const vertex of [a, b]) {
      if (!bottom.has(vertex)) {
        bottom.set(vertex, positions.length / 3);
        positions.push(positions[vertex * 3], 0, positions[vertex * 3 + 2]);
      }
    }
  }

  const center = positions.length / 3;

  positions.push(0, 0, 0);
  const baseIndices: number[] = [];

  for (const [a, b] of edges.values()) {
    const lowerA = bottom.get(a);
    const lowerB = bottom.get(b);

    if (lowerA === undefined || lowerB === undefined) {
      throw new Error('Terrain boundary is incomplete.');
    }

    baseIndices.push(b, a, lowerA, b, lowerA, lowerB, lowerB, lowerA, center);
  }

  const allPositions = new Float32Array(positions);

  return {
    surface,
    base: { positions: allPositions, indices: new Uint32Array(baseIndices) },
    solid: {
      positions: allPositions,
      indices: new Uint32Array([...sampled.indices, ...baseIndices]),
    },
    overallHeightMm: settings.baseThicknessMm + (maximum - minimum) * elevationScaleMm,
    elevationOffsetMm,
    elevationScaleMm,
  };
}
