import * as THREE from 'three';
import { placeRocks, rockShapeCount, type RockInstances } from './rock-placement';
import { createRockShape } from './rock-shapes';
import { sampleHeightField, terrain3dElevationScale } from './terrain-surface';
import { defaultRockStyle } from './constants/rocks';
import type { DecorationSite } from './decoration-field';
import type { RockStyle } from './types/rocks';

/** Everything a rebuild needs from the current terrain update. */
export interface TerrainRockInputs {
  site: DecorationSite;
  exaggeration: number;
  /** Preview-unit height of terrain elevation zero, matching contour lines and roads. */
  elevationOffset: number;
}

/** Instanced low-poly rocks; colour edits never re-pose them and shape edits never re-place them. */
export interface TerrainRockLayer {
  group: THREE.Group;
  /** Undefined when the terrain has no decoration site, which hides the rocks. */
  update(inputs: TerrainRockInputs | undefined): void;
  setStyle(style: Readonly<RockStyle>): void;
  /** Morphs and terraced models cannot carry rocks, so they hide them. */
  setSuppressed(value: boolean): void;
  /** The placed rocks, so grass can clear the ground beneath them. */
  getInstances(): RockInstances | undefined;
}

/** How far a rock leans toward the slope it rests on; 1 would lie flush with any cliff. */
const slopeAlignment = 0.65;

export function createTerrainRockLayer(): TerrainRockLayer {
  const accent = { value: new THREE.Color(defaultRockStyle.accentColor) };
  const material = createRockMaterial(accent);
  const meshes = Array.from({ length: rockShapeCount }, () => {
    const mesh = new THREE.InstancedMesh(new THREE.BufferGeometry(), material, 0);

    mesh.count = 0;
    mesh.castShadow = mesh.receiveShadow = true;
    // Instances span the whole model, so the shape's own bounds would cull them wrongly.
    mesh.frustumCulled = false;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(0), 3);

    return mesh;
  });
  const group = new THREE.Group();
  let style: Readonly<RockStyle> = { ...defaultRockStyle };
  let inputs: TerrainRockInputs | undefined;
  let instances: RockInstances | undefined;
  let suppressed = false;
  let placedKey: readonly unknown[] = [];
  let shapedKey: readonly unknown[] = [];
  let posedKey: readonly unknown[] = [];
  let paintedKey: readonly unknown[] = [];
  let shapeHeights: number[] = [];

  group.add(...meshes);
  group.visible = false;

  const syncVisibility = () => {
    group.visible = style.enabled && !suppressed && inputs !== undefined && instances !== undefined;
  };

  const rebuild = () => {
    if (!inputs || !style.enabled) {
      syncVisibility();

      return;
    }

    const { site } = inputs;
    const placementKey: unknown[] = [
      site.field,
      site.width,
      site.height,
      site.shape,
      site.originX,
      site.originY,
      site.frameUnitsPerMm,
      site.metersPerFieldUnit,
      site.metersPerFrameUnit,
      site.seaLevel,
      site.roads,
      style.rocksPerSquareCm,
      style.minimumSizeMm,
      style.maximumSizeMm,
      style.clustering,
      style.slopePreference,
    ];

    if (!instances || !sameKey(placementKey, placedKey)) {
      instances = placeRocks(site, style);
      reserveRockBuffers(meshes, instances);
      placedKey = placementKey;
    }

    const shapeKey = [style.angularity, style.flattening, style.elongation];

    if (!sameKey(shapeKey, shapedKey)) {
      shapeHeights = meshes.map((mesh, index) => {
        mesh.geometry.dispose();
        mesh.geometry = createRockShape(index, style);

        return mesh.geometry.boundingBox?.max.y ?? 0.5;
      });
      shapedKey = shapeKey;
    }

    const poseKey = [
      instances,
      shapeHeights,
      inputs.exaggeration,
      inputs.elevationOffset,
      style.embedding,
    ];

    if (!sameKey(poseKey, posedKey)) {
      poseRocks(meshes, instances, inputs, style.embedding, shapeHeights);
      posedKey = poseKey;
      paintedKey = [];
    }

    const paintKey = [instances, style.baseColor, style.colorVariation];

    if (!sameKey(paintKey, paintedKey)) {
      paintRocks(meshes, instances, style);
      paintedKey = paintKey;
    }

    syncVisibility();
  };

  return {
    group,
    update(value) {
      inputs = value;
      rebuild();
    },
    setStyle(value) {
      style = value;
      accent.value.set(value.accentColor);
      rebuild();
    },
    setSuppressed(value) {
      suppressed = value;
      syncVisibility();
    },
    getInstances: () => (group.visible ? instances : undefined),
  };
}

// === HELPERS ===

/** Allocate only the rocks each shape draws; disabled rocks need no instance buffers. */
function reserveRockBuffers(meshes: THREE.InstancedMesh[], instances: RockInstances): void {
  const counts = meshes.map(() => 0);

  for (let index = 0; index < instances.count; index++) {
    counts[instances.shape[index]]++;
  }

  meshes.forEach((mesh, shape) => {
    if (counts[shape] <= mesh.instanceMatrix.count) {
      return;
    }

    // Release the old GPU attributes before replacing buffers that have already been uploaded.
    mesh.dispose();
    mesh.instanceMatrix = new THREE.InstancedBufferAttribute(
      new Float32Array(counts[shape] * 16),
      16,
    );
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(counts[shape] * 3), 3);
  });
}

/**
 * Sits each rock on the draped terrain, leaning partway into the slope and sunk by the embedding
 * share of its height. The downhill edge would float on steep ground, so slopes sink rocks a
 * little further.
 */
function poseRocks(
  meshes: THREE.InstancedMesh[],
  instances: RockInstances,
  inputs: TerrainRockInputs,
  embedding: number,
  shapeHeights: readonly number[],
): void {
  const { site, exaggeration, elevationOffset } = inputs;
  const scale = 2 / Math.max(site.width, site.height);
  const heightScale = terrain3dElevationScale * exaggeration;
  const step = site.field.spacing;
  const counts = meshes.map(() => 0);
  const up = new THREE.Vector3(0, 1, 0);
  const normal = new THREE.Vector3();
  const lean = new THREE.Quaternion();
  const upright = new THREE.Quaternion();
  const turn = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const size = new THREE.Vector3();
  const matrix = new THREE.Matrix4();

  for (let index = 0; index < instances.count; index++) {
    const x = instances.x[index];
    const y = instances.y[index];
    // Rendered gradients include exaggeration, so rocks lean with the slope the viewer sees.
    const gradientX =
      ((sampleHeightField(site.field, x + step, y) - sampleHeightField(site.field, x - step, y)) *
        heightScale) /
      (2 * step * scale);
    const gradientZ =
      ((sampleHeightField(site.field, x, y + step) - sampleHeightField(site.field, x, y - step)) *
        heightScale) /
      (2 * step * scale);
    const across = instances.sizeMm[index] * site.frameUnitsPerMm * scale;
    const shape = instances.shape[index];
    const steepness = Math.min(1, Math.hypot(gradientX, gradientZ));

    normal.set(-gradientX, 1, -gradientZ).normalize();
    lean.setFromUnitVectors(up, normal).slerp(upright, 1 - slopeAlignment);
    turn.setFromAxisAngle(up, instances.yaw[index]);
    position.set(
      (x - site.width / 2) * scale,
      instances.elevation[index] * heightScale +
        elevationOffset -
        across * (shapeHeights[shape] * embedding * 0.85 + steepness * 0.25),
      (y - site.height / 2) * scale,
    );
    size.setScalar(across);
    meshes[shape].setMatrixAt(counts[shape]++, matrix.compose(position, lean.multiply(turn), size));
  }

  meshes.forEach((mesh, shape) => {
    mesh.count = counts[shape];
    mesh.instanceMatrix.needsUpdate = true;
  });
}

/** Base colour with per-rock brightness jitter; matches the order `poseRocks` filled each mesh. */
function paintRocks(
  meshes: THREE.InstancedMesh[],
  instances: RockInstances,
  style: Readonly<RockStyle>,
): void {
  const counts = meshes.map(() => 0);
  const base = new THREE.Color(style.baseColor);
  const color = new THREE.Color();

  for (let index = 0; index < instances.count; index++) {
    const shape = instances.shape[index];

    color.copy(base).multiplyScalar(1 + instances.shade[index] * style.colorVariation * 0.45);
    meshes[shape].setColorAt(counts[shape]++, color);
  }

  for (const mesh of meshes) {
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }
}

/** Matte stone: weathering gathers on upward faces and the base sits in its own shade. */
function createRockMaterial(accent: THREE.IUniform<THREE.Color>): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.93,
    metalness: 0,
    flatShading: true,
  });

  material.customProgramCacheKey = () => 'topogra-rocks-v1';

  material.onBeforeCompile = (shader) => {
    shader.uniforms.rockAccent = accent;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying float vRockHeight;
        varying float vRockFacing;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vRockHeight = position.y;
        vRockFacing = normal.y;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 rockAccent;
        varying float vRockHeight;
        varying float vRockFacing;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, rockAccent, smoothstep(0.45, 0.9, vRockFacing) * 0.7);
        diffuseColor.rgb *= mix(0.62, 1.0, smoothstep(0.0, 0.35, vRockHeight));`,
      );
  };

  return material;
}

function sameKey(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
