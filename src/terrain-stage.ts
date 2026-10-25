import * as THREE from 'three';

/** Presentation-only studio floor and geographic marker; never part of the printable model. */
export function createTerrainStage(): {
  group: THREE.Group;
  update(width: number, length: number, background: string, ink: string): void;
  setVisible(value: boolean): void;
  setColor(value: string): void;
  setNorthArrow(value: boolean): void;
} {
  const group = new THREE.Group();
  const groundMaterial = new THREE.MeshBasicMaterial({ color: '#202326', toneMapped: false });
  // Larger than the camera's far distance, so no floor edge can enter the view.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundMaterial);

  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  group.add(ground);

  // A soft contact shadow grounds the block without another full terrain render per light.
  const canvas = document.createElement('canvas');

  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('The terrain ground could not be created.');
  }

  context.shadowColor = 'rgba(0, 0, 0, 0.45)';
  context.shadowBlur = 18;
  context.fillStyle = 'rgba(0, 0, 0, 0.3)';
  context.fillRect(32, 32, 192, 192);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
    }),
  );

  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.005;
  group.add(shadow);

  const north = new THREE.Group();
  const arrowMaterial = new THREE.MeshBasicMaterial({ color: '#e0e8d7', side: THREE.DoubleSide });
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
  const letterMaterial = new THREE.LineBasicMaterial({ color: '#e0e8d7' });
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

  return {
    group,
    update(width, length, background, ink) {
      groundMaterial.color.set(background);
      shadow.scale.set((width * 256) / 192, (length * 256) / 192, 1);
      north.position.set(-width / 2 - 0.2, 0, length / 2 - 0.05);
      arrowMaterial.color.set(ink);
      letterMaterial.color.set(ink);
    },
    setColor(value) {
      groundMaterial.color.set(value);
    },
    setVisible(value) {
      group.visible = value;
    },
    setNorthArrow(value) {
      north.visible = value;
    },
  };
}
