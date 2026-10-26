import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { TerrainFocusEffect } from './terrain-camera';

export interface TerrainTiltShift {
  /** Sharp band centre, 0 = top of frame, 1 = bottom. */
  bandPosition: number;
  /** Sharp band height as a fraction of the frame. */
  bandWidth: number;
  /** 0–1 blur strength outside the band. */
  blur: number;
}

export interface TerrainPostProcessing {
  render(): void;
  setSize(width: number, height: number, pixelRatio: number): void;
  setCamera(camera: THREE.Camera): void;
  setEffect(effect: TerrainFocusEffect): void;
  setTiltShift(settings: Readonly<TerrainTiltShift>): void;
  /** `focusDistance` is along the view axis, in world units. */
  setDepthOfField(focusDistance: number, aperture: number): void;
}

// Bokeh blur is in screen-height units; 2% keeps out-of-focus terrain legible.
const maximumBokehBlur = 0.02;
// Tilt-shift blur radius at full strength, in screen-height units.
const maximumTiltShiftBlur = 0.012;

/**
 * Lazily created focus effects. Off-band blur and depth of field run after a multisampled render;
 * `hideFromDepth` objects (screen-space contour lines) take the depth of the surface beneath them.
 */
export function createTerrainPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  hideFromDepth: readonly THREE.Object3D[],
): TerrainPostProcessing {
  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }),
  );
  const renderPass = new RenderPass(scene, camera);
  // Blur radius is in screen-height units, so the horizontal step is scaled by aspect.
  const horizontalDirection = new THREE.Vector2(1, 0);
  const horizontalBlur = new ShaderPass(createTiltShiftShader(horizontalDirection));
  const verticalBlur = new ShaderPass(createTiltShiftShader(new THREE.Vector2(0, 1)));
  const bokehPass = new BokehPass(scene, camera, { maxblur: maximumBokehBlur });
  const renderBokeh = bokehPass.render.bind(bokehPass);

  bokehPass.render = (...args) => {
    const visibility = hideFromDepth.map((object) => object.visible);

    hideFromDepth.forEach((object) => (object.visible = false));
    renderBokeh(...args);
    hideFromDepth.forEach((object, index) => (object.visible = visibility[index]));
  };

  composer.addPass(renderPass);
  composer.addPass(horizontalBlur);
  composer.addPass(verticalBlur);
  composer.addPass(bokehPass);
  composer.addPass(new OutputPass());

  return {
    render: () => {
      composer.render();
    },
    setSize(width, height, pixelRatio) {
      horizontalDirection.set(height / width, 0);
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    },
    setCamera(value) {
      renderPass.camera = value;
      bokehPass.camera = value;
    },
    setEffect(effect) {
      horizontalBlur.enabled = verticalBlur.enabled = effect === 'tilt-shift';
      bokehPass.enabled = effect === 'depth-of-field';
    },
    setTiltShift({ bandPosition, bandWidth, blur }) {
      for (const pass of [horizontalBlur, verticalBlur]) {
        pass.uniforms.bandPosition.value = bandPosition;
        pass.uniforms.halfBandWidth.value = bandWidth / 2;
        pass.uniforms.blur.value = blur * maximumTiltShiftBlur;
      }
    },
    setDepthOfField(focusDistance, aperture) {
      bokehPass.materialBokeh.uniforms.focus.value = focusDistance;
      bokehPass.materialBokeh.uniforms.aperture.value = aperture;
    },
  };
}

// === HELPERS ===

/** One axis of a separable Gaussian whose radius grows with distance from the sharp band. */
function createTiltShiftShader(direction: THREE.Vector2): THREE.ShaderMaterialParameters & {
  uniforms: Record<string, THREE.IUniform>;
} {
  return {
    uniforms: {
      tDiffuse: { value: null },
      direction: { value: direction },
      bandPosition: { value: 0.55 },
      halfBandWidth: { value: 0.125 },
      blur: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform vec2 direction;
      uniform float bandPosition;
      uniform float halfBandWidth;
      uniform float blur;
      varying vec2 vUv;

      void main() {
        float outside = max(0.0, abs((1.0 - vUv.y) - bandPosition) - halfBandWidth);
        float radius = blur * smoothstep(0.0, 0.3, outside);
        vec4 sum = vec4(0.0);
        float total = 0.0;

        for (int i = -6; i <= 6; i++) {
          float weight = exp(-float(i * i) / 18.0);

          sum += texture2D(tDiffuse, vUv + direction * radius * float(i) / 6.0) * weight;
          total += weight;
        }

        gl_FragColor = sum / total;
      }
    `,
  };
}
