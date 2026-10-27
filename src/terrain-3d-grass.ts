import * as THREE from 'three';
import {
  maximumGrassTufts,
  placeGrass,
  type GrassInstances,
  type GrassSite,
} from './grass-placement';
import { terrain3dElevationScale } from './terrain-surface';
import { defaultGrassStyle } from './constants/grass';
import type { GrassStyle } from './types/grass';

/** Everything a rebuild needs from the current terrain update. */
export interface TerrainGrassInputs {
  site: GrassSite;
  exaggeration: number;
  /** Preview-unit height of terrain elevation zero, matching contour lines and roads. */
  elevationOffset: number;
}

/** Instanced grass tufts; colour, wind and length edits never re-place them. */
export interface TerrainGrassLayer {
  mesh: THREE.InstancedMesh;
  update(inputs: TerrainGrassInputs): void;
  setStyle(style: Readonly<GrassStyle>): void;
  /** Morphs and terraced models cannot carry draped grass, so they hide it. */
  setSuppressed(value: boolean): void;
  /** True while wind needs a continuous render loop. */
  isAnimated(): boolean;
  tick(timeMs: number): void;
}

// 7 blades × 3 segments is 42 triangles a tuft, so the 30,000-tuft cap stays near 1.3 M.
const bladesPerTuft = 7;
const bladeSegments = 3;
/** Blades are this wide at the root, relative to their length, so they read at diorama scale. */
const bladeWidthRatio = 0.14;
/** Sinks roots slightly so tufts never hover over the bilinear-versus-mesh height gap. */
const rootEmbedUnits = 0.0003;

export function createTerrainGrassLayer(): TerrainGrassLayer {
  const geometry = createTuftGeometry();
  const shades = new THREE.InstancedBufferAttribute(new Float32Array(maximumGrassTufts), 1);
  const patches = new THREE.InstancedBufferAttribute(new Float32Array(maximumGrassTufts), 1);

  geometry.setAttribute('grassShade', shades);
  geometry.setAttribute('grassPatch', patches);

  const uniforms = {
    grassBase: { value: new THREE.Color(defaultGrassStyle.baseColor) },
    grassTip: { value: new THREE.Color(defaultGrassStyle.tipColor) },
    grassDry: { value: new THREE.Color(defaultGrassStyle.dryColor) },
    grassVariation: { value: defaultGrassStyle.colorVariation as number },
    grassDryness: { value: defaultGrassStyle.dryness as number },
    grassWind: { value: defaultGrassStyle.wind as number },
    grassTime: { value: 0 },
  };
  const material = createGrassMaterial(uniforms);
  const mesh = new THREE.InstancedMesh(geometry, material, maximumGrassTufts);
  let style: Readonly<GrassStyle> = { ...defaultGrassStyle };
  let inputs: TerrainGrassInputs | undefined;
  let instances: GrassInstances | undefined;
  let suppressed = false;
  let placedKey: readonly unknown[] = [];
  let posedKey: readonly unknown[] = [];

  mesh.count = 0;
  mesh.visible = false;
  mesh.receiveShadow = true;
  // Instances span the whole model, so the tuft's own bounds would cull them wrongly.
  mesh.frustumCulled = false;

  const syncVisibility = () => {
    mesh.visible = style.enabled && !suppressed && mesh.count > 0;
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
      style.density,
      style.coverage,
      style.clumping,
      style.slopeLimitDegrees,
      style.altitudeLimit,
    ];

    if (!instances || !sameKey(placementKey, placedKey)) {
      instances = placeGrass(site, style);
      placedKey = placementKey;
      posedKey = [];
    }

    const poseKey = [
      instances,
      inputs.exaggeration,
      inputs.elevationOffset,
      style.lengthMm,
      style.lengthVariation,
    ];

    if (!sameKey(poseKey, posedKey)) {
      poseTufts(mesh, shades, patches, instances, inputs, style);
      posedKey = poseKey;
    }

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
      uniforms.grassBase.value.set(value.baseColor);
      uniforms.grassTip.value.set(value.tipColor);
      uniforms.grassDry.value.set(value.dryColor);
      uniforms.grassVariation.value = value.colorVariation;
      uniforms.grassDryness.value = value.dryness;
      uniforms.grassWind.value = value.wind;
      rebuild();
    },
    setSuppressed(value) {
      suppressed = value;
      syncVisibility();
    },
    isAnimated() {
      return mesh.visible && style.wind > 0 && !isReducedMotionPreferred();
    },
    tick(timeMs) {
      uniforms.grassTime.value = timeMs / 1000;
    },
  };
}

// === HELPERS ===

/** Writes one matrix per tuft: root on the draped terrain, random turn, length from the style. */
function poseTufts(
  mesh: THREE.InstancedMesh,
  shades: THREE.InstancedBufferAttribute,
  patches: THREE.InstancedBufferAttribute,
  instances: GrassInstances,
  inputs: TerrainGrassInputs,
  style: Readonly<GrassStyle>,
): void {
  const { site, exaggeration, elevationOffset } = inputs;
  const scale = 2 / Math.max(site.width, site.height);
  const previewUnitsPerMm = scale * site.frameUnitsPerMm;
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const size = new THREE.Vector3();

  for (let index = 0; index < instances.count; index++) {
    const length =
      style.lengthMm *
      Math.max(0.2, 1 + instances.lengthJitter[index] * style.lengthVariation * 0.7) *
      previewUnitsPerMm;

    position.set(
      (instances.x[index] - site.width / 2) * scale,
      instances.elevation[index] * terrain3dElevationScale * exaggeration +
        elevationOffset -
        rootEmbedUnits,
      (instances.y[index] - site.height / 2) * scale,
    );
    rotation.setFromAxisAngle(up, instances.rotation[index]);
    size.set(length, length, length);
    mesh.setMatrixAt(index, matrix.compose(position, rotation, size));
    shades.setX(index, instances.shade[index]);
    patches.setX(index, instances.patch[index]);
  }

  mesh.count = instances.count;
  mesh.instanceMatrix.needsUpdate = true;
  shades.needsUpdate = true;
  patches.needsUpdate = true;
}

/**
 * One tuft of tapered, outward-curving blades, 1 unit tall. Every normal points up, so blades
 * catch light like the ground beneath them instead of flickering as thin cards.
 */
function createTuftGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const progress: number[] = [];
  const indices: number[] = [];

  for (let blade = 0; blade < bladesPerTuft; blade++) {
    // Fixed, irregular spacing and heights: every tuft shares this shape and differs by rotation.
    const angle = ((blade + 0.37 * Math.sin(blade * 2.3)) / bladesPerTuft) * Math.PI * 2;
    const lean = 0.1 + 0.2 * ((blade * 0.618) % 1);
    const bladeHeight = 0.65 + 0.35 * ((blade * 0.382 + 0.5) % 1);
    const outward = { x: Math.cos(angle), z: Math.sin(angle) };
    const across = { x: -outward.z, z: outward.x };
    const rootOffset = 0.05;
    const first = positions.length / 3;

    for (let row = 0; row <= bladeSegments; row++) {
      const t = row / bladeSegments;
      const halfWidth = (bladeWidthRatio / 2) * (1 - t) ** 0.8;
      const reach = rootOffset + lean * t ** 1.6;
      const centreX = outward.x * reach;
      const centreZ = outward.z * reach;
      const y = t * bladeHeight;

      positions.push(centreX - across.x * halfWidth, y, centreZ - across.z * halfWidth);
      positions.push(centreX + across.x * halfWidth, y, centreZ + across.z * halfWidth);
      progress.push(t, t);
    }

    for (let row = 0; row < bladeSegments; row++) {
      const a = first + row * 2;

      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(
      Array.from({ length: positions.length }, (_, index) => (index % 3 === 1 ? 1 : 0)),
      3,
    ),
  );
  geometry.setAttribute('bladeProgress', new THREE.Float32BufferAttribute(progress, 1));
  geometry.setIndex(indices);

  return geometry;
}

/** Base-to-tip gradient, dry patches and per-tuft jitter; wind bends tips, never roots. */
function createGrassMaterial(uniforms: Record<string, THREE.IUniform>): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.85,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  material.customProgramCacheKey = () => 'topogra-grass-v2';

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float bladeProgress;
        attribute float grassShade;
        attribute float grassPatch;
        uniform float grassTime;
        uniform float grassWind;
        varying float vBladeProgress;
        varying float vGrassShade;
        varying float vGrassPatch;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vBladeProgress = bladeProgress;
        vGrassShade = grassShade;
        vGrassPatch = grassPatch;
        // Neighbouring tufts share a gust phase, so the wind moves through the grass in waves.
        vec2 grassRoot = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        float gust = sin(grassTime * 1.4 + grassRoot.x * 9.0 + grassRoot.y * 5.0) * 0.65
          + sin(grassTime * 3.1 + grassRoot.x * 31.0) * 0.35;
        float bend = grassWind * bladeProgress * bladeProgress * 0.45;
        transformed.x += gust * bend;
        transformed.z += gust * bend * 0.5;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 grassBase;
        uniform vec3 grassTip;
        uniform vec3 grassDry;
        uniform float grassVariation;
        uniform float grassDryness;
        varying float vBladeProgress;
        varying float vGrassShade;
        varying float vGrassPatch;`,
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        // Both faces share the upward normal; the default flip would light every back face as if
        // it faced the ground and turn tufts into dark specks.
        normal = normalize(vNormal);`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 grassColor = mix(grassBase, grassTip, smoothstep(0.0, 1.0, vBladeProgress));
        // Patch noise clusters near its middle, so dryness spreads the threshold across that band.
        float dryEdge = mix(0.78, 0.22, grassDryness);
        float dry = smoothstep(dryEdge - 0.06, dryEdge + 0.06, vGrassPatch) * step(0.001, grassDryness);
        grassColor = mix(grassColor, grassDry * mix(0.75, 1.05, vBladeProgress), dry);
        grassColor *= 1.0 + vGrassShade * grassVariation * 0.4;
        // Roots sit in the shade of the tuft.
        grassColor *= mix(0.72, 1.0, smoothstep(0.0, 0.45, vBladeProgress));
        diffuseColor.rgb = grassColor;`,
      );
  };

  return material;
}

function sameKey(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Absent outside browsers, where tests run with motion allowed. */
function isReducedMotionPreferred(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
