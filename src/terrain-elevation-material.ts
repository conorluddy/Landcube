import * as THREE from 'three';
import {
  copyElevationGradient,
  elevationGradientPresets,
  maximumElevationColorStops,
  validateElevationGradient,
  type ElevationGradientSettings,
} from './terrain-elevation-gradient';

export interface TerrainElevationMaterial {
  applyTo(material: THREE.MeshPhysicalMaterial): void;
  setSettings(settings: ElevationGradientSettings): void;
  setRange(minimum: number, maximum: number): void;
}

/** Changes albedo before lighting, preserving material relief, engraving and real shadows. */
export function createTerrainElevationMaterial(): TerrainElevationMaterial {
  const uniforms = {
    elevationGradientEnabled: { value: 0 },
    elevationGradientHard: { value: 0 },
    elevationGradientCount: { value: 2 },
    elevationGradientColors: {
      value: Array.from({ length: maximumElevationColorStops }, () => new THREE.Color()),
    },
    elevationGradientPositions: { value: new Float32Array(maximumElevationColorStops) },
    elevationGradientMinimum: { value: 0 },
    elevationGradientRange: { value: 1 },
  };

  const api: TerrainElevationMaterial = {
    applyTo(material) {
      const previousCompile = material.onBeforeCompile.bind(material);
      const previousCacheKey = material.customProgramCacheKey();

      material.customProgramCacheKey = () => `${previousCacheKey}-elevation-gradient-v1`;

      material.onBeforeCompile = (shader, renderer) => {
        previousCompile(shader, renderer);
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
            attribute float gradientElevation;
            varying float elevationGradientHeight;`,
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            elevationGradientHeight = gradientElevation;`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
            varying float elevationGradientHeight;
            uniform float elevationGradientEnabled;
            uniform float elevationGradientHard;
            uniform int elevationGradientCount;
            uniform vec3 elevationGradientColors[${maximumElevationColorStops}];
            uniform float elevationGradientPositions[${maximumElevationColorStops}];
            uniform float elevationGradientMinimum;
            uniform float elevationGradientRange;`,
          )
          .replace(
            '#include <normal_fragment_begin>',
            /* glsl */ `
            if (elevationGradientEnabled > 0.5) {
              float elevationT = clamp((elevationGradientHeight - elevationGradientMinimum) / elevationGradientRange, 0.0, 1.0);
              vec3 elevationColor = elevationGradientColors[elevationGradientCount - 1];
              for (int i = 0; i < ${maximumElevationColorStops - 1}; i++) {
                if (i + 1 < elevationGradientCount && elevationT <= elevationGradientPositions[i + 1]) {
                  float blend = clamp((elevationT - elevationGradientPositions[i]) /
                    max(1e-6, elevationGradientPositions[i + 1] - elevationGradientPositions[i]), 0.0, 1.0);
                  if (elevationGradientHard > 0.5) {
                    float edge = max(1e-6, fwidth(blend) * 0.5);
                    blend = smoothstep(0.5 - edge, 0.5 + edge, blend);
                  }
                  elevationColor = mix(elevationGradientColors[i], elevationGradientColors[i + 1], blend);
                  break;
                }
              }
              diffuseColor.rgb = elevationColor;
            }
            #include <normal_fragment_begin>`,
          );
      };
    },
    setSettings(settings) {
      validateElevationGradient(settings);
      const snapshot = copyElevationGradient(settings);

      uniforms.elevationGradientEnabled.value = snapshot.enabled ? 1 : 0;
      uniforms.elevationGradientHard.value = snapshot.transition === 'hard' ? 1 : 0;
      uniforms.elevationGradientCount.value = snapshot.stops.length;

      for (let i = 0; i < maximumElevationColorStops; i++) {
        const stop = snapshot.stops[Math.min(i, snapshot.stops.length - 1)];

        uniforms.elevationGradientColors.value[i].set(stop.color);
        uniforms.elevationGradientPositions.value[i] = stop.position;
      }
    },
    setRange(minimum, maximum) {
      uniforms.elevationGradientMinimum.value = minimum;
      uniforms.elevationGradientRange.value = Math.max(1e-6, maximum - minimum);
    },
  };

  api.setSettings({
    enabled: false,
    transition: 'soft',
    stops: elevationGradientPresets.paper.stops,
  });

  return api;
}
