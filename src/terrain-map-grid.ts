import * as THREE from 'three';

/** Choose a restrained 1/2/5 interval, targeting roughly eight cells across the model. */
export function getMapGridSpacing(spanMeters: number): number {
  const target = spanMeters / 8;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const fraction = target / magnitude;

  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * magnitude;
}

export function formatMapDistance(meters: number): string {
  return meters >= 1000
    ? `${Number((meters / 1000).toPrecision(3))} km`
    : `${Number(meters.toPrecision(3))} m`;
}

/** Floor-only cartographic dressing, with a fully erased model footprint. */
export function createTerrainMapGrid(): {
  mesh: THREE.Mesh;
  update(
    width: number,
    length: number,
    circular: boolean,
    background: string,
    spanMeters: number | undefined,
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
    update(width, length, circular, background, spanMeters) {
      const key = JSON.stringify([width, length, circular, background, spanMeters]);

      if (key === previousKey) {
        return;
      }

      previousKey = key;
      context.clearRect(0, 0, 2048, 2048);

      if (spanMeters === undefined || !Number.isFinite(spanMeters) || spanMeters <= 0) {
        texture.needsUpdate = true;

        return;
      }

      const extent = Math.max(width, length);
      const planeSize = extent * 2.8;
      const pixelsPerUnit = 2048 / planeSize;
      const spacingMeters = getMapGridSpacing(spanMeters);
      const spacing = (spacingMeters / spanMeters) * extent * pixelsPerUnit;
      const lightFloor = new THREE.Color(background).getHSL({ h: 0, s: 0, l: 0 }).l > 0.35;
      const ink = lightFloor ? '25, 39, 44' : '220, 231, 228';

      mesh.scale.set(planeSize, planeSize, 1);
      const halfWidth = (width * pixelsPerUnit) / 2;
      const halfLength = (length * pixelsPerUnit) / 2;
      const gap = extent * pixelsPerUnit * 0.035;

      context.save();
      context.translate(1024, 1024);

      for (let index = -Math.ceil(1024 / spacing); index <= Math.ceil(1024 / spacing); index++) {
        const offset = index * spacing;

        context.strokeStyle = `rgba(${ink}, ${index % 5 === 0 ? 0.22 : 0.11})`;
        context.lineWidth = index % 5 === 0 ? 1.5 : 1;
        context.beginPath();
        context.moveTo(offset, -1024);
        context.lineTo(offset, 1024);
        context.moveTo(-1024, offset);
        context.lineTo(1024, offset);
        context.stroke();
      }

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
      // One small scale bar and its end ticks keep the labels sparse.
      const barY = 0;
      const barX = halfWidth + gap + spacing / 2 + 24;

      context.strokeStyle = `rgba(${ink}, 0.38)`;
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(barX - spacing / 2, barY);
      context.lineTo(barX + spacing / 2, barY);

      for (const x of [-spacing / 2, spacing / 2]) {
        context.moveTo(barX + x, barY - 5);
        context.lineTo(barX + x, barY + 5);
      }

      context.stroke();
      context.font = '20px monospace';
      context.fillStyle = `rgba(${ink}, 0.55)`;
      context.textAlign = 'center';
      context.fillText(formatMapDistance(spacingMeters), barX, barY + 28);
      context.restore();
      texture.needsUpdate = true;
    },
  };
}
