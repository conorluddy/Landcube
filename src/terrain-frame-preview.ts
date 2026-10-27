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
  let meshes: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];

  return {
    group,
    update(parts, previewScale, finish) {
      const { color, roughness, opacity } = frameFinishes[finish];
      const isTranslucent = opacity !== undefined;

      for (const mesh of meshes) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }

      group.clear();
      meshes = [];

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
          color: new THREE.Color(color).offsetHSL(0, 0, isTranslucent ? 0 : -tierShadeStep * index),
          roughness,
          metalness: 0,
          // Glass shows the landscape through every wall, so both faces draw and none occlude.
          transparent: isTranslucent,
          opacity: opacity ?? 1,
          depthWrite: !isTranslucent,
          side: isTranslucent ? THREE.DoubleSide : THREE.FrontSide,
        });
        const mesh = new THREE.Mesh(rendered, material);

        mesh.name = part.id;
        mesh.castShadow = !isTranslucent;
        mesh.receiveShadow = true;
        meshes.push(mesh);
        group.add(mesh);
      }
    },
  };
}
