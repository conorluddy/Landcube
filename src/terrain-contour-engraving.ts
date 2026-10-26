import type * as THREE from 'three';
import type { Contour } from './types/contours';
import type { DesignSettings } from './types/design';

export interface ContourEngravingSettings {
  treatment: 'drawn' | 'engraved';
  widthMm: number;
  depthMm: number;
}

export const defaultContourEngraving: Readonly<ContourEngravingSettings> = Object.freeze({
  treatment: 'drawn',
  widthMm: 0.7,
  depthMm: 0.18,
});

export interface ContourEngraving {
  setEnabled(value: boolean): void;
  setSize(widthMm: number, depthMm: number): void;
  update(
    contours: readonly Contour[],
    settings: Readonly<DesignSettings>,
    previewScale: number,
  ): void;
  applyTo(material: THREE.MeshPhysicalMaterial): void;
}

/** A light-reactive preview only: no vertex displacement or changes to printable geometry. */
export function createContourEngraving(): ContourEngraving {
  const uniforms = {
    engravingEnabled: { value: 0 },
    engravingWidth: { value: 0 },
    engravingDepth: { value: 0 },
    engravingFirst: { value: 0 },
    engravingLast: { value: 0 },
    engravingInterval: { value: 1 },
    engravingIndexOffset: { value: 0 },
    engravingIndexEvery: { value: 0 },
  };
  let widthMm = defaultContourEngraving.widthMm;
  let depthMm = defaultContourEngraving.depthMm;
  let scale = 2 / 150;
  let hasContours = false;
  let enabled = false;

  const sync = () => {
    uniforms.engravingEnabled.value = enabled && hasContours ? 1 : 0;
    uniforms.engravingWidth.value = widthMm * scale;
    uniforms.engravingDepth.value = depthMm * scale;
  };

  return {
    setEnabled(value: boolean) {
      enabled = value;
      sync();
    },
    setSize(width: number, depth: number) {
      widthMm = Math.max(0.1, Math.min(3, width));
      depthMm = Math.max(0, Math.min(1, depth));
      sync();
    },
    update(contours: readonly Contour[], settings: Readonly<DesignSettings>, previewScale: number) {
      scale = previewScale;
      hasContours = contours.length > 0;
      const first = contours.at(0);
      const interval = contours.length > 1 ? contours[1].elevation - (first?.elevation ?? 0) : 1;

      uniforms.engravingFirst.value = first?.elevation ?? 0;
      uniforms.engravingLast.value = contours.at(-1)?.elevation ?? 0;
      uniforms.engravingInterval.value = Math.max(1e-8, interval);
      uniforms.engravingIndexOffset.value =
        first === undefined
          ? 0
          : (first.elevationMeters ?? first.elevation) / (first.intervalMeters ?? interval);
      uniforms.engravingIndexEvery.value = settings.indexStyle === 'off' ? 0 : settings.indexEvery;
      sync();
    },
    applyTo(material: THREE.MeshPhysicalMaterial) {
      const previousCompile = material.onBeforeCompile.bind(material);
      const previousCacheKey = material.customProgramCacheKey();

      material.customProgramCacheKey = () => `${previousCacheKey}-contour-engraving-v1`;

      material.onBeforeCompile = (shader, renderer) => {
        previousCompile(shader, renderer);
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
            attribute float contourElevation;
            varying float engravingElevation;
            varying vec3 engravingPosition;`,
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            engravingElevation = contourElevation;
            engravingPosition = position;`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
            varying float engravingElevation;
            varying vec3 engravingPosition;
            uniform float engravingEnabled;
            uniform float engravingWidth;
            uniform float engravingDepth;
            uniform float engravingFirst;
            uniform float engravingLast;
            uniform float engravingInterval;
            uniform float engravingIndexOffset;
            uniform float engravingIndexEvery;`,
          )
          .replace(
            '#include <lights_physical_fragment>',
            /* glsl */ `
            if (engravingEnabled > 0.5 && engravingDepth > 0.0) {
              // Interpolated source elevation keeps cuts aligned even at zero exaggeration.
              float levelIndex = clamp(floor((engravingElevation - engravingFirst) / engravingInterval + 0.5),
                0.0, max(0.0, (engravingLast - engravingFirst) / engravingInterval));
              float level = engravingFirst + levelIndex * engravingInterval;
              vec3 dx = dFdx(engravingPosition);
              vec3 dy = dFdy(engravingPosition);
              vec3 geometricNormal = normalize(cross(dx, dy));
              vec3 rx = cross(dy, geometricNormal);
              vec3 ry = cross(geometricNormal, dx);
              float determinant = dot(dx, rx);
              vec3 elevationGradient = (dFdx(engravingElevation) * rx + dFdy(engravingElevation) * ry)
                / max(abs(determinant), 1e-12);
              float gradientLength = length(elevationGradient);
              float distanceToLine = abs(engravingElevation - level) / max(gradientLength, 1e-6);
              float isIndex = engravingIndexEvery > 0.0 &&
                abs(mod(levelIndex + engravingIndexOffset + 0.5, max(1.0, engravingIndexEvery)) - 0.5) < 0.01 ? 1.0 : 0.0;
              float halfWidth = engravingWidth * 0.5 * mix(1.0, 1.4, isIndex);
              float edge = max(fwidth(distanceToLine), 1e-6);
              float profile = max(0.0, 1.0 - distanceToLine / (halfWidth + edge * 0.5));
              // Constant-height plateaus have no unique contour, so never engrave the whole plateau.
              profile *= smoothstep(1e-6, 1e-5, gradientLength);
              float coverage = 1.0 - smoothstep(max(0.0, halfWidth - edge * 0.5), halfWidth + edge * 0.5, distanceToLine);
              float cutSlope = engravingDepth * mix(1.0, 1.2, isIndex) * halfWidth
                / ((halfWidth + edge * 0.5) * (halfWidth + edge * 0.5) * max(gradientLength, 1e-6));
              cutSlope *= coverage * smoothstep(1e-6, 1e-5, gradientLength)
                * clamp((engravingElevation - level) / max(gradientLength * edge * 0.5, 1e-8), -1.0, 1.0);
              vec3 viewDx = dFdx(-vViewPosition);
              vec3 viewDy = dFdy(-vViewPosition);
              vec3 viewRx = cross(viewDy, normal);
              vec3 viewRy = cross(normal, viewDx);
              float viewDet = dot(viewDx, viewRx) * faceDirection;
              vec3 cutGradient = sign(viewDet) * cutSlope * (dFdx(engravingElevation) * viewRx + dFdy(engravingElevation) * viewRy);
              normal = normalize(max(abs(viewDet), 1e-10) * normal - cutGradient);
              diffuseColor.rgb *= 1.0 - profile * min(0.35, engravingDepth / max(engravingWidth, 1e-6));
            }
            #include <lights_physical_fragment>`,
          );
      };
    },
  };
}
