import { createTerrainMapGrid, getMapGridInk } from './terrain-map-grid';
import * as THREE from 'three';

export const defaultTerrainGroundColor = '#b4b4b4';

/** Presentation-only studio floor and geographic marker; never part of the printable model. */
export function createTerrainStage(): {
  group: THREE.Group;
  update(width: number, length: number, background: string, circular: boolean): void;
  setVisible(value: boolean): void;
  setColor(value: string): void;
  setCastShadows(value: boolean): void;
  setNorthArrow(value: boolean): void;
  setMapGrid(value: boolean, spanMeters: number | undefined, contourIntervalMeters?: number): void;
} {
  const group = new THREE.Group();
  const shadowEnabled = { value: 1 };
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
    shader.fragmentShader = shader.fragmentShader
      .replace('uniform float opacity;', 'uniform float opacity; uniform float floorShadowEnabled;')
      .replace(
        'gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );',
        'gl_FragColor = vec4( color, 1.0 );',
      )
      .replace(
        '#include <colorspace_fragment>',
        `#include <colorspace_fragment>
        gl_FragColor.rgb *= 1.0 - opacity * floorShadowEnabled * (1.0 - getShadowMask());`,
      );
  };

  groundMaterial.customProgramCacheKey = () => 'topogra-shadowed-studio-v1';

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

  const north = new THREE.Group();
  const arrowMaterial = new THREE.MeshBasicMaterial({
    color: getMapGridInk(defaultTerrainGroundColor).color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    toneMapped: false,
  });
  const arrowGeometry = new THREE.BufferGeometry();

  // In the terrain frame, decreasing Z is geographic north. The arrow is painted on the floor.
  arrowGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        0, 0, -0.3, -0.065, 0, -0.13, 0.065, 0, -0.13, -0.012, 0, -0.14, -0.012, 0, 0, 0.012, 0, 0,
        -0.012, 0, -0.14, 0.012, 0, 0, 0.012, 0, -0.14,
      ],
      3,
    ),
  );
  north.add(new THREE.Mesh(arrowGeometry, arrowMaterial));
  const letterMaterial = new THREE.LineBasicMaterial({
    color: getMapGridInk(defaultTerrainGroundColor).color,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    toneMapped: false,
  });
  const letterGeometry = new THREE.BufferGeometry();

  letterGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        -0.035, 0, -0.35, -0.035, 0, -0.44, -0.035, 0, -0.44, 0.035, 0, -0.35, 0.035, 0, -0.35,
        0.035, 0, -0.44,
      ],
      3,
    ),
  );
  north.add(new THREE.LineSegments(letterGeometry, letterMaterial));
  north.position.y = 0;
  north.visible = false;
  group.add(north);

  const mapGrid = createTerrainMapGrid();

  group.add(mapGrid.mesh);
  let gridEnabled = false;
  let groundSpan: number | undefined;
  let contourInterval: number | undefined;
  let stageSize = { width: 2, length: 2, circular: false, background: defaultTerrainGroundColor };

  const updateGrid = () => {
    const ink = getMapGridInk(stageSize.background).color;

    arrowMaterial.color.set(ink);
    letterMaterial.color.set(ink);
    mapGrid.mesh.visible = gridEnabled && groundSpan !== undefined;
    mapGrid.update(
      stageSize.width,
      stageSize.length,
      stageSize.circular,
      stageSize.background,
      groundSpan,
      contourInterval,
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
      north.position.set(-width / 2 - 0.2, 0, length / 2 - 0.05);
    },
    setCastShadows(value) {
      shadowEnabled.value = value ? 1 : 0;
    },
    setColor(value) {
      groundMaterial.color.set(value);
      stageSize.background = value;
      updateGrid();
    },
    setVisible(value) {
      group.visible = value;
    },
    setMapGrid(value, spanMeters, contourIntervalMeters) {
      contourInterval = contourIntervalMeters;
      gridEnabled = value;
      groundSpan = spanMeters;
      updateGrid();
    },
    setNorthArrow(value) {
      north.visible = value;
    },
  };
}
