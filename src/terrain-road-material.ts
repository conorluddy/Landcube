import * as THREE from 'three';
import { earthNoiseShader } from './terrain-natural-material';

/** Matte asphalt whose grit and worn patches stay attached to the model while orbiting. */
export interface TerrainRoadMaterial {
  material: THREE.MeshStandardMaterial;
  /** 0 is flat paint; 1 is the strongest grit and wear. Never recompiles the shader. */
  setTexture(strength: number): void;
}

// Preview units span the model's longer side as 2, so on a 150 mm model one unit is 75 mm:
// grit cells are about a third of a 0.5 mm road, and wear patches a few road widths long.
const gritFrequency = 500;
const wearFrequency = 40;

export function createTerrainRoadMaterial(color: string): TerrainRoadMaterial {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.94,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const texture = { value: 0.5 };

  material.customProgramCacheKey = () => 'landcube-road-v1';

  material.onBeforeCompile = (shader) => {
    shader.uniforms.roadTexture = texture;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 roadPosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nroadPosition = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float roadTexture;
        varying vec3 roadPosition;
        ${earthNoiseShader}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float roadGrit = earthFbm(roadPosition * ${gritFrequency.toFixed(1)});
        float roadWear = earthFbm(roadPosition * ${wearFrequency.toFixed(1)} + 3.7);
        // Grit below a pixel would shimmer, so it fades to its mean as the view pulls back.
        float roadGritFade =
          1.0 - smoothstep(0.2, 1.2, length(fwidth(roadPosition * ${gritFrequency.toFixed(1)})));
        roadGrit = mix(0.5, roadGrit, roadGritFade);
        diffuseColor.rgb *= 1.0 + roadTexture * ((roadGrit - 0.5) * 1.1 + (roadWear - 0.5) * 1.0);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + roadTexture * (roadGrit - 0.5) * 0.2, 0.0, 1.0);`,
      );
  };

  return {
    material,
    setTexture(strength) {
      texture.value = strength;
    },
  };
}
