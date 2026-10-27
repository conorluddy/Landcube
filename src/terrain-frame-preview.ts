import * as THREE from 'three';
import { frameFinishes } from './frame/frame-studio-settings';
import type { FrameFinish } from './frame/frame-studio-settings';
import type { FramePart } from './types/frame';

/** Each tier darkens a little so stacked parts still read as separate prints. */
const tierShadeStep = 0.05;

// === PUBLIC API ===

/**
 * Preview meshes for frame parts, in the landscape's scene units. Never part of the model
 * STL; each part downloads separately.
 */
export function createTerrainFramePreview(): {
  group: THREE.Group;
  update(parts: readonly FramePart[], previewScale: number, finish: FrameFinish): void;
} {
  const group = new THREE.Group();

  return {
    group,
    update(parts, previewScale, finish) {
      const { color, roughness } = frameFinishes[finish];

      for (const mesh of group.children as THREE.Mesh[]) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
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
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color).offsetHSL(0, 0, -tierShadeStep * index),
          roughness,
          metalness: 0,
        });
        const mesh = new THREE.Mesh(rendered, material);

        mesh.name = part.id;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
    },
  };
}
