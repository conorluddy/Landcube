import * as THREE from 'three';
import type { FramePart } from './types/frame';

/** Walnut, bone, ink: fixed per part so separate tiers read as contrasting prints (#35 OQ-1). */
export const framePartColors = ['#6b4a32', '#e8e0d0', '#2a2a2e'] as const;

// === PUBLIC API ===

/**
 * Preview meshes for frame parts, in the landscape's scene units. Never part of the model
 * STL; each part downloads separately.
 */
export function createTerrainFramePreview(): {
  group: THREE.Group;
  update(parts: readonly FramePart[], previewScale: number): void;
} {
  const group = new THREE.Group();
  const materials = framePartColors.map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0 }),
  );

  return {
    group,
    update(parts, previewScale) {
      for (const mesh of group.children as THREE.Mesh[]) {
        mesh.geometry.dispose();
      }

      group.clear();

      for (const [index, part] of parts.entries()) {
        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(
            Float32Array.from(part.solid.positions, (value) => value * previewScale),
            3,
          ),
        );
        geometry.setIndex(new THREE.BufferAttribute(part.solid.indices, 1));

        // Unshared vertices give flat normals, keeping the profile corners crisp.
        const rendered = geometry.toNonIndexed();

        geometry.dispose();
        rendered.computeVertexNormals();
        const mesh = new THREE.Mesh(rendered, materials[index % materials.length]);

        mesh.name = part.id;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
    },
  };
}
