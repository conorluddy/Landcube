import * as THREE from 'three';
import { interpolateTerrainValues } from './terrain-transition';

/** Blends destination terrain geometry from the previous mesh in place, then restores it exactly. */
export interface TerrainMeshMorph {
  /** Writes the blend at `progress` (0 = previous, 1 = destination) into the destination geometry. */
  apply(progress: number): void;
  /** Restores the exact destination attributes, normals and bounds. */
  finish(): void;
}

export interface TerrainGeometryPair {
  previous: THREE.BufferGeometry;
  next: THREE.BufferGeometry;
}

const morphedAttributeNames = [
  'position',
  'gradientElevation',
  'contourElevation',
  'terrainDepth',
] as const;

interface MorphTrack {
  attribute: THREE.BufferAttribute & { array: Float32Array };
  source: Float32Array;
  destination: Float32Array;
}

// === PUBLIC API ===

/** Returns undefined when the two terrains do not share a vertex layout, so the caller snaps. */
export function createTerrainMeshMorph(
  pairs: readonly TerrainGeometryPair[],
): TerrainMeshMorph | undefined {
  const tracks: MorphTrack[] = [];
  const savedNormals: Pick<MorphTrack, 'attribute' | 'destination'>[] = [];

  for (const { previous, next } of pairs) {
    if (previous.index?.count !== next.index?.count) {
      return undefined;
    }

    for (const name of morphedAttributeNames) {
      if (!previous.hasAttribute(name) && !next.hasAttribute(name)) {
        continue;
      }

      const from = readFloatAttribute(previous, name);
      const to = readFloatAttribute(next, name);

      if (!from || to?.count !== from.count || to.itemSize !== from.itemSize) {
        return undefined;
      }

      tracks.push({
        attribute: to,
        source: Float32Array.from(from.array),
        destination: Float32Array.from(to.array),
      });
    }

    const normal = readFloatAttribute(next, 'normal');

    if (!normal) {
      return undefined;
    }

    savedNormals.push({ attribute: normal, destination: normal.array.slice() });
  }

  const geometries = pairs.map(({ next }) => next);

  return {
    apply(progress: number) {
      for (const { attribute, source, destination } of tracks) {
        interpolateTerrainValues(source, destination, progress, attribute.array);
        attribute.needsUpdate = true;
      }

      for (const geometry of geometries) {
        geometry.computeVertexNormals();
      }
    },
    finish() {
      for (const { attribute, destination } of [...tracks, ...savedNormals]) {
        attribute.array.set(destination);
        attribute.needsUpdate = true;
      }

      for (const geometry of geometries) {
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
      }
    },
  };
}

// === HELPERS ===

function readFloatAttribute(
  geometry: THREE.BufferGeometry,
  name: string,
): MorphTrack['attribute'] | undefined {
  if (!geometry.hasAttribute(name)) {
    return undefined;
  }

  const attribute = geometry.getAttribute(name);

  return attribute instanceof THREE.BufferAttribute && attribute.array instanceof Float32Array
    ? (attribute as MorphTrack['attribute'])
    : undefined;
}
