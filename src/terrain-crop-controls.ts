import { extractContours } from './contour-extraction';
import {
  defaultTerrainCrop,
  getTerrainCropBounds,
  type TerrainCropSettings,
  type TerrainCropShape,
} from './terrain-crop';
import { getRequiredElement } from './dom-elements';
import { sampleHeightField } from './terrain-surface';
import type { TerrainModelSettings } from './terrain-model';
import type { HeightField } from './types/terrain';
import type { DesignSettings } from './types/design';

/** Top-down terrain selection; moving the crop never moves or regenerates its source. */
export function mountTerrainCropControls(
  container: HTMLElement,
  getModel: () => TerrainModelSettings,
  changed: (shape: TerrainCropShape) => void,
  getSelection: () => TerrainCropSettings = () => defaultTerrainCrop,
): {
  getCrop(): TerrainCropSettings;
  dispose(): void;
  update(
    field: HeightField,
    width: number,
    height: number,
    settings: DesignSettings,
    contourLevels?: readonly number[],
  ): void;
} {
  container.innerHTML = `<fieldset><legend>Crop</legend>
    <div class="select-row"><label for="terrain-crop-shape">Crop shape</label><select id="terrain-crop-shape" data-crop-shape><option value="rectangle">Rectangle</option><option value="circle">Circle</option></select></div>
    <svg class="terrain-crop-preview" role="img" aria-label="Terrain crop preview. Drag inside to move; drag a handle to resize. Arrow keys move; plus and minus resize." tabindex="0" data-crop-preview>
      <image data-crop-image></image>
      <path data-crop-mask fill="#000" fill-opacity="0.65" fill-rule="evenodd" pointer-events="none"></path>
      <path data-crop-outline fill="transparent" stroke="currentColor" vector-effect="non-scaling-stroke" stroke-width="2"></path>
      <g data-crop-handles></g>
      <text x="12" y="20" class="crop-north" pointer-events="none">N ↑</text>
    </svg>
    <label class="range-control" for="terrain-crop-size"><span>Crop size</span><output for="terrain-crop-size" data-crop-size-value>100%</output><input id="terrain-crop-size" type="range" data-crop-size min="10" max="100" step="1" value="100"></label>
    <button type="button" class="text-button" data-crop-reset>Reset crop</button>
    <p class="export-hint">Drag the crop to move it. Drag a handle or use Crop size to resize. Preview and STL use the selected area. Circle size in millimeters is set by Diameter below.</p>
  </fieldset>`;
  const svg = getRequiredElement(container, '[data-crop-preview]', SVGSVGElement);
  const select = getRequiredElement(container, '[data-crop-shape]', HTMLSelectElement);
  const slider = getRequiredElement(container, '[data-crop-size]', HTMLInputElement);
  const handlesGroup = getRequiredElement(container, '[data-crop-handles]', SVGElement);

  handlesGroup.innerHTML =
    '<circle data-crop-handle fill="currentColor" stroke="#202326" stroke-width="1" vector-effect="non-scaling-stroke"/>'.repeat(
      4,
    );
  const handleElements = [...handlesGroup.querySelectorAll('circle')];
  let crop: TerrainCropSettings = { ...getSelection() };
  let shape: TerrainCropShape = 'rectangle';
  let width = 1;
  let height = 1;
  let previousField: HeightField | undefined;
  let imageKey = '';
  let pendingFrame: number | undefined;
  let drag: { x: number; y: number; crop: TerrainCropSettings; resize: boolean } | undefined;

  const bounds = () => {
    const model = getModel();

    return getTerrainCropBounds(
      width,
      height,
      shape === 'circle' ? 1 : model.widthMm / model.lengthMm,
      crop,
    );
  };

  const paintSelection = () => {
    const box = bounds();

    crop = box.crop;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const radius = box.width / 2;
    const path =
      shape === 'circle'
        ? `M ${cx - radius} ${cy} a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 ${-radius * 2} 0 Z`
        : `M ${box.x} ${box.y} h ${box.width} v ${box.height} h ${-box.width} Z`;

    getRequiredElement(container, '[data-crop-outline]', SVGElement).setAttribute('d', path);
    getRequiredElement(container, '[data-crop-mask]', SVGElement).setAttribute(
      'd',
      `M 0 0 H ${width} V ${height} H 0 Z ${path}`,
    );
    const handles =
      shape === 'circle'
        ? [
            [cx - radius, cy],
            [cx + radius, cy],
            [cx, cy - radius],
            [cx, cy + radius],
          ]
        : [
            [box.x, box.y],
            [box.x + box.width, box.y],
            [box.x, box.y + box.height],
            [box.x + box.width, box.y + box.height],
          ];
    const matrix = svg.getScreenCTM();
    const pixelScale = matrix ? Math.hypot(matrix.a, matrix.b) : 320 / width;
    const handleRadius = 6 / Math.max(pixelScale, 0.0001);
    const north = getRequiredElement(container, '.crop-north', SVGElement);

    north.setAttribute('x', String(12 / Math.max(pixelScale, 0.0001)));
    north.setAttribute('y', String(20 / Math.max(pixelScale, 0.0001)));
    north.setAttribute('font-size', String(12 / Math.max(pixelScale, 0.0001)));

    handles.forEach(([x, y], index) => {
      handleElements[index].setAttribute('cx', String(x));
      handleElements[index].setAttribute('cy', String(y));
      handleElements[index].setAttribute('r', String(handleRadius));
    });
    slider.value = String(Math.round(crop.size * 100));
    getRequiredElement(container, '[data-crop-size-value]', HTMLOutputElement).value =
      `${Math.round(crop.size * 100)}%`;
    svg.setAttribute('data-crop-center', `${crop.centerX},${crop.centerY}`);
    svg.setAttribute('data-crop-shape', shape);
  };

  const scheduleChange = () => {
    paintSelection();

    pendingFrame ??= requestAnimationFrame(() => {
      pendingFrame = undefined;
      changed(shape);
    });
  };

  select.addEventListener('change', () => {
    shape = select.value as TerrainCropShape;
    scheduleChange();
  });
  slider.addEventListener('input', () => {
    crop = { ...crop, size: slider.valueAsNumber / 100 };
    scheduleChange();
  });
  getRequiredElement(container, '[data-crop-reset]', HTMLButtonElement).addEventListener(
    'click',
    () => {
      crop = { ...defaultTerrainCrop };
      scheduleChange();
    },
  );

  const point = (event: PointerEvent) => {
    const matrix = svg.getScreenCTM();

    if (!matrix) {
      return { x: 0, y: 0 };
    }

    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  };

  svg.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }

    const position = point(event);
    const box = bounds();
    const resize = event.target instanceof Element && event.target.hasAttribute('data-crop-handle');
    const inside =
      shape === 'circle'
        ? Math.hypot(position.x - box.x - box.width / 2, position.y - box.y - box.height / 2) <=
          box.width / 2
        : position.x >= box.x &&
          position.x <= box.x + box.width &&
          position.y >= box.y &&
          position.y <= box.y + box.height;

    if (!resize && !inside) {
      return;
    }

    event.preventDefault();
    svg.focus();
    svg.setPointerCapture(event.pointerId);
    drag = { x: position.x, y: position.y, crop: { ...crop }, resize };
  });
  svg.addEventListener('pointermove', (event) => {
    if (!drag) {
      return;
    }

    const position = point(event);

    if (drag.resize) {
      const box = getTerrainCropBounds(
        width,
        height,
        shape === 'circle' ? 1 : getModel().widthMm / getModel().lengthMm,
        { ...drag.crop, size: 1 },
      );
      const cx = drag.crop.centerX * width;
      const cy = drag.crop.centerY * height;
      const requested =
        shape === 'circle'
          ? Math.hypot(position.x - cx, position.y - cy) / (box.width / 2)
          : Math.max(
              Math.abs(position.x - cx) / (box.width / 2),
              Math.abs(position.y - cy) / (box.height / 2),
            );
      const maximum = Math.min(cx, width - cx) / (box.width / 2);
      const verticalMaximum = Math.min(cy, height - cy) / (box.height / 2);

      crop = {
        ...drag.crop,
        size: Math.max(0.1, Math.min(1, requested, maximum, verticalMaximum)),
      };
    } else {
      crop = {
        ...drag.crop,
        centerX: drag.crop.centerX + (position.x - drag.x) / width,
        centerY: drag.crop.centerY + (position.y - drag.y) / height,
      };
    }

    scheduleChange();
  });

  const endDrag = () => {
    drag = undefined;
  };

  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('lostpointercapture', endDrag);
  svg.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 0.05 : 0.01;

    if (event.key === 'ArrowLeft') {
      crop.centerX -= step;
    } else if (event.key === 'ArrowRight') {
      crop.centerX += step;
    } else if (event.key === 'ArrowUp') {
      crop.centerY -= step;
    } else if (event.key === 'ArrowDown') {
      crop.centerY += step;
    } else if (event.key === '+' || event.key === '=') {
      crop.size += 0.05;
    } else if (event.key === '-') {
      crop.size -= 0.05;
    } else if (event.key === 'Home') {
      crop = { ...defaultTerrainCrop };
    } else {
      return;
    }

    event.preventDefault();
    scheduleChange();
  });

  const observer = new ResizeObserver(paintSelection);

  observer.observe(svg);

  return {
    getCrop: () => ({ ...crop }),
    dispose: () => {
      observer.disconnect();

      if (pendingFrame !== undefined) {
        cancelAnimationFrame(pendingFrame);
      }
    },
    update(field, sourceWidth, sourceHeight, settings, contourLevels) {
      width = sourceWidth;
      height = sourceHeight;
      shape = getModel().cropShape ?? 'rectangle';
      crop = { ...getSelection() };
      select.value = shape;
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      const key = JSON.stringify([
        sourceWidth,
        sourceHeight,
        settings.background,
        settings.lineColor,
        contourLevels,
      ]);

      if (field !== previousField || key !== imageKey) {
        const canvas = document.createElement('canvas');

        canvas.width = 320;
        canvas.height = Math.max(1, Math.round((320 * height) / width));
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Terrain crop preview could not be created.');
        }

        const pixels = context.createImageData(canvas.width, canvas.height);
        const background = [1, 3, 5].map((offset) =>
          parseInt(settings.background.slice(offset, offset + 2), 16),
        );
        const ink = [1, 3, 5].map((offset) =>
          parseInt(settings.lineColor.slice(offset, offset + 2), 16),
        );
        let minimum = Infinity;
        let maximum = -Infinity;

        for (const value of field.values) {
          minimum = Math.min(minimum, value);
          maximum = Math.max(maximum, value);
        }

        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const elevation = sampleHeightField(
              field,
              (x / canvas.width) * width,
              (y / canvas.height) * height,
            );
            const shade =
              0.12 + ((elevation - minimum) / Math.max(0.001, maximum - minimum)) * 0.78;
            const offset = (y * canvas.width + x) * 4;

            for (let channel = 0; channel < 3; channel++) {
              pixels.data[offset + channel] =
                background[channel] * (1 - shade) + ink[channel] * shade;
            }

            pixels.data[offset + 3] = 255;
          }
        }

        context.putImageData(pixels, 0, 0);
        const levels =
          contourLevels ??
          Array.from(
            { length: 12 },
            (_, index) => minimum + ((maximum - minimum) * (index + 1)) / 13,
          );

        context.strokeStyle = settings.lineColor;
        context.globalAlpha = 0.5;
        context.lineWidth = 0.6;

        for (const contour of extractContours(field, levels)) {
          for (const path of contour.paths) {
            context.beginPath();
            path.points.forEach((point, index) => {
              const x = (point.x / width) * canvas.width;
              const y = (point.y / height) * canvas.height;

              if (index === 0) {
                context.moveTo(x, y);
              } else {
                context.lineTo(x, y);
              }
            });

            if (path.closed) {
              context.closePath();
            }

            context.stroke();
          }
        }

        const image = getRequiredElement(container, '[data-crop-image]', SVGElement);

        image.setAttribute('href', canvas.toDataURL());
        image.setAttribute('width', String(width));
        image.setAttribute('height', String(height));
        previousField = field;
        imageKey = key;
      }

      paintSelection();
    },
  };
}
