import * as THREE from 'three';
import type { FloorPlace } from './floor-geo';
import {
  paintFloorStyleLabels,
  paintFloorStyleLines,
  type FloorStyle,
} from './terrain-floor-styles';

/** Shared floor ink keeps the grid, labels, and north marker in the same palette. */
export function getMapGridInk(background: string): { color: string; rgb: string } {
  const lightFloor = new THREE.Color(background).getHSL({ h: 0, s: 0, l: 0 }).l > 0.35;

  return lightFloor
    ? { color: '#19272c', rgb: '25, 39, 44' }
    : { color: '#dce7e4', rgb: '220, 231, 228' };
}

/** Choose a restrained 1/2/5 interval, targeting roughly eight cells across the model. */
export function getMapGridSpacing(spanMeters: number): number {
  const target = spanMeters / 8;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const fraction = target / magnitude;

  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * magnitude;
}

/** Floor-only cartographic dressing, with a fully erased model footprint. */
export function createTerrainMapGrid(): {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  update(
    width: number,
    length: number,
    circular: boolean,
    background: string,
    place: FloorPlace | undefined,
    contourIntervalMeters: number | undefined,
    floorStyle: FloorStyle,
  ): void;
} {
  const canvas = document.createElement('canvas');

  canvas.width = canvas.height = 2048;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('The map grid could not be created.');
  }

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);

  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.001;
  mesh.visible = false;
  let previousKey = '';

  return {
    mesh,
    update(width, length, circular, background, place, contourIntervalMeters, floorStyle) {
      const key = JSON.stringify([
        width,
        length,
        circular,
        background,
        place,
        contourIntervalMeters,
        floorStyle,
      ]);

      if (key === previousKey) {
        return;
      }

      previousKey = key;
      context.clearRect(0, 0, 2048, 2048);

      if (place === undefined) {
        texture.needsUpdate = true;

        return;
      }

      const spanMeters = Math.max(place.widthKm, place.lengthKm) * 1000;

      const extent = Math.max(width, length);
      const planeSize = extent * 2.8;
      const pixelsPerUnit = 2048 / planeSize;
      const spacingMeters = getMapGridSpacing(spanMeters);
      const spacing = (spacingMeters / spanMeters) * extent * pixelsPerUnit;
      const ink = getMapGridInk(background).rgb;

      mesh.scale.set(planeSize, planeSize, 1);
      const halfWidth = (width * pixelsPerUnit) / 2;
      const halfLength = (length * pixelsPerUnit) / 2;
      const gap = extent * pixelsPerUnit * 0.035;
      const frame = {
        context,
        extentPx: extent * pixelsPerUnit,
        halfWidthPx: halfWidth,
        halfLengthPx: halfLength,
        ink,
      };

      context.save();
      context.translate(1024, 1024);

      // Survey sheets use a finer, uniform grid whose cells start at the model's north-west corner.
      if (floorStyle === 'survey') {
        paintGridLines(context, ink, spacing / 2, { x: -halfWidth, y: -halfLength });
      }

      paintFloorStyleLines(floorStyle, frame, place);

      // Erase the whole footprint, including water and a small breathing margin.
      context.globalCompositeOperation = 'destination-out';
      context.fillStyle = '#000';

      if (circular) {
        context.beginPath();
        context.arc(0, 0, halfWidth + gap, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillRect(
          -halfWidth - gap,
          -halfLength - gap,
          (halfWidth + gap) * 2,
          (halfLength + gap) * 2,
        );
      }

      context.globalCompositeOperation = 'destination-in';
      const fade = context.createRadialGradient(0, 0, extent * pixelsPerUnit * 0.55, 0, 0, 1024);

      fade.addColorStop(0, '#000');
      fade.addColorStop(1, 'transparent');
      context.fillStyle = fade;
      context.fillRect(-1024, -1024, 2048, 2048);
      context.globalCompositeOperation = 'source-over';

      paintFloorStyleLabels(floorStyle, frame, place, contourIntervalMeters);
      context.restore();
      texture.needsUpdate = true;
    },
  };
}

/** Square grid lines through `origin`, covering the whole floor canvas. */
function paintGridLines(
  context: CanvasRenderingContext2D,
  ink: string,
  spacing: number,
  origin: { x: number; y: number },
): void {
  // Only indices whose lines land on the ±1024 canvas; an offset origin shifts the range, not its width.
  const first = Math.floor((-1024 - Math.max(origin.x, origin.y)) / spacing);
  const last = Math.ceil((1024 - Math.min(origin.x, origin.y)) / spacing);

  context.strokeStyle = `rgba(${ink}, 0.16)`;
  context.lineWidth = 1;

  for (let index = first; index <= last; index++) {
    context.beginPath();
    context.moveTo(origin.x + index * spacing, -1024);
    context.lineTo(origin.x + index * spacing, 1024);
    context.moveTo(-1024, origin.y + index * spacing);
    context.lineTo(1024, origin.y + index * spacing);
    context.stroke();
  }
}
