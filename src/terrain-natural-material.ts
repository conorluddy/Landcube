import * as THREE from 'three';

/** Object-space textures stay attached to the cut model, without UV seams or image downloads. */
const naturalShader = /* glsl */ `
  varying vec3 naturalPosition;
  varying vec3 naturalNormal;
  varying float naturalDepth;

  float earthHash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float earthNoise(vec3 p) {
    vec3 cell = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(earthHash(cell), earthHash(cell + vec3(1,0,0)), f.x),
          mix(earthHash(cell + vec3(0,1,0)), earthHash(cell + vec3(1,1,0)), f.x), f.y),
      mix(mix(earthHash(cell + vec3(0,0,1)), earthHash(cell + vec3(1,0,1)), f.x),
          mix(earthHash(cell + vec3(0,1,1)), earthHash(cell + vec3(1,1,1)), f.x), f.y), f.z);
  }

  float earthFbm(vec3 p) {
    return earthNoise(p) * 0.57 + earthNoise(p * 2.03 + 7.1) * 0.28
      + earthNoise(p * 4.11 + 13.4) * 0.15;
  }

  vec3 earthColor(vec3 srgb) {
    return pow(srgb, vec3(2.2));
  }
`;

/** Keeps Three's physical lighting, shadows and color management for both natural materials. */
export function createNaturalTerrainMaterial(cutaway: boolean): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.96,
    metalness: 0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });

  material.customProgramCacheKey = () => `topogra-natural-v1-${cutaway}`;

  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float terrainDepth;
        varying vec3 naturalPosition;
        varying vec3 naturalNormal;
        varying float naturalDepth;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        naturalPosition = position;
        naturalNormal = normal;
        naturalDepth = terrainDepth;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${naturalShader}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 p = naturalPosition;
        float broad = earthFbm(p * 7.0);
        float grit = earthFbm(p * 180.0);
        float detailFade = 1.0 - smoothstep(0.2, 1.2, length(fwidth(p * 180.0)));
        grit = mix(0.5, grit, detailFade);
        float relief;
        vec3 earth;
        ${
          cutaway
            ? /* glsl */ `
        float depth = max(0.0, naturalDepth);
        // Shallow horizons drape over the edge; deeper beds settle toward horizontal.
        float top = p.y + depth;
        float bedding = p.y - top * 0.65 * exp(-depth * 3.5);
        bedding += (earthFbm(vec3(p.x * 5.0, 0.0, p.z * 5.0)) - 0.5) * 0.018;
        float phase = bedding * 42.0 + (broad - 0.5) * 0.45;
        float bed = floor(phase);
        float band = earthHash(vec3(bed, 2.0, 7.0));
        float seam = 1.0 - smoothstep(0.015, max(0.06, fwidth(phase)), abs(fract(phase) - 0.5));
        earth = mix(earthColor(vec3(0.36, 0.33, 0.28)),
                    earthColor(vec3(0.65, 0.57, 0.44)), band);
        earth *= 0.85 + broad * 0.3 + (grit - 0.5) * 0.5;
        earth *= 1.0 - seam * 0.24;
        vec3 soil = earthColor(vec3(0.25, 0.20, 0.14)) * (0.7 + grit * 0.6);
        float soilDepth = 0.012 + broad * 0.015;
        earth = mix(soil, earth, smoothstep(soilDepth * 0.65, soilDepth * 1.4, depth));
        // A narrow moss/root horizon joins the surface to the exposed earth.
        earth = mix(earthColor(vec3(0.30, 0.33, 0.20)), earth,
                    smoothstep(0.001, 0.006, depth));
        relief = grit * 0.0011 - seam * 0.0005;
        `
            : /* glsl */ `
        float slope = 1.0 - abs(normalize(naturalNormal).y);
        float rock = smoothstep(0.055, 0.30, slope + (broad - 0.5) * 0.13);
        float patches = earthFbm(p * 13.0 + vec3(4.0, 0.0, 9.0));
        vec3 soil = earthColor(vec3(0.43, 0.36, 0.25));
        vec3 moss = mix(earthColor(vec3(0.30, 0.34, 0.20)),
                        earthColor(vec3(0.46, 0.46, 0.28)), broad);
        vec3 stone = mix(earthColor(vec3(0.40, 0.41, 0.38)),
                         earthColor(vec3(0.64, 0.61, 0.53)), broad);
        earth = mix(soil, moss, smoothstep(0.30, 0.63, patches));
        earth = mix(earth, stone, rock);
        earth *= 0.78 + broad * 0.35 + grit * 0.22;
        float fissure = 1.0 - smoothstep(0.015, 0.065,
          abs(earthNoise(p * 65.0 + broad) - 0.48));
        earth *= 1.0 - fissure * rock * 0.18;
        relief = grit * 0.0012 - fissure * rock * 0.0006;
        `
        }
        diffuseColor.rgb *= earth;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        // Surface-gradient bump mapping adds grain without changing the printable mesh.
        vec3 dpdx = dFdx(-vViewPosition);
        vec3 dpdy = dFdy(-vViewPosition);
        vec3 rx = cross(dpdy, normal);
        vec3 ry = cross(normal, dpdx);
        float determinant = dot(dpdx, rx) * faceDirection;
        vec3 gradient = sign(determinant) * (dFdx(relief) * rx + dFdy(relief) * ry);
        normal = normalize(max(abs(determinant), 1e-10) * normal - gradient);`,
      );
  };

  return material;
}

/** Matches each cut-wall vertex to the surface directly above it, including circular crops. */
export function createTerrainDepths(
  surfacePositions: ArrayLike<number>,
  positions: ArrayLike<number>,
  fallbackTop?: (height: number) => number,
): Float32Array {
  const heights = new Map<string, number>();
  const key = (x: number, z: number) => `${x}:${z}`;

  for (let i = 0; i < surfacePositions.length; i += 3) {
    const id = key(surfacePositions[i], surfacePositions[i + 2]);

    heights.set(id, Math.max(heights.get(id) ?? -Infinity, surfacePositions[i + 1]));
  }

  return Float32Array.from({ length: positions.length / 3 }, (_, i) => {
    const offset = i * 3;
    const top = heights.get(key(positions[offset], positions[offset + 2]));

    return Math.max(
      0,
      (top ?? fallbackTop?.(positions[offset + 1]) ?? positions[offset + 1]) -
        positions[offset + 1],
    );
  });
}
