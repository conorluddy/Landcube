import * as THREE from 'three';
import {
  createGrassCoverage,
  surveyGrassGround,
  type GrassCoverageMap,
  type GrassGround,
  type GrassSite,
} from './grass-coverage';
import { defaultGrassStyle } from './constants/grass';
import type { GrassStyle } from './types/grass';

/** Everything a rebuild needs from the current terrain update. */
export interface TerrainGrassInputs {
  site: GrassSite;
  /** The rendered terrain surface; each shell is a copy of it lifted a little higher. */
  surface: THREE.BufferGeometry;
}

/** A shell-textured grass carpet; colour, length, density and wind never rebuild its mask. */
export interface TerrainGrassLayer {
  mesh: THREE.InstancedMesh;
  /** Undefined when the terrain has no grass site, which hides the carpet. */
  update(inputs: TerrainGrassInputs | undefined): void;
  setStyle(style: Readonly<GrassStyle>): void;
  /** Morphs and terraced models cannot carry grass, so they hide it. */
  setSuppressed(value: boolean): void;
  /** Settled grass stands still and upright, for stills and whenever wind is not animating. */
  setSettled(value: boolean): void;
  /** True while wind needs a continuous render loop. */
  isAnimated(): boolean;
  tick(timeMs: number): void;
  /** The growth mask in use, for diagnostics and tests. */
  getCoverage(): GrassCoverageMap | undefined;
}

/** Stacked copies of the terrain; more shells give smoother blades at a linear fill cost. */
export const grassShellCount = 20;

export function createTerrainGrassLayer(): TerrainGrassLayer {
  const uniforms = {
    grassMap: { value: null as THREE.Texture | null },
    grassShellCount: { value: grassShellCount },
    grassShellHeight: { value: 0 },
    grassCellUnits: { value: 1 },
    grassSource: { value: new THREE.Vector3(1, 0, 0) },
    grassMaskScale: { value: new THREE.Vector2(1, 1) },
    grassBase: { value: new THREE.Color(defaultGrassStyle.baseColor) },
    grassTip: { value: new THREE.Color(defaultGrassStyle.tipColor) },
    grassDry: { value: new THREE.Color(defaultGrassStyle.dryColor) },
    grassVariation: { value: defaultGrassStyle.colorVariation as number },
    grassDryness: { value: defaultGrassStyle.dryness as number },
    grassLengthVariation: { value: defaultGrassStyle.lengthVariation as number },
    grassWind: { value: defaultGrassStyle.wind as number },
    grassTime: { value: 0 },
  };
  const placeholder = new THREE.BufferGeometry();
  const mesh = new THREE.InstancedMesh(placeholder, createGrassMaterial(uniforms), grassShellCount);
  let style: Readonly<GrassStyle> = { ...defaultGrassStyle };
  let inputs: TerrainGrassInputs | undefined;
  let ground: GrassGround | undefined;
  let coverage: GrassCoverageMap | undefined;
  let texture: THREE.DataTexture | undefined;
  let suppressed = false;
  let settled = false;
  let groundKey: readonly unknown[] = [];
  let coverageKey: readonly unknown[] = [];

  mesh.visible = false;
  mesh.receiveShadow = true;
  // Shells cover the same ground as the terrain, which is never culled either.
  mesh.frustumCulled = false;

  const syncVisibility = () => {
    mesh.visible = style.enabled && !suppressed && inputs !== undefined && texture !== undefined;
  };

  /** Uniforms that follow the crop and style without touching the mask. */
  const syncShape = (site: GrassSite) => {
    const scale = 2 / Math.max(site.width, site.height);
    // Density is blades per square centimetre, so each blade owns a cell this many mm across.
    const cellMm = 10 / Math.sqrt(Math.max(1, style.bladesPerSquareCm));

    uniforms.grassShellHeight.value = style.lengthMm * scale * site.frameUnitsPerMm;
    uniforms.grassCellUnits.value = cellMm * site.frameUnitsPerMm;
    uniforms.grassSource.value.set(
      1 / scale,
      site.width / 2 + site.originX,
      site.height / 2 + site.originY,
    );
    uniforms.grassMaskScale.value.set(1 / (scale * site.width), 1 / (scale * site.height));
  };

  const rebuild = () => {
    if (!inputs) {
      // Never keep drawing a surface the terrain may already have disposed.
      mesh.geometry = placeholder;
    }

    if (!inputs || !style.enabled) {
      syncVisibility();

      return;
    }

    const { site, surface } = inputs;
    const nextGroundKey: unknown[] = [
      site.field,
      site.width,
      site.height,
      JSON.stringify(site.footprint),
      site.originX,
      site.originY,
      site.frameUnitsPerMm,
      site.metersPerFieldUnit,
      site.metersPerFrameUnit,
      site.seaLevel,
      site.roads,
    ];

    if (!ground || !sameKey(nextGroundKey, groundKey)) {
      ground = surveyGrassGround(site);
      groundKey = nextGroundKey;
      coverageKey = [];
    }

    // Sliders only redo thresholds over the surveyed ground, which stays well inside a frame.
    const nextCoverageKey = [
      ground,
      style.coverage,
      style.clumping,
      style.slopeLimitDegrees,
      style.altitudeLimit,
    ];

    if (!texture || !sameKey(nextCoverageKey, coverageKey)) {
      coverage = createGrassCoverage(ground, style);

      if (texture?.image.width === coverage.columns && texture.image.height === coverage.rows) {
        texture.image.data = coverage.data;
      } else {
        texture?.dispose();
        texture = new THREE.DataTexture(coverage.data, coverage.columns, coverage.rows);
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        uniforms.grassMap.value = texture;
      }

      texture.needsUpdate = true;
      coverageKey = nextCoverageKey;
    }

    // The terrain owns the surface geometry; the shells only borrow it.
    mesh.geometry = surface;
    syncShape(site);
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
      uniforms.grassLengthVariation.value = value.lengthVariation;
      uniforms.grassWind.value = settled ? 0 : value.wind;
      rebuild();
    },
    setSettled(value) {
      settled = value;
      uniforms.grassWind.value = value ? 0 : style.wind;
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
    getCoverage: () => coverage,
  };
}

// === HELPERS ===

/**
 * Each shell is the terrain lifted by its share of the blade length. A fragment survives only
 * where its cell's blade is taller than the shell and still wide enough at that height, so the
 * stack reads as a dense pile of tapering blades. Where cells shrink below a pixel the blades
 * widen into a continuous carpet instead of shimmering.
 */
function createGrassMaterial(uniforms: Record<string, THREE.IUniform>): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.92,
    metalness: 0,
  });

  material.customProgramCacheKey = () => 'topogra-grass-shells-v1';

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float grassShellCount;
        uniform float grassShellHeight;
        uniform float grassTime;
        uniform float grassWind;
        varying float vGrassShell;
        varying vec2 vGrassPlan;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vGrassShell = (float(gl_InstanceID) + 0.5) / grassShellCount;
        vGrassPlan = transformed.xz;
        transformed.y += vGrassShell * grassShellHeight;
        // Neighbouring blades share a gust phase, so wind moves through the carpet in waves.
        vec2 gust = vec2(
          sin(grassTime * 1.4 + transformed.x * 9.0 + transformed.z * 5.0),
          sin(grassTime * 1.1 + transformed.z * 7.0 - transformed.x * 3.0) * 0.5
        );
        transformed.xz += gust * grassWind * grassShellHeight * 0.4 * vGrassShell * vGrassShell;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D grassMap;
        uniform float grassCellUnits;
        uniform vec3 grassSource;
        uniform vec2 grassMaskScale;
        uniform vec3 grassBase;
        uniform vec3 grassTip;
        uniform vec3 grassDry;
        uniform float grassVariation;
        uniform float grassDryness;
        uniform float grassLengthVariation;
        varying float vGrassShell;
        varying vec2 vGrassPlan;

        float grassHash(vec2 p) {
          vec3 q = fract(vec3(p.xyx) * 0.1031);
          q += dot(q, q.yzx + 33.33);
          return fract((q.x + q.y) * q.z);
        }`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        vec4 grassMask = texture2D(grassMap, vGrassPlan * grassMaskScale + 0.5);
        // Source-frame cells keep each blade in place when the crop moves.
        vec2 grassCellPosition = (vGrassPlan * grassSource.x + grassSource.yz) / grassCellUnits;
        vec2 grassCell = floor(grassCellPosition);
        float grassFar = smoothstep(0.4, 1.4, length(fwidth(grassCellPosition)));
        float grassLength = mix(
          mix(1.0 - grassLengthVariation, 1.0, grassHash(grassCell)),
          1.0 - grassLengthVariation * 0.5,
          grassFar
        );
        // A firm edge keeps sparse fringes from stacking into rings on steep ground.
        float bladeHeight = smoothstep(0.12, 0.55, grassMask.r) * grassLength;

        if (vGrassShell > bladeHeight) discard;

        float bladeProgress = vGrassShell / max(bladeHeight, 0.001);
        float taper = 1.0 - bladeProgress;
        float bladeRadius = mix(mix(0.1, 0.55, taper), 1.5, grassFar);
        vec2 bladeCentre =
          vec2(grassHash(grassCell + 17.31), grassHash(grassCell + 41.7)) * 0.5 + 0.25;

        // The lowest shells are a solid mat, so no bare terrain shows between roots.
        if (vGrassShell > 0.08 && distance(fract(grassCellPosition), bladeCentre) > bladeRadius) {
          discard;
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 grassColor = mix(grassBase, grassTip, smoothstep(0.0, 1.0, bladeProgress));
        // Patch noise clusters near its middle, so dryness spreads the threshold across that band.
        float dryEdge = mix(0.78, 0.22, grassDryness);
        float dry =
          smoothstep(dryEdge - 0.06, dryEdge + 0.06, grassMask.g) * step(0.001, grassDryness);
        grassColor = mix(grassColor, grassDry * mix(0.8, 1.05, bladeProgress), dry);
        grassColor *= 1.0 + (grassHash(grassCell + 7.7) - 0.5) * grassVariation * 0.7 * (1.0 - grassFar);
        // Deep in the pile is shaded by the blades above it; short grass still has bright tips.
        grassColor *= mix(0.55, 1.0, bladeProgress);
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
