import { createTerrainElevationMaterial } from './terrain-elevation-material';
import type { ElevationGradientSettings } from './terrain-elevation-gradient';
import {
  landFinishes,
  waterFinishes,
  type LandFinish,
  type WaterFinish,
} from './terrain-materials';
import { createNaturalTerrainMaterial, createTerrainDepths } from './terrain-natural-material';
import {
  createContourEngraving,
  defaultContourEngraving,
  type ContourEngravingSettings,
} from './terrain-contour-engraving';
import { createTerraceContours, type TerrainTerraceLevels } from './terrain-terraces';
import { sampleHeightField } from './terrain-surface';
import { createWaterVolume } from './terrain-water-volume';
import { createTerrainStage, defaultTerrainGroundColor } from './terrain-stage';
import type { FloorPlace } from './floor-geo';
import type { FloorStyle } from './terrain-floor-styles';
import { getTerrainWaterColor } from './terrain-water';
import {
  defaultTerrainLighting,
  getTerrainAtmosphere,
  type TerrainLightingSettings,
} from './terrain-lighting';
import { createTerrainLineBuffers } from './terrain-3d-lines';
import {
  baseTerrainFovDegrees,
  defaultTerrainCameraSettings,
  getCompensatedDistance,
  getDistanceForHalfHeight,
  getOrthographicHalfHeight,
  getVerticalFovDegrees,
  terrainViewPresets,
  type TerrainCameraSettings,
  type TerrainViewPreset,
} from './terrain-camera';
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
    terraceLevels?: TerrainTerraceLevels,
  ): void;
  setVisible(value: boolean): void;
  setHeight(value: number): void;
  setModelSettings(value: TerrainModelSettings): void;
  getStl(): ArrayBuffer;
  setLandFinish(value: LandFinish): void;
  setElevationGradient(value: ElevationGradientSettings): void;
  setWaterFinish(value: WaterFinish): void;
  setWaterOpacity(value: number): void;
  setPreviewWaterLevel(value: number | undefined): void;
  setSurface(value: boolean): void;
  setBase(value: boolean): void;
  setGround(value: boolean): void;
  setGroundColor(value: string | undefined): void;
  setMapGrid(
    value: boolean,
    place: FloorPlace | undefined,
    contourIntervalMeters: number | undefined,
    floorStyle: FloorStyle,
  ): void;
  setWaterStyle(value: WaterStyle): void;
  setWaterColor(value: string | undefined): void;
  setContours(value: boolean): void;
  setContourEngraving(value: ContourEngravingSettings): void;
  setSurfaceColor(value: string | undefined): void;
  setRotating(value: boolean): void;
  setRotationSpeed(value: number): void;
  applyViewPreset(preset: TerrainViewPreset): void;
  setLighting(settings: Readonly<TerrainLightingSettings>): void;
  setCamera(settings: Readonly<TerrainCameraSettings>): void;
  reset(): void;
}

export function createTerrain3d(
  onModel: (heightMm: number, layerHeightMm?: number) => void = () => undefined,
): Terrain3d {
  const renderer = new THREE.WebGLRenderer({ antialias: true });

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.domElement.className = 'terrain-3d';
  renderer.domElement.setAttribute(
    'aria-label',
    'Interactive 3D terrain. Drag to orbit; scroll to zoom.',
  );
  const viewport = document.querySelector('#studio-viewport') ?? document.body;

  viewport.append(renderer.domElement);
  const scene = new THREE.Scene();
  const perspectiveCamera = new THREE.PerspectiveCamera(
    getVerticalFovDegrees(defaultTerrainCameraSettings.focalLengthMm),
    1,
    0.01,
    200,
  );
  const orthographicCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 200);
  let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = perspectiveCamera;
  let viewportAspect = 1;
  let orthographicHalfHeight = 1;
  const controls = new OrbitControls<THREE.PerspectiveCamera | THREE.OrthographicCamera>(
    camera,
    renderer.domElement,
  );

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
  const baseMaterial = surfaceMaterial.clone();
  const engraving = createContourEngraving();
  let contourTreatment = defaultContourEngraving.treatment;
  let showContours = true;

  engraving.applyTo(surfaceMaterial);
  const naturalSurfaceMaterial = createNaturalTerrainMaterial(false);
  const naturalBaseMaterial = createNaturalTerrainMaterial(true);

  engraving.applyTo(naturalSurfaceMaterial);
  const elevationGradient = createTerrainElevationMaterial();

  for (const material of [
    surfaceMaterial,
    baseMaterial,
    naturalSurfaceMaterial,
    naturalBaseMaterial,
  ]) {
    elevationGradient.applyTo(material);
  }

  const updateLandColor = () => {
    surfaceMaterial.color.set(customSurfaceColor ?? backgroundColor);
    baseMaterial.color.copy(surfaceMaterial.color);
    naturalSurfaceMaterial.color.set(customSurfaceColor ?? '#ffffff');
    naturalBaseMaterial.color.set(customSurfaceColor ?? '#ffffff');
  };

  const surface = new THREE.Mesh(new THREE.BufferGeometry(), surfaceMaterial);
  const base = new THREE.Mesh(new THREE.BufferGeometry(), baseMaterial);

  const syncContourTreatment = () => {
    contourLayer.visible = showContours && (contourTreatment === 'drawn' || !surface.visible);
    engraving.setEnabled(showContours && contourTreatment === 'engraved' && surface.visible);
  };

  surface.castShadow = surface.receiveShadow = true;
  base.castShadow = base.receiveShadow = true;
  base.visible = true;
  let solidBase = true;
  let showGround = true;
  const stage = createTerrainStage();

  const backdropTint = new THREE.Color(1, 1, 1);

  const updateStageVisibility = () => {
    const enabled = showGround && base.visible;

    stage.setVisible(enabled);
    scene.background = new THREE.Color(
      enabled ? (customGroundColor ?? backgroundColor) : backgroundColor,
    ).multiply(backdropTint);
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

  let lighting: Readonly<TerrainLightingSettings> = defaultTerrainLighting;
  let exposureScale = 1;
  let landscapeRadius = 1;

  /** Positions the sun independently of the camera; time of day sets height, colour and studio tint. */
  const applyLighting = () => {
    const atmosphere = getTerrainAtmosphere(lighting.timeOfDay);
    const direction = THREE.MathUtils.degToRad(lighting.direction);
    const elevation = THREE.MathUtils.degToRad(atmosphere.sunElevation);
    const radius = 10;

    sunlight.position.set(
      radius * Math.cos(elevation) * Math.sin(direction),
      radius * Math.sin(elevation),
      -radius * Math.cos(elevation) * Math.cos(direction),
    );
    sunlight.color.set(atmosphere.sunColor);
    sunlight.intensity = lighting.flat
      ? 0
      : lighting.intensity * atmosphere.sunScale * exposureScale;
    stage.setCastShadows(!lighting.flat && lighting.intensity > 0);
    fillLight.color.set(atmosphere.skyColor);
    fillLight.groundColor.set(atmosphere.groundColor);
    fillLight.intensity = lighting.fill * atmosphere.fillScale * exposureScale;
    backdropTint.set(atmosphere.tint);
    stage.setTint(atmosphere.tint);
    updateStageVisibility();
  };

  /** Haze is relative to the model, so it reads the same at any lens or zoom. */
  const updateFog = () => {
    if (lighting.haze <= 0) {
      scene.fog = null;

      return;
    }

    const fog = scene.fog instanceof THREE.Fog ? scene.fog : new THREE.Fog(0xffffff);
    const distance = camera.position.distanceTo(controls.target);
    // The far edge of the model reaches 85% haze at full strength.
    const backEdgeHaze = lighting.haze * 0.85;

    scene.fog = fog;
    fog.color.copy(scene.background instanceof THREE.Color ? scene.background : backdropTint);
    fog.near = Math.max(0, distance - landscapeRadius);
    fog.far = fog.near + (2 * landscapeRadius) / backEdgeHaze;
  };

  applyLighting();
  scene.add(fillLight, sunlight);
  let modelSettings: TerrainModelSettings = { ...defaultTerrainModelSettings };
  let exaggeration = 0.3;
  let model: TerrainModel | undefined;
  let modelKey = '';
  let terracedContours: Contour[] | undefined;
  let waterSurfacePositions: Float32Array = new Float32Array();
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
      updateFog();
      renderer.render(scene, camera);
    }
  };

  controls.addEventListener('change', draw);

  const resize = () => {
    const width = Math.max(1, viewport.clientWidth);
    const height = Math.max(1, viewport.clientHeight);

    renderer.setSize(width, height);
    viewportAspect = width / height;
    perspectiveCamera.aspect = viewportAspect;
    perspectiveCamera.updateProjectionMatrix();
    updateOrthographicFrustum();
    draw();
  };

  const updateOrthographicFrustum = () => {
    orthographicCamera.top = orthographicHalfHeight;
    orthographicCamera.bottom = -orthographicHalfHeight;
    orthographicCamera.left = -orthographicHalfHeight * viewportAspect;
    orthographicCamera.right = orthographicHalfHeight * viewportAspect;
    orthographicCamera.updateProjectionMatrix();
  };

  /** Perspective-equivalent distance, so framing survives lens and projection changes. */
  const getViewDistance = () =>
    camera === orthographicCamera
      ? getDistanceForHalfHeight(orthographicHalfHeight, perspectiveCamera.fov) /
        orthographicCamera.zoom
      : perspectiveCamera.position.distanceTo(controls.target);

  /** Places the active camera along `direction` from the orbit target at a framing distance. */
  const placeCamera = (direction: THREE.Vector3, distance: number) => {
    const scale = getCompensatedDistance(1, baseTerrainFovDegrees, perspectiveCamera.fov);
    const minDistance = 0.5 * scale;
    const maxDistance = 12 * scale;
    const offset = direction.clone().normalize();

    controls.minDistance = minDistance;
    controls.maxDistance = maxDistance;

    if (camera === orthographicCamera) {
      // Orthographic depth does not affect framing; a fixed standoff keeps the model unclipped.
      orthographicHalfHeight = getOrthographicHalfHeight(distance, perspectiveCamera.fov);
      orthographicCamera.zoom = 1;
      controls.minZoom = distance / maxDistance;
      controls.maxZoom = distance / minDistance;
      orthographicCamera.position.copy(controls.target).addScaledVector(offset, maxDistance);
      updateOrthographicFrustum();
    } else {
      perspectiveCamera.position.copy(controls.target).addScaledVector(offset, distance);
    }

    controls.update();
  };

  const setCameraSettings = (settings: Readonly<TerrainCameraSettings>) => {
    const direction = camera.position.clone().sub(controls.target);
    const distance = getCompensatedDistance(
      getViewDistance(),
      perspectiveCamera.fov,
      getVerticalFovDegrees(settings.focalLengthMm),
    );

    perspectiveCamera.fov = getVerticalFovDegrees(settings.focalLengthMm);
    perspectiveCamera.updateProjectionMatrix();
    exposureScale = 2 ** settings.exposureEv;
    applyLighting();
    camera = settings.projection === 'orthographic' ? orthographicCamera : perspectiveCamera;
    controls.object = camera;
    placeCamera(direction, distance);
    draw();
  };

  let viewAnimationFrame = 0;

  /** Eases the camera to a new direction around the target, keeping the framing distance. */
  const animateCameraDirection = (direction: THREE.Vector3) => {
    cancelAnimationFrame(viewAnimationFrame);
    const distance = getViewDistance();
    const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    const to = new THREE.Spherical().setFromVector3(direction);
    const thetaChange =
      THREE.MathUtils.euclideanModulo(to.theta - from.theta + Math.PI, Math.PI * 2) - Math.PI;
    const durationMs = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400;
    const startedAt = performance.now();

    const step = () => {
      const progress =
        durationMs === 0 ? 1 : Math.min(1, (performance.now() - startedAt) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      const current = new THREE.Spherical(
        1,
        THREE.MathUtils.lerp(from.phi, to.phi, eased),
        from.theta + thetaChange * eased,
      );

      placeCamera(new THREE.Vector3().setFromSpherical(current), distance);
      draw();

      if (progress < 1) {
        viewAnimationFrame = requestAnimationFrame(step);
      }
    };

    step();
  };

  const raycaster = new THREE.Raycaster();

  /** Double-click re-centres the orbit on a terrain point without changing the viewing angle. */
  renderer.domElement.addEventListener('dblclick', (event) => {
    const bounds = renderer.domElement.getBoundingClientRect();

    raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      ),
      camera,
    );
    const point = raycaster
      .intersectObjects([surface, base], false)
      .find((hit) => hit.object.visible)?.point;

    if (!point) {
      return;
    }

    const offset = camera.position.clone().sub(controls.target);

    controls.target.copy(point);
    camera.position.copy(point).add(offset);
    controls.update();
    draw();
  });

  const reset = () => {
    const home = new THREE.Vector3(0, 2.1, 2.5);

    controls.target.set(0, 0, 0);
    placeCamera(
      home,
      getCompensatedDistance(home.length(), baseTerrainFovDegrees, perspectiveCamera.fov),
    );
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
  new ResizeObserver(resize).observe(viewport);
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
      terraceLevels?: TerrainTerraceLevels,
    ) {
      lastUpdate = [contours, width, height, settings, field, seaLevel, terraceLevels];
      const key = JSON.stringify([width, height, modelSettings, exaggeration, terraceLevels]);

      if (field !== previousField || key !== modelKey) {
        model = createTerrainModel(
          field,
          width,
          height,
          modelSettings,
          exaggeration,
          terraceLevels,
        );
        terracedContours =
          model.contourEdges && terraceLevels
            ? createTerraceContours(
                model.contourEdges,
                contours,
                width,
                height,
                (modelSettings.cropShape === 'circle'
                  ? modelSettings.widthMm
                  : Math.max(modelSettings.widthMm, modelSettings.lengthMm)) / 2,
                terrain3dElevationScale,
                terraceLevels,
              )
            : undefined;
        const gradientOffsetMm = model.elevationOffsetMm;
        const gradientScaleMm = model.elevationScaleMm;
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
          if (mesh === surface) {
            waterSurfacePositions = geometry.getAttribute('position').array as Float32Array;
          }

          const rendered =
            mesh === base || modelSettings.terrainShape === 'terraced'
              ? geometry.toNonIndexed()
              : geometry;

          if (mesh === surface) {
            const positions = rendered.getAttribute('position').array;
            const sourceScale = 2 / Math.max(width, height);
            const elevations = Float32Array.from({ length: positions.length / 3 }, (_, i) =>
              sampleHeightField(
                field,
                positions[i * 3] / sourceScale + width / 2,
                positions[i * 3 + 2] / sourceScale + height / 2,
              ),
            );

            rendered.setAttribute('contourElevation', new THREE.BufferAttribute(elevations, 1));
          }

          const gradientPositions = rendered.getAttribute('position').array;
          const sourceScale = 2 / Math.max(width, height);
          const gradientHeights = Float32Array.from(
            { length: gradientPositions.length / 3 },
            (_, i) =>
              exaggeration > 0
                ? (gradientPositions[i * 3 + 1] / previewScale - gradientOffsetMm) /
                  gradientScaleMm /
                  terrain3dElevationScale
                : sampleHeightField(
                    field,
                    gradientPositions[i * 3] / sourceScale + width / 2,
                    gradientPositions[i * 3 + 2] / sourceScale + height / 2,
                  ),
          );

          rendered.setAttribute('gradientElevation', new THREE.BufferAttribute(gradientHeights, 1));

          rendered.computeVertexNormals();
          rendered.setAttribute(
            'terrainDepth',
            new THREE.BufferAttribute(
              createTerrainDepths(
                mesh === surface
                  ? rendered.getAttribute('position').array
                  : surface.geometry.getAttribute('position').array,
                rendered.getAttribute('position').array,
                mesh === base && model.contourEdges ? (height) => height * 2 : undefined,
              ),
              1,
            ),
          );

          if (rendered !== geometry) {
            geometry.dispose();
          }

          mesh.geometry.dispose();
          mesh.geometry = rendered;
        }

        let gradientMinimum = Infinity;
        let gradientMaximum = -Infinity;

        for (const elevation of field.values) {
          gradientMinimum = Math.min(gradientMinimum, elevation);
          gradientMaximum = Math.max(gradientMaximum, elevation);
        }

        elevationGradient.setRange(gradientMinimum, gradientMaximum);
        previousField = field;
        modelKey = key;
        onModel(model.overallHeightMm, model.layerHeightMm);
      }

      const previewScale =
        2 /
        (modelSettings.cropShape === 'circle'
          ? modelSettings.widthMm
          : Math.max(modelSettings.widthMm, modelSettings.lengthMm));

      if (!model) {
        throw new Error('Terrain model is unavailable.');
      }

      engraving.update(contours, settings, previewScale);
      const elevationOffset = model.elevationOffsetMm * previewScale;

      const scale = 2 / Math.max(width, height);
      const lineBuffers = createTerrainLineBuffers(
        terracedContours ?? contours,
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
              waterSurfacePositions,
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
      updateLandColor();
      updateWaterColor();
      updateStageVisibility();
      landscapeRadius =
        (Math.hypot(modelSettings.widthMm, modelSettings.lengthMm) * previewScale) / 2;
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
      showContours = value;
      syncContourTreatment();
      draw();
    },
    setContourEngraving(value: ContourEngravingSettings) {
      contourTreatment = value.treatment;
      engraving.setSize(value.widthMm, value.depthMm);
      syncContourTreatment();
      draw();
    },
    setElevationGradient(value: ElevationGradientSettings) {
      elevationGradient.setSettings(value);
      draw();
    },
    setLandFinish(value: LandFinish) {
      surface.material = value === 'natural' ? naturalSurfaceMaterial : surfaceMaterial;
      base.material = value === 'natural' ? naturalBaseMaterial : baseMaterial;
      surfaceMaterial.roughness = landFinishes[value].roughness;
      surfaceMaterial.clearcoat = landFinishes[value].clearcoat;
      baseMaterial.roughness = surfaceMaterial.roughness;
      baseMaterial.clearcoat = surfaceMaterial.clearcoat;
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
      syncContourTreatment();
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
    setMapGrid(
      value: boolean,
      place: FloorPlace | undefined,
      contourIntervalMeters: number | undefined,
      floorStyle: FloorStyle,
    ) {
      stage.setMapGrid(value, place, contourIntervalMeters, floorStyle);
      draw();
    },
    setSurfaceColor(value: string | undefined) {
      customSurfaceColor = value;
      updateLandColor();
      updateWaterColor();
      draw();
    },
    setLighting(value: Readonly<TerrainLightingSettings>) {
      lighting = value;
      applyLighting();
      draw();
    },
    setCamera: setCameraSettings,
    setRotationSpeed(value: number) {
      controls.autoRotateSpeed = value;
    },
    applyViewPreset(preset: TerrainViewPreset) {
      const { polarDegrees, azimuthDegrees } = terrainViewPresets[preset];

      animateCameraDirection(
        new THREE.Vector3().setFromSphericalCoords(
          1,
          THREE.MathUtils.degToRad(polarDegrees),
          THREE.MathUtils.degToRad(azimuthDegrees),
        ),
      );
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
