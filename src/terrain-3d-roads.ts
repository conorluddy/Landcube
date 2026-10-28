import * as THREE from 'three';
import { createRoadRibbonBuffers } from './road-ribbons';
import { createTerrainRoadMaterial } from './terrain-road-material';
import { defaultRoadStyle } from './constants/roads';
import { getCropFootprint } from './terrain-crop';
import { getFrameUnitsPerMm, type TerrainModelSettings } from './terrain-model';
import type { HeightField } from './types/terrain';
import type { RoadPath, RoadStyle } from './types/roads';

/** Clears the terrain's own depth jitter between mesh vertices without visibly floating. */
const roadLiftUnits = 0.0006;

/** Everything a rebuild needs from the current terrain update. */
export interface TerrainRoadInputs {
  paths: readonly RoadPath[];
  field: HeightField;
  width: number;
  height: number;
  modelSettings: TerrainModelSettings;
  exaggeration: number;
  /** Preview-unit height of terrain elevation zero, matching contour lines. */
  elevationOffset: number;
}

/** Draped road ribbons as one lit mesh; style edits rebuild geometry from the cached inputs. */
export interface TerrainRoadLayer {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  update(inputs: TerrainRoadInputs): void;
  setStyle(style: Readonly<RoadStyle>): void;
  /** Morphs and terraced models cannot carry draped roads, so they hide them. */
  setSuppressed(value: boolean): void;
}

export function createTerrainRoadLayer(): TerrainRoadLayer {
  const asphalt = createTerrainRoadMaterial(defaultRoadStyle.color);
  const material = asphalt.material;
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  let style: Readonly<RoadStyle> = { ...defaultRoadStyle };
  let inputs: TerrainRoadInputs | undefined;
  let suppressed = false;
  let builtKey: readonly unknown[] = [];

  mesh.receiveShadow = true;
  mesh.visible = false;

  const syncVisibility = () => {
    mesh.visible = style.enabled && !suppressed && (mesh.geometry.index?.count ?? 0) > 0;
  };

  const rebuild = () => {
    // Colour-only edits and unchanged terrain updates keep the existing geometry.
    const key = [
      inputs?.paths,
      inputs?.field,
      inputs?.width,
      inputs?.height,
      inputs?.modelSettings,
      inputs?.exaggeration,
      inputs?.elevationOffset,
      style.detail,
      style.widthMm,
    ];

    if (!inputs || !style.enabled || key.every((value, index) => value === builtKey[index])) {
      syncVisibility();

      return;
    }

    const { paths, field, width, height, modelSettings, exaggeration, elevationOffset } = inputs;
    const frameUnitsPerMm = getFrameUnitsPerMm(width, height, modelSettings);
    const buffers = createRoadRibbonBuffers(
      paths,
      field,
      width,
      height,
      style,
      frameUnitsPerMm,
      getCropFootprint(modelSettings.cropShape, modelSettings.cropPolygon, width, height),
    );

    for (let offset = 1; offset < buffers.positions.length; offset += 3) {
      buffers.positions[offset] =
        buffers.positions[offset] * exaggeration + elevationOffset + roadLiftUnits;
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(buffers.indices, 1));
    geometry.computeVertexNormals();
    mesh.geometry.dispose();
    mesh.geometry = geometry;
    builtKey = key;
    syncVisibility();
  };

  return {
    mesh,
    update(value) {
      inputs = value;
      rebuild();
    },
    setStyle(value) {
      style = value;
      material.color.set(value.color);
      asphalt.setTexture(value.texture);
      rebuild();
    },
    setSuppressed(value) {
      suppressed = value;
      syncVisibility();
    },
  };
}
