import * as THREE from 'three';
import { createRoadRibbonBuffers } from './road-ribbons';
import { defaultRoadStyle } from './constants/roads';
import type { TerrainModelSettings } from './terrain-model';
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
  const material = new THREE.MeshStandardMaterial({
    color: defaultRoadStyle.color,
    roughness: 0.9,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
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
    const frameUnitsPerMm =
      modelSettings.cropShape === 'circle'
        ? width / modelSettings.widthMm
        : Math.max(width, height) / Math.max(modelSettings.widthMm, modelSettings.lengthMm);
    const buffers = createRoadRibbonBuffers(
      paths,
      field,
      width,
      height,
      style,
      frameUnitsPerMm,
      modelSettings.cropShape ?? 'rectangle',
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
      rebuild();
    },
    setSuppressed(value) {
      suppressed = value;
      syncVisibility();
    },
  };
}
