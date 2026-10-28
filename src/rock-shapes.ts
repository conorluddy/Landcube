import * as THREE from 'three';
import type { RockStyle } from './types/rocks';

type RockShapeStyle = Pick<RockStyle, 'angularity' | 'flattening' | 'elongation'>;

/**
 * A low-poly rock about one unit across, resting on y = 0 and centred over the origin. A lumpy
 * sphere is chipped by seeded cutting planes, so higher angularity gives more, deeper facets.
 * Faces are flat-shaded, so every chip catches the light on its own.
 */
export function createRockShape(index: number, style: RockShapeStyle): THREE.BufferGeometry {
  const random = createRandom(0x51a7e + index * 977);
  const sphere = new THREE.IcosahedronGeometry(0.5, 1);
  const positions = sphere.getAttribute('position');
  const lumps = Array.from({ length: 5 }, () => randomDirection(random));
  const cuts = Array.from({ length: 2 + Math.round(style.angularity * 6) }, () => ({
    normal: randomDirection(random),
    // Deeper cuts at high angularity; a minimum keeps every rock visibly chipped.
    depth: 0.5 - 0.06 - style.angularity * 0.16 * random(),
  }));
  const vertex = new THREE.Vector3();

  for (let offset = 0; offset < positions.count; offset++) {
    vertex.fromBufferAttribute(positions, offset);
    // Lumps depend only on direction, so vertices shared by faces move together and never crack.
    const direction = vertex.clone().normalize();
    const lump = lumps.reduce((total, axis) => total + Math.max(0, direction.dot(axis)) ** 3, 0);

    vertex.multiplyScalar(1 + (lump - 0.6) * (0.18 + 0.12 * (1 - style.angularity)));

    for (const cut of cuts) {
      const reach = vertex.dot(cut.normal);

      if (reach > cut.depth) {
        vertex.addScaledVector(cut.normal, cut.depth - reach);
      }
    }

    vertex.set(
      vertex.x * (1 + style.elongation * 0.8),
      vertex.y * (1 - style.flattening * 0.6),
      vertex.z * (1 - style.elongation * 0.15),
    );
    positions.setXYZ(offset, vertex.x, vertex.y, vertex.z);
  }

  const geometry = sphere.index ? sphere.toNonIndexed() : sphere;

  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox ?? new THREE.Box3();
  const size = bounds.getSize(new THREE.Vector3());
  const across = Math.max(size.x, size.z);

  // Normalised so a rock's size setting is its width across, standing on the ground.
  geometry.translate(
    -(bounds.min.x + bounds.max.x) / 2,
    -bounds.min.y,
    -(bounds.min.z + bounds.max.z) / 2,
  );
  geometry.scale(1 / across, 1 / across, 1 / across);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  return geometry;
}

// === HELPERS ===

/** Mulberry32: tiny, seeded and identical on every platform. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);

    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomDirection(random: () => number): THREE.Vector3 {
  const z = random() * 2 - 1;
  const angle = random() * Math.PI * 2;
  const radius = Math.sqrt(1 - z * z);

  return new THREE.Vector3(Math.cos(angle) * radius, z, Math.sin(angle) * radius);
}
