import {
  landFinishes,
  waterFinishes,
  type LandFinish,
  type WaterFinish,
} from './terrain-materials';
import { createWaterVolume } from './terrain-water-volume';
import { createTerrainStage, defaultTerrainGroundColor } from './terrain-stage';
import { getTerrainWaterColor } from './terrain-water';
import { defaultTerrainLighting, type TerrainLightingSettings } from './terrain-lighting';
import { createTerrainLineBuffers } from './terrain-3d-lines';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { terrain3dElevationScale } from './terrain-surface';
import {
  createTerrainModel,
  defaultTerrainModelSettings,
  type TerrainModelSettings,
  type TerrainModel,
} from './terrain-model';
import { createBinaryStl } from './export/stl-export';
import type { HeightField } from './types/terrain';
import { seaLevelHatchSpacing, seaLevelHatchOpacity } from './constants/sea-level';
import type { SeaLevelGeometry } from './sea-level';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Contour } from './types/contours';
import type { DesignSettings } from './types/design';

export type WaterStyle = 'hatched' | 'solid' | 'off';

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
  setModelSettings(value: TerrainModelSettings): void;
  getStl(): ArrayBuffer;
  setLandFinish(value: LandFinish): void;
  setWaterFinish(value: WaterFinish): void;
  setWaterOpacity(value: number): void;
  setPreviewWaterLevel(value: number | undefined): void;
  setSurface(value: boolean): void;
  setBase(value: boolean): void;
  setGround(value: boolean): void;
  setGroundColor(value: string | undefined): void;
  setNorthArrow(value: boolean): void;
  setMapGrid(value: boolean, spanMeters: number | undefined): void;
  setWaterStyle(value: WaterStyle): void;
  setWaterColor(value: string | undefined): void;
  setContours(value: boolean): void;
  setSurfaceColor(value: string | undefined): void;
  setRotating(value: boolean): void;
  setLighting(settings: Readonly<TerrainLightingSettings>): void;
  reset(): void;
}

export function createTerrain3d(onModel: (heightMm: number) => void = () => undefined): Terrain3d {
  const renderer = new THREE.WebGLRenderer({ antialias: true });

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
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
  let customGroundColor: string | undefined = defaultTerrainGroundColor;

  const surfaceMaterial = new THREE.MeshPhysicalMaterial({
    color: backgroundColor,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });
  const surface = new THREE.Mesh(new THREE.BufferGeometry(), surfaceMaterial);
  const base = new THREE.Mesh(new THREE.BufferGeometry(), surfaceMaterial);

  surface.castShadow = surface.receiveShadow = true;
  base.castShadow = base.receiveShadow = true;
  base.visible = true;
  let solidBase = true;
  let showGround = true;
  const stage = createTerrainStage();

  const updateStageVisibility = () => {
    const enabled = showGround && base.visible;

    stage.setVisible(enabled);
    scene.background = new THREE.Color(
      enabled ? (customGroundColor ?? backgroundColor) : backgroundColor,
    );
  };

  scene.add(stage.group);
  updateStageVisibility();
  const sunlight = new THREE.DirectionalLight(0xfff4df, defaultTerrainLighting.intensity);
  const fillLight = new THREE.HemisphereLight(0xe8f0ff, 0x36382c, defaultTerrainLighting.fill);

  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  sunlight.shadow.camera.left = sunlight.shadow.camera.bottom = -4;
  sunlight.shadow.camera.right = sunlight.shadow.camera.top = 4;
  sunlight.shadow.camera.near = 0.1;
  sunlight.shadow.camera.far = 40;
  sunlight.shadow.normalBias = 0.005;
  sunlight.shadow.bias = -0.0001;
  sunlight.shadow.radius = 3;

  /** Positions the sun independently of the camera and terrain height. */
  const applyLighting = (lighting: Readonly<TerrainLightingSettings>) => {
    const direction = THREE.MathUtils.degToRad(lighting.direction);
    const elevation = THREE.MathUtils.degToRad(lighting.elevation);
    const radius = 10;

    sunlight.position.set(
      radius * Math.cos(elevation) * Math.sin(direction),
      radius * Math.sin(elevation),
      -radius * Math.cos(elevation) * Math.cos(direction),
    );
    sunlight.color.set(lighting.mode === 'moon' ? 0xa9c7ff : 0xffd09a);
    sunlight.intensity = lighting.mode === 'off' ? 0 : lighting.intensity;
    stage.setCastShadows(lighting.mode !== 'off' && lighting.intensity > 0);
    fillLight.intensity = lighting.fill;
  };

  applyLighting(defaultTerrainLighting);
  scene.add(fillLight, sunlight);
  let modelSettings: TerrainModelSettings = { ...defaultTerrainModelSettings };
  let exaggeration = 0.3;
  let model: TerrainModel | undefined;
  let modelKey = '';
  let lastUpdate: Parameters<Terrain3d['update']> | undefined;

  const rebuild = () => {
    if (lastUpdate) {
      api.update(...lastUpdate);
    }
  };

  let previousField: HeightField | undefined;

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
  const solidWaterMaterial = new THREE.MeshBasicMaterial({
    color: getTerrainWaterColor(backgroundColor),
    side: THREE.DoubleSide,
  });
  const litWaterMaterial = new THREE.MeshPhysicalMaterial({
    side: THREE.DoubleSide,
    metalness: 0,
    clearcoatRoughness: 0.12,
  });
  let waterOpacity = 0.4;
  let previewWaterLevel: number | undefined;
  let waterFinish: WaterFinish = 'graphic';
  const activeWaterMaterial = () =>
    waterFinish === 'graphic' ? solidWaterMaterial : litWaterMaterial;
  let waterStyle: WaterStyle = 'solid';
  let customWaterColor: string | undefined;

  const updateWaterColor = () => {
    const color = customWaterColor ?? getTerrainWaterColor(customSurfaceColor ?? backgroundColor);

    solidWaterMaterial.color.set(color);
    litWaterMaterial.color.set(color);
  };

  const sea = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(
    new THREE.BufferGeometry(),
    seaMaterial,
  );
  const waterSides = new THREE.Mesh(new THREE.BufferGeometry(), litWaterMaterial);

  const syncWaterSides = () => {
    waterSides.visible = sea.visible && waterFinish === 'translucent' && waterStyle === 'solid';
  };

  const landscape = new THREE.Group();

  landscape.add(surface, base, contourLayer, sea, waterSides);
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

  const api: Terrain3d = {
    update(
      contours: Contour[],
      width: number,
      height: number,
      settings: DesignSettings,
      field: HeightField,
      seaLevel?: SeaLevelGeometry,
    ) {
      lastUpdate = [contours, width, height, settings, field, seaLevel];
      const key = JSON.stringify([width, height, modelSettings, exaggeration]);

      if (field !== previousField || key !== modelKey) {
        model = createTerrainModel(field, width, height, modelSettings, exaggeration);
        const previewScale =
          2 /
          (modelSettings.cropShape === 'circle'
            ? modelSettings.widthMm
            : Math.max(modelSettings.widthMm, modelSettings.lengthMm));

        for (const [mesh, buffers] of [
          [surface, model.surface],
          [base, model.base],
        ] as const) {
          const geometry = new THREE.BufferGeometry();

          geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(
              Float32Array.from(buffers.positions, (value) => value * previewScale),
              3,
            ),
          );
          geometry.setIndex(new THREE.BufferAttribute(buffers.indices, 1));
          // Independent face vertices keep the base edges crisp.
          const rendered = mesh === base ? geometry.toNonIndexed() : geometry;

          rendered.computeVertexNormals();

          if (rendered !== geometry) {
            geometry.dispose();
          }

          mesh.geometry.dispose();
          mesh.geometry = rendered;
        }

        previousField = field;
        modelKey = key;
        onModel(model.overallHeightMm);
      }

      const previewScale =
        2 /
        (modelSettings.cropShape === 'circle'
          ? modelSettings.widthMm
          : Math.max(modelSettings.widthMm, modelSettings.lengthMm));

      if (!model) {
        throw new Error('Terrain model is unavailable.');
      }

      const elevationOffset = model.elevationOffsetMm * previewScale;

      const scale = 2 / Math.max(width, height);
      const lineBuffers = createTerrainLineBuffers(
        contours,
        width,
        height,
        settings,
        modelSettings.cropShape,
      );

      for (const buffers of Object.values(lineBuffers)) {
        for (let offset = 1; offset < buffers.positions.length; offset += 3) {
          buffers.positions[offset] =
            (buffers.positions[offset] - 0.0008) * exaggeration + elevationOffset + 0.0008;
        }
      }

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

      let level = seaLevel?.elevation;

      if (previewWaterLevel !== undefined) {
        let minimum = Infinity;
        let maximum = -Infinity;

        for (const value of field.values) {
          minimum = Math.min(minimum, value);
          maximum = Math.max(maximum, value);
        }

        level = minimum + (maximum - minimum) * previewWaterLevel;
      }

      const water =
        level === undefined
          ? { top: [], sides: [] }
          : createWaterVolume(
              surface.geometry.getAttribute('position').array,
              model.surface.indices,
              level * terrain3dElevationScale * exaggeration + elevationOffset + 0.00005,
            );
      const seaUvs: number[] = [];

      for (let i = 0; i < water.top.length; i += 3) {
        seaUvs.push(water.top[i] / scale + width / 2, water.top[i + 2] / scale + height / 2);
      }

      for (const [mesh, positions] of [
        [sea, water.top],
        [waterSides, water.sides],
      ] as const) {
        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

        if (mesh === sea) {
          geometry.setAttribute('uv', new THREE.Float32BufferAttribute(seaUvs, 2));
        }

        geometry.computeVertexNormals();
        mesh.geometry.dispose();
        mesh.geometry = geometry;
      }

      sea.visible = waterStyle !== 'off' && water.top.length > 0;
      syncWaterSides();
      seaInk.set(settings.lineColor);
      backgroundColor = settings.background;
      surfaceMaterial.color.set(customSurfaceColor ?? backgroundColor);
      updateWaterColor();
      updateStageVisibility();
      stage.update(
        modelSettings.widthMm * previewScale,
        (modelSettings.cropShape === 'circle' ? modelSettings.widthMm : modelSettings.lengthMm) *
          previewScale,
        customGroundColor ?? settings.background,
        modelSettings.cropShape === 'circle',
      );
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
      exaggeration = value;
      rebuild();
    },
    setModelSettings(value: TerrainModelSettings) {
      modelSettings = { ...value };
    },
    getStl() {
      if (!model) {
        throw new Error('Enable the 3D view before downloading STL.');
      }

      return createBinaryStl(model.solid);
    },
    setContours(value: boolean) {
      contourLayer.visible = value;
      draw();
    },
    setLandFinish(value: LandFinish) {
      surfaceMaterial.roughness = landFinishes[value].roughness;
      surfaceMaterial.clearcoat = landFinishes[value].clearcoat;
      draw();
    },
    setWaterFinish(value: WaterFinish) {
      waterFinish = value;
      litWaterMaterial.transparent = value === 'translucent';
      litWaterMaterial.opacity = value === 'translucent' ? waterOpacity : 1;
      litWaterMaterial.depthWrite = value !== 'translucent';
      litWaterMaterial.needsUpdate = true;
      litWaterMaterial.roughness = waterFinishes[value].roughness;
      litWaterMaterial.clearcoat = waterFinishes[value].clearcoat;
      syncWaterSides();

      if (waterStyle === 'solid') {
        sea.material = activeWaterMaterial();
      }

      draw();
    },
    setSurface(value: boolean) {
      surface.visible = value;
      base.visible = value && solidBase;
      updateStageVisibility();
      draw();
    },
    setWaterStyle(value: WaterStyle) {
      waterStyle = value;
      sea.material = value === 'solid' ? activeWaterMaterial() : seaMaterial;
      sea.visible =
        value !== 'off' &&
        previousField !== undefined &&
        sea.geometry.getAttribute('position').count > 0;
      syncWaterSides();
      draw();
    },
    setWaterOpacity(value: number) {
      waterOpacity = Math.max(0, Math.min(1, value));

      if (waterFinish === 'translucent') {
        litWaterMaterial.opacity = waterOpacity;
      }

      draw();
    },
    setPreviewWaterLevel(value: number | undefined) {
      previewWaterLevel = value;
      rebuild();
    },
    setWaterColor(value: string | undefined) {
      customWaterColor = value;
      updateWaterColor();
      draw();
    },
    setBase(value: boolean) {
      solidBase = value;
      base.visible = value && surface.visible;
      updateStageVisibility();
      draw();
    },
    setGround(value: boolean) {
      showGround = value;
      updateStageVisibility();
      draw();
    },
    setGroundColor(value: string | undefined) {
      customGroundColor = value;
      stage.setColor(value ?? backgroundColor);
      updateStageVisibility();
      draw();
    },
    setMapGrid(value: boolean, spanMeters: number | undefined) {
      stage.setMapGrid(value, spanMeters);
      draw();
    },
    setNorthArrow(value: boolean) {
      stage.setNorthArrow(value);
      draw();
    },
    setSurfaceColor(value: string | undefined) {
      customSurfaceColor = value;
      surfaceMaterial.color.set(value ?? backgroundColor);
      updateWaterColor();
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

  return api;
}
