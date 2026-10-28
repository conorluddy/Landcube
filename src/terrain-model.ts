import {
  createCircularTerrainSurface,
  createOutlineTerrainSurface,
  defaultTerrainCrop,
  getCropFootprint,
  getTerrainCropBounds,
  isStarShapedCropPolygon,
  type CropPoint,
  type TerrainCropSettings,
  type TerrainCropShape,
} from './terrain-crop';
import {
  createTerracedTerrainBuffers,
  type TerracedTerrainBuffers,
  type TerrainTerraceLevels,
} from './terrain-terraces';
import {
  createTerrainSurfaceBuffers,
  sampleHeightField,
  terrain3dElevationScale,
} from './terrain-surface';
import type { TerrainSurfaceBuffers } from './terrain-surface';
import type { HeightField } from './types/terrain';

export interface TerrainModelSettings {
  widthMm: number;
  lengthMm: number;
  baseThicknessMm: number;
  cropShape?: TerrainCropShape;
  /** Polygon crop corners in the crop box's normalized coordinates; must surround its center. */
  cropPolygon?: readonly CropPoint[];
  terrainShape?: 'smooth' | 'terraced';
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
  layerHeightMm?: number;
  contourEdges?: TerracedTerrainBuffers['contourEdges'];
}

export function validateTerrainModelSettings(settings: TerrainModelSettings): void {
  if (
    settings.terrainShape !== undefined &&
    !['smooth', 'terraced'].includes(settings.terrainShape)
  ) {
    throw new Error('Terrain shape must be Smooth or Terraced.');
  }

  if (settings.cropPolygon !== undefined && !isStarShapedCropPolygon(settings.cropPolygon)) {
    throw new Error(
      'Polygon crop corners must stay inside the crop and every edge must face its center. Reset the polygon and retry.',
    );
  }

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

/** Crop units per printed millimetre: the crop's longer side, or a circle's diameter, spans the model. */
export function getFrameUnitsPerMm(
  width: number,
  height: number,
  settings: Pick<TerrainModelSettings, 'widthMm' | 'lengthMm' | 'cropShape'>,
): number {
  return settings.cropShape === 'circle'
    ? width / settings.widthMm
    : Math.max(width, height) / Math.max(settings.widthMm, settings.lengthMm);
}

export interface TerrainModelCrop {
  field: HeightField;
  /** Top-left of the unrotated crop box in the source frame. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Clockwise turn of the crop box about its center. */
  rotationRadians: number;
}

/**
 * Unrotated crops are a translated view of the original field, keeping them centered and
 * lossless. Rotated crops resample the source at its own spacing in the crop's frame.
 */
export function cropTerrainModelField(
  field: HeightField,
  width: number,
  height: number,
  settings: TerrainModelSettings,
  crop: TerrainCropSettings = defaultTerrainCrop,
): TerrainModelCrop {
  validateTerrainModelSettings(settings);
  const isRound = settings.cropShape === 'circle';
  const ratio = isRound ? 1 : settings.widthMm / settings.lengthMm;
  const bounds = getTerrainCropBounds(width, height, ratio, crop, isRound);
  const rotationRadians = ((bounds.crop.rotationDegrees ?? 0) * Math.PI) / 180;
  const box = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };

  if (rotationRadians === 0) {
    return {
      field: { ...field, originX: field.originX - bounds.x, originY: field.originY - bounds.y },
      ...box,
      rotationRadians,
    };
  }

  return { field: resampleRotatedField(field, box, rotationRadians), ...box, rotationRadians };
}

/**
 * Pulls each place partway toward a common look: steep crops calm down, flat wide ones lift.
 * Relief ÷ span of 0.2 maps to 0.25; the 0.35 power keeps some of each place's character.
 */
export function getSuggestedExaggeration(reliefMeters: number, spanKm: number): number {
  const reliefRatio = reliefMeters / (spanKm * 1000);

  if (!Number.isFinite(reliefRatio) || reliefRatio <= 0) {
    return 0.3;
  }

  const suggested = 0.25 * (reliefRatio / 0.2) ** 0.35;

  return Math.round(Math.min(0.6, Math.max(0.05, suggested)) * 20) / 20;
}

/** Builds one indexed closed solid in millimeters, Y up, with a flat bottom at zero. */
export function createTerrainModel(
  field: HeightField,
  width: number,
  height: number,
  settings: TerrainModelSettings,
  exaggeration: number,
  terraceLevels?: TerrainTerraceLevels,
): TerrainModel {
  validateTerrainModelSettings(settings);

  if (!Number.isFinite(exaggeration) || exaggeration < 0 || exaggeration > 1) {
    throw new Error('Height exaggeration must be between 0 and 1.');
  }

  const footprint = getCropFootprint(settings.cropShape, settings.cropPolygon, width, height);
  const sampled =
    settings.cropShape === 'circle'
      ? createCircularTerrainSurface(field, width)
      : footprint.outline
        ? createOutlineTerrainSurface(field, { ...footprint, outline: footprint.outline })
        : createTerrainSurfaceBuffers(field, width, height);
  const mmPerUnit =
    (settings.cropShape === 'circle'
      ? settings.widthMm
      : Math.max(settings.widthMm, settings.lengthMm)) / 2;
  const elevationScaleMm = mmPerUnit * exaggeration;

  if (settings.terrainShape === 'terraced' && exaggeration > 0) {
    if (!terraceLevels) {
      throw new Error('Terraced terrain needs a contour interval.');
    }

    return {
      ...createTerracedTerrainBuffers(
        sampled,
        mmPerUnit,
        elevationScaleMm,
        settings.baseThicknessMm,
        terraceLevels.origin * terrain3dElevationScale,
        terraceLevels.interval * terrain3dElevationScale,
      ),
      elevationScaleMm,
    };
  }

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
    ...(settings.terrainShape === 'terraced' ? { layerHeightMm: 0 } : {}),
  };
}

// === HELPERS ===

/** Samples the source on a grid aligned with the rotated crop, one cell beyond each edge. */
function resampleRotatedField(
  source: HeightField,
  box: { x: number; y: number; width: number; height: number },
  rotationRadians: number,
): HeightField {
  const spacing = source.spacing;
  const columns = Math.ceil(box.width / spacing) + 3;
  const rows = Math.ceil(box.height / spacing) + 3;
  const values = new Float64Array(columns * rows);
  const cos = Math.cos(rotationRadians);
  const sin = Math.sin(rotationRadians);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const localX = (column - 1) * spacing - box.width / 2;
      const localY = (row - 1) * spacing - box.height / 2;

      values[row * columns + column] = sampleHeightField(
        source,
        centerX + localX * cos - localY * sin,
        centerY + localX * sin + localY * cos,
      );
    }
  }

  return { columns, rows, originX: -spacing, originY: -spacing, spacing, values };
}
