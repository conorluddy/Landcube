import { createTerrainMapGrid } from './terrain-map-grid';
import type { FloorPlace } from './floor-geo';
import type { FloorStyle } from './terrain-floor-styles';
import * as THREE from 'three';

export const defaultTerrainGroundColor = '#b4b4b4';

/** Presentation-only studio floor and map dressing; never part of the printable model. */
export function createTerrainStage(): {
  group: THREE.Group;
  update(width: number, length: number, background: string, circular: boolean): void;
  setVisible(value: boolean): void;
  setColor(value: string): void;
  /** Multiplies floor and map colours, darkening the studio for night scenes. */
  setTint(value: string): void;
  setCastShadows(value: boolean): void;
  setMapGrid(
    value: boolean,
    place: FloorPlace | undefined,
    contourIntervalMeters: number | undefined,
    floorStyle: FloorStyle,
  ): void;
} {
  const group = new THREE.Group();
  const shadowEnabled = { value: 1 };
  const floorTint = { value: new THREE.Color(1, 1, 1) };
  const groundMaterial = new THREE.ShadowMaterial({
    color: defaultTerrainGroundColor,
    side: THREE.BackSide,
    toneMapped: false,
    transparent: false,
    opacity: 0.65,
  });

  // Color and cast shadow share one depth surface, avoiding a nearly coplanar overlay.
  groundMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.floorShadowEnabled = shadowEnabled;
    shader.uniforms.floorTint = floorTint;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'uniform float opacity;',
        'uniform float opacity; uniform float floorShadowEnabled; uniform vec3 floorTint;',
      )
      .replace(
        'gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );',
        'gl_FragColor = vec4( color * floorTint, 1.0 );',
      )
      .replace(
        '#include <colorspace_fragment>',
        `#include <colorspace_fragment>
        gl_FragColor.rgb *= 1.0 - opacity * floorShadowEnabled * (1.0 - getShadowMask());`,
      );
  };

  groundMaterial.customProgramCacheKey = () => 'topogra-shadowed-studio-v2';

  // An enclosing studio box keeps the floor, walls, and ceiling the same color.
  const ground = new THREE.Mesh(new THREE.BoxGeometry(400, 200, 400), groundMaterial);

  ground.position.y = 100 - 0.01;
  ground.receiveShadow = true;
  group.add(ground);

  // A restrained contact shadow supplements the directional shadow at the base.
  const canvas = document.createElement('canvas');

  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('The terrain ground could not be created.');
  }

  const paintShadow = (circular: boolean) => {
    context.clearRect(0, 0, 256, 256);
    context.shadowColor = 'rgba(0, 0, 0, 0.18)';
    context.shadowBlur = 18;
    context.fillStyle = 'rgba(0, 0, 0, 0.12)';

    if (circular) {
      context.beginPath();
      context.arc(128, 128, 96, 0, Math.PI * 2);
      context.fill();
    } else {
      context.fillRect(32, 32, 192, 192);
    }
  };

  paintShadow(false);
  let previousCircular = false;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
    }),
  );

  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.003;
  group.add(shadow);

  const mapGrid = createTerrainMapGrid();
  // The model is built in its crop's frame; turning the floor back keeps overlays pointing north.
  const northFloor = new THREE.Group();

  northFloor.add(mapGrid.mesh);
  group.add(northFloor);
  let gridEnabled = false;
  let floorPlace: FloorPlace | undefined;
  let contourInterval: number | undefined;
  let style: FloorStyle = 'survey';
  let stageSize = { width: 2, length: 2, circular: false, background: defaultTerrainGroundColor };

  const updateGrid = () => {
    const rotationRadians = floorPlace?.rotationRadians ?? 0;
    const cos = Math.abs(Math.cos(rotationRadians));
    const sin = Math.abs(Math.sin(rotationRadians));
    // A round model looks the same at any angle, so its floor keeps the disc footprint.
    const isRotatedBox = !stageSize.circular && rotationRadians !== 0;

    northFloor.rotation.y = rotationRadians;
    mapGrid.mesh.visible = gridEnabled && floorPlace !== undefined;
    mapGrid.update(
      isRotatedBox ? stageSize.width * cos + stageSize.length * sin : stageSize.width,
      isRotatedBox ? stageSize.width * sin + stageSize.length * cos : stageSize.length,
      stageSize.circular,
      stageSize.background,
      floorPlace,
      contourInterval,
      style,
    );
  };

  return {
    group,
    update(width, length, background, circular) {
      stageSize = { width, length, background, circular };
      updateGrid();

      if (circular !== previousCircular) {
        paintShadow(circular);
        const material = shadow.material;

        if (material.map) {
          material.map.needsUpdate = true;
        }

        previousCircular = circular;
      }

      groundMaterial.color.set(background);
      shadow.scale.set((width * 256) / 192, (length * 256) / 192, 1);
    },
    setCastShadows(value) {
      shadowEnabled.value = value ? 1 : 0;
    },
    setColor(value) {
      groundMaterial.color.set(value);
      stageSize.background = value;
      updateGrid();
    },
    setTint(value) {
      floorTint.value.set(value);
      mapGrid.mesh.material.color.set(value);
    },
    setVisible(value) {
      group.visible = value;
    },
    setMapGrid(value, place, contourIntervalMeters, floorStyle) {
      contourInterval = contourIntervalMeters;
      gridEnabled = value;
      floorPlace = place;
      style = floorStyle;
      updateGrid();
    },
  };
}
