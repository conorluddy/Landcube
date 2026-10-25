import { defaultTerrainLighting, type TerrainLightingSettings } from './terrain-lighting';
import { createTerrainLineBuffers } from './terrain-3d-lines';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { createTerrainSurfaceBuffers, terrain3dElevationScale } from './terrain-surface';
import type { HeightField } from './types/terrain';
import { seaLevelHatchSpacing, seaLevelHatchOpacity } from './constants/sea-level';
import type { SeaLevelGeometry } from './sea-level';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Contour } from './types/contours';
import type { DesignSettings } from './types/design';

/** An optional, session-only raised-contour preview of the shared landscape. */
export interface Terrain3d {
  update(
    contours: Contour[],
    width: number,
    height: number,
    settings: DesignSettings,
    field: HeightField,
    seaLevel?: SeaLevelGeometry,
  ): void;
  setVisible(value: boolean): void;
  setHeight(value: number): void;
  setSurface(value: boolean): void;
  setContours(value: boolean): void;
  setSurfaceColor(value: string | undefined): void;
  setRotating(value: boolean): void;
  setLighting(settings: Readonly<TerrainLightingSettings>): void;
  reset(): void;
}

export function createTerrain3d(): Terrain3d {
  const renderer = new THREE.WebGLRenderer({ antialias: true });

  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.domElement.className = 'terrain-3d';
  renderer.domElement.setAttribute(
    'aria-label',
    'Interactive 3D terrain. Drag to orbit; scroll to zoom.',
  );
  document.body.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
  const controls = new OrbitControls(camera, renderer.domElement);

  controls.minDistance = 0.5;
  controls.maxDistance = 12;
  controls.maxPolarAngle = Math.PI * 0.49;
  const lineLayers = {
    ordinary: new LineSegments2(
      new LineSegmentsGeometry(),
      new LineMaterial({ transparent: true, depthWrite: false }),
    ),
    solid: new LineSegments2(
      new LineSegmentsGeometry(),
      new LineMaterial({ transparent: true, depthWrite: false }),
    ),
    dashed: new LineSegments2(
      new LineSegmentsGeometry(),
      new LineMaterial({ transparent: true, depthWrite: false, dashed: true }),
    ),
  };
  const contourLayer = new THREE.Group();

  contourLayer.add(...Object.values(lineLayers));
  let customSurfaceColor: string | undefined;
  let backgroundColor = '#202326';

  const surfaceMaterial = new THREE.MeshStandardMaterial({
    color: backgroundColor,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });
  const surface = new THREE.Mesh(new THREE.BufferGeometry(), surfaceMaterial);
  const sunlight = new THREE.DirectionalLight(0xfff4df, defaultTerrainLighting.intensity);
  const fillLight = new THREE.HemisphereLight(0xe8f0ff, 0x36382c, defaultTerrainLighting.fill);

  /** Positions the sun independently of the camera and terrain height. */
  const applyLighting = (lighting: Readonly<TerrainLightingSettings>) => {
    const direction = THREE.MathUtils.degToRad(lighting.direction);
    const elevation = THREE.MathUtils.degToRad(lighting.elevation);
    const radius = 5;

    sunlight.position.set(
      radius * Math.cos(elevation) * Math.sin(direction),
      radius * Math.sin(elevation),
      radius * Math.cos(elevation) * Math.cos(direction),
    );
    sunlight.intensity = lighting.intensity;
    fillLight.intensity = lighting.fill;
  };

  applyLighting(defaultTerrainLighting);
  scene.add(fillLight, sunlight);
  let previousField: HeightField | undefined;
  let previousWidth = 0;
  let previousHeight = 0;

  const seaInk = new THREE.Color();
  const seaMaterial = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: {
      ink: { value: seaInk },
      spacing: { value: seaLevelHatchSpacing * Math.SQRT2 },
      opacity: { value: seaLevelHatchOpacity },
    },
    vertexShader: `varying vec2 mapPosition;
      void main() {
        mapPosition = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `uniform vec3 ink; uniform float spacing; uniform float opacity; varying vec2 mapPosition;
      void main() {
        float phase = abs(mod(mapPosition.x + mapPosition.y + spacing * 0.5, spacing) - spacing * 0.5);
        float edge = max(fwidth(phase), 0.001);
        float stripe = 1.0 - smoothstep(spacing * 0.25 - edge * 0.5, spacing * 0.25 + edge * 0.5, phase);
        gl_FragColor = vec4(ink, stripe * opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sea = new THREE.Mesh(new THREE.BufferGeometry(), seaMaterial);
  const landscape = new THREE.Group();

  landscape.add(surface, contourLayer, sea);
  scene.add(landscape);
  let visible = false;
  let rotating = false;
  let previousTime = performance.now();

  const draw = () => {
    if (visible && !document.hidden) {
      renderer.render(scene, camera);
    }
  };

  controls.addEventListener('change', draw);

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    draw();
  };

  const reset = () => {
    camera.position.set(0, 2.1, 2.5);
    controls.target.set(0, 0, 0);
    controls.update();
    draw();
  };

  const updateLoop = () => {
    renderer.setAnimationLoop(
      visible && rotating && !document.hidden
        ? () => {
            const now = performance.now();

            controls.update(Math.min((now - previousTime) / 1000, 0.05));
            previousTime = now;
            draw();
          }
        : null,
    );
  };

  document.addEventListener('visibilitychange', () => {
    previousTime = performance.now();
    updateLoop();
    draw();
  });
  window.addEventListener('pagehide', () => {
    renderer.setAnimationLoop(null);
  });
  window.addEventListener('pageshow', () => {
    previousTime = performance.now();
    updateLoop();
    draw();
  });
  window.addEventListener('resize', resize);
  resize();
  reset();

  return {
    update(
      contours: Contour[],
      width: number,
      height: number,
      settings: DesignSettings,
      field: HeightField,
      seaLevel?: SeaLevelGeometry,
    ) {
      if (field !== previousField || width !== previousWidth || height !== previousHeight) {
        const buffers = createTerrainSurfaceBuffers(field, width, height);
        const surfaceGeometry = new THREE.BufferGeometry();

        surfaceGeometry.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
        surfaceGeometry.setIndex(new THREE.BufferAttribute(buffers.indices, 1));
        surfaceGeometry.computeVertexNormals();
        surface.geometry.dispose();
        surface.geometry = surfaceGeometry;
        previousField = field;
        previousWidth = width;
        previousHeight = height;
      }

      const scale = 2 / Math.max(width, height);
      const lineBuffers = createTerrainLineBuffers(contours, width, height, settings);

      for (const style of ['ordinary', 'solid', 'dashed'] as const) {
        const layer = lineLayers[style];
        const buffers = lineBuffers[style];
        const geometry = new LineSegmentsGeometry();

        if (buffers.positions.length > 0) {
          geometry.setPositions(buffers.positions);
          geometry.setAttribute(
            'instanceDistanceStart',
            new THREE.InstancedBufferAttribute(new Float32Array(buffers.distanceStarts), 1),
          );
          geometry.setAttribute(
            'instanceDistanceEnd',
            new THREE.InstancedBufferAttribute(new Float32Array(buffers.distanceEnds), 1),
          );
        }

        layer.geometry.dispose();
        layer.geometry = geometry;
        layer.visible = buffers.positions.length > 0;
        layer.material.color.set(settings.lineColor);
        layer.material.opacity = settings.strokeOpacity;
        layer.material.linewidth =
          style === 'ordinary' ? settings.strokeWidth : settings.indexStrokeWidth;
        layer.material.dashSize = settings.dashLength;
        layer.material.gapSize = settings.dashGap;
      }

      const seaPositions: number[] = [];
      const seaUvs: number[] = [];

      for (const polygon of seaLevel?.polygons ?? []) {
        for (let index = 1; index < polygon.length - 1; index++) {
          for (const point of [polygon[0], polygon[index], polygon[index + 1]]) {
            seaPositions.push(
              (point.x - width / 2) * scale,
              (seaLevel?.elevation ?? 0) * terrain3dElevationScale + 0.001,
              (point.y - height / 2) * scale,
            );
            seaUvs.push(point.x, point.y);
          }
        }
      }

      const seaGeometry = new THREE.BufferGeometry();

      seaGeometry.setAttribute('position', new THREE.Float32BufferAttribute(seaPositions, 3));
      seaGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(seaUvs, 2));
      sea.geometry.dispose();
      sea.geometry = seaGeometry;
      sea.visible = seaPositions.length > 0;
      seaInk.set(settings.lineColor);
      backgroundColor = settings.background;
      surfaceMaterial.color.set(customSurfaceColor ?? backgroundColor);
      scene.background = new THREE.Color(settings.background);
      draw();
    },
    setVisible(value: boolean) {
      visible = value;
      renderer.domElement.hidden = !value;
      controls.enabled = value;
      previousTime = performance.now();
      updateLoop();
      draw();
    },
    setHeight(value: number) {
      // A near-flat scale keeps the lighting normal matrix invertible at zero height.
      landscape.scale.y = Math.max(value, 0.0001);
      draw();
    },
    setContours(value: boolean) {
      contourLayer.visible = value;
      draw();
    },
    setSurface(value: boolean) {
      surface.visible = value;
      draw();
    },
    setSurfaceColor(value: string | undefined) {
      customSurfaceColor = value;
      surfaceMaterial.color.set(value ?? backgroundColor);
      draw();
    },
    setLighting(lighting: Readonly<TerrainLightingSettings>) {
      applyLighting(lighting);
      draw();
    },
    setRotating(value: boolean) {
      rotating = value;
      controls.autoRotate = value;
      previousTime = performance.now();
      updateLoop();
    },
    reset,
  };
}
