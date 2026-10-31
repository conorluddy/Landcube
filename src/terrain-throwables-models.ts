import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Projectile, Throwable } from './terrain-throwables';

/** Procedural low-poly hurl, sliotar and boomerang: a held viewmodel plus the thrown mesh. */
export interface ThrowableModels {
  /** Follows the camera each frame; the camera itself isn't in the scene. */
  viewmodel: THREE.Group;
  projectileMesh: THREE.Group;
  setScale(eyeHeight: number): void;
  getHandPosition(target: THREE.Vector3): THREE.Vector3;
  setProjectile(projectile: Projectile | undefined, heldItem: Throwable): void;
  updateViewmodel(camera: THREE.Camera, pose: ViewmodelPose): void;
  dispose(): void;
}

export interface ViewmodelPose {
  heldItem: Throwable;
  isThrown: boolean;
  /** 0–1 pull-back while the button is held. */
  charge: number;
  /** 0–1 progress through the release swing; 1 at rest. */
  swing: number;
  elapsedSeconds: number;
}

// Hand offset from the eye, in eye heights: lower right, just past the near plane.
const handOffset = new THREE.Vector3(0.75, -0.88, -0.85);
const spinRadiansPerSecond = 18;
/** How quickly the held item catches up with the look; lower trails further. */
const lookFollowPerSecond = 14;
// The off hand holds the sliotar left of the hurl, ready to toss it up while charging.
const sliotarInOffHand = new THREE.Vector3(-1.1, 0.36, 0);
const sliotarTossEyeHeights = 0.25;
/** Long enough that the grip end sits off-screen, in eye heights. */
const hurlLengthEyeHeights = 1.25;

// === PUBLIC API ===

export function createThrowableModels(): ThrowableModels {
  const ash = new THREE.MeshStandardMaterial({ color: 0xd8b98a, roughness: 0.7 });
  const leather = new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.6 });
  const seam = new THREE.MeshStandardMaterial({ color: 0x9a3b2e, roughness: 0.8 });
  const boomerangWood = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.6 });
  const viewmodel = new THREE.Group();
  const hand = new THREE.Group();
  const hurl = createHurl(ash);

  void replaceWithModelledHurl(hurl, ash);
  const heldSliotar = createSliotar(leather, seam);
  const heldBoomerang = createBoomerang(boomerangWood);
  const projectileMesh = new THREE.Group();
  const thrownSliotar = createSliotar(leather, seam);
  const thrownBoomerang = createBoomerang(boomerangWood);
  let eyeHeight = 1;
  let hasSettledPose = false;

  heldSliotar.position.copy(sliotarInOffHand);
  heldBoomerang.rotation.set(1.1, 0, 0.4);
  hand.add(hurl, heldSliotar, heldBoomerang);
  viewmodel.add(hand);
  projectileMesh.add(thrownSliotar, thrownBoomerang);
  projectileMesh.visible = false;

  return {
    viewmodel,
    projectileMesh,
    setScale(nextEyeHeight) {
      eyeHeight = nextEyeHeight;
      // A new walk snaps to the eye instead of swinging in from the last one.
      hasSettledPose = false;
      viewmodel.scale.setScalar(eyeHeight);
      projectileMesh.scale.setScalar(eyeHeight);
    },
    getHandPosition(target) {
      return hand.getWorldPosition(target);
    },
    setProjectile(projectile, heldItem) {
      projectileMesh.visible = projectile !== undefined;
      thrownSliotar.visible = projectile?.item === 'sliotar';
      thrownBoomerang.visible = projectile?.item === 'boomerang';

      if (projectile) {
        projectileMesh.position.copy(projectile.position);
      }

      hurl.visible = heldItem === 'sliotar';
      heldSliotar.visible = heldItem === 'sliotar' && !projectile;
      heldBoomerang.visible = heldItem === 'boomerang' && !projectile;
    },
    updateViewmodel(camera, { heldItem, charge, swing, elapsedSeconds }) {
      camera.updateMatrixWorld();
      camera.matrixWorld.decompose(viewmodel.position, scratchQuaternion, scratchScale);
      // The hurl trails the look slightly, as if carried by an arm rather than bolted to the eye.
      viewmodel.quaternion.slerp(
        scratchQuaternion,
        hasSettledPose ? 1 - Math.exp(-lookFollowPerSecond * elapsedSeconds) : 1,
      );
      hasSettledPose = true;
      viewmodel.scale.setScalar(eyeHeight);
      hand.position.copy(handOffset);
      poseHand(hand, heldItem, charge, swing);
      heldSliotar.position
        .copy(sliotarInOffHand)
        .setY(sliotarInOffHand.y + charge * sliotarTossEyeHeights);

      if (projectileMesh.visible && thrownBoomerang.visible) {
        thrownBoomerang.rotation.y += spinRadiansPerSecond * elapsedSeconds;
      } else if (projectileMesh.visible) {
        thrownSliotar.rotation.x += spinRadiansPerSecond * elapsedSeconds;
      }
    },
    dispose() {
      for (const root of [viewmodel, projectileMesh]) {
        root.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            (object.geometry as THREE.BufferGeometry).dispose();
          }
        });
      }

      for (const material of [ash, leather, seam, boomerangWood]) {
        material.dispose();
      }
    },
  };
}

// === HELPERS ===

const scratchScale = new THREE.Vector3();
const scratchQuaternion = new THREE.Quaternion();

/** Charge pulls the item back; the swing sweeps through (hurl: sideways arc; boomerang: overhand). */
function poseHand(hand: THREE.Group, heldItem: Throwable, charge: number, swing: number) {
  const follow = Math.sin(Math.PI * Math.min(swing, 1));

  hand.rotation.set(0, 0, 0);

  if (heldItem === 'sliotar') {
    hand.rotation.y = charge * 0.9 - follow * 1.4;
    hand.rotation.z = -0.3;
    hand.position.x += charge * 0.15 - follow * 0.3;
  } else {
    hand.rotation.x = charge * 0.9 - follow * 1.6;
    hand.position.y += charge * 0.12 - follow * 0.1;
  }
}

/** Swaps in the modelled hurl once it loads; the procedural one stays if it can't. */
async function replaceWithModelledHurl(hurl: THREE.Group, material: THREE.Material) {
  // Read lazily: Vite's env doesn't exist when tests load this module in Node.
  const hurlModelUrl = `${import.meta.env.BASE_URL}models/hurl.glb`;

  try {
    const gltf = await new GLTFLoader().loadAsync(hurlModelUrl);
    const mesh = gltf.scene.getObjectByProperty('isMesh', true);

    if (!(mesh instanceof THREE.Mesh)) {
      throw new Error(`${hurlModelUrl} has no mesh`);
    }

    hurl.clear();
    hurl.add(new THREE.Mesh(fitHurlGeometry(mesh as THREE.Mesh), material));
    // Across the lower view, as when held: the grip off-screen right, rising to the bas at left.
    hurl.rotation.set(-0.15, 0, THREE.MathUtils.degToRad(90 - 9));
  } catch (error) {
    console.warn(JSON.stringify({ event: 'hurl_model_failed', message: String(error) }));
  }
}

/** Bakes the node transform, stands the long axis upright, and sizes it like the procedural hurl. */
function fitHurlGeometry(mesh: THREE.Mesh) {
  mesh.updateWorldMatrix(true, false);
  const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);

  geometry.computeBoundingBox();
  const size = geometry.boundingBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3(1, 1, 1);

  // The model lies flat along X; turn it to run up Y like the procedural handle.
  if (size.x >= size.y && size.x >= size.z) {
    // Bas down, and its face (the model's thin axis) towards the eye.
    geometry.rotateZ(-Math.PI / 2).rotateY(Math.PI / 2);
  } else if (size.z >= size.y) {
    geometry.rotateX(-Math.PI / 2);
  }

  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new THREE.Box3();
  const length = box.max.y - box.min.y;

  geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  const fit = hurlLengthEyeHeights / length;

  geometry.scale(fit, fit, fit);
  // Turned over about the shaft so the bas's toe points up when held across the view.
  geometry.rotateY(Math.PI);

  return geometry;
}

/** A flattened bas on an ash handle, in eye-height units, held up and slightly across. */
function createHurl(material: THREE.Material) {
  const group = new THREE.Group();
  const bas = new THREE.Shape();

  bas.moveTo(-0.05, 0);
  bas.quadraticCurveTo(-0.1, -0.1, -0.02, -0.17);
  bas.quadraticCurveTo(0.08, -0.15, 0.06, -0.05);
  bas.lineTo(0.02, 0);
  bas.closePath();

  const basMesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(bas, { depth: 0.015, bevelEnabled: false }),
    material,
  );
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.45, 8), material);

  handle.position.y = 0.22;
  basMesh.position.z = -0.0075;
  group.add(handle, basMesh);
  group.rotation.set(0.3, 0, 0.5);

  return group;
}

/** A white ball with a raised seam ring, sized to its physics radius. */
function createSliotar(leather: THREE.Material, seam: THREE.Material) {
  const group = new THREE.Group();
  const radius = 0.06;
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), leather);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.12, 4, 16), seam);

  group.add(ball, ring);

  return group;
}

/** An extruded V, lying flat so it spins about its vertical axis. */
function createBoomerang(material: THREE.Material) {
  const shape = new THREE.Shape();

  shape.moveTo(-0.3, 0.12);
  shape.quadraticCurveTo(0, 0.02, 0.3, 0.12);
  shape.lineTo(0.3, 0.06);
  shape.quadraticCurveTo(0, -0.08, -0.3, 0.06);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });

  geometry.center();
  geometry.rotateX(-Math.PI / 2);

  return new THREE.Mesh(geometry, material);
}
