import { extractContours } from './contour-extraction';
import {
  addCropPolygonCorner,
  cropPolygonSideLimits,
  defaultCropPolygon,
  removeCropPolygonCorner,
  defaultTerrainCrop,
  getCropFootprint,
  getRotatedExtent,
  getTerrainCropBounds,
  isInsideCropFootprint,
  isStarShapedCropPolygon,
  normalizeRotationDegrees,
  type CropPoint,
  type TerrainCropSettings,
  type TerrainCropShape,
} from './terrain-crop';
import { getRequiredElement } from './dom-elements';
import { sampleHeightField } from './terrain-surface';
import { defaultTerrainModelSettings, type TerrainModelSettings } from './terrain-model';
import type { HeightField } from './types/terrain';
import type { DesignSettings } from './types/design';

type CropSide = 'left' | 'right' | 'top' | 'bottom';
type CropDrag =
  | { kind: 'move'; x: number; y: number; crop: TerrainCropSettings }
  | { kind: 'resize'; crop: TerrainCropSettings }
  | { kind: 'side'; side: CropSide; crop: TerrainCropSettings; width: number; height: number }
  | { kind: 'rotate'; crop: TerrainCropSettings }
  | { kind: 'vertex'; index: number };

/** Top-down terrain selection; moving the crop never moves or regenerates its source. */
export function mountTerrainCropControls(
  container: HTMLElement,
  getModel: () => TerrainModelSettings,
  /** `ratio` is a new width ÷ length when side handles or a reset reshaped the rectangle. */
  changed: (
    shape: TerrainCropShape,
    polygon: readonly CropPoint[] | undefined,
    ratio: number | undefined,
  ) => void,
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
    <div class="select-row"><label for="terrain-crop-shape">Crop shape</label><select id="terrain-crop-shape" data-crop-shape><option value="rectangle">Rectangle</option><option value="circle">Circle</option><option value="polygon">Poly</option></select></div>
    <div class="select-row" data-crop-sides-row hidden><span id="terrain-crop-sides-label">Sides</span><div class="crop-sides-stepper" role="group" aria-labelledby="terrain-crop-sides-label"><button type="button" class="text-button" data-crop-sides-down aria-label="Fewer sides">−</button><output data-crop-sides aria-live="polite">6</output><button type="button" class="text-button" data-crop-sides-up aria-label="More sides">+</button></div></div>
    <svg class="terrain-crop-preview" role="img" aria-label="Terrain crop preview. Drag inside to move; drag a corner to resize; drag the top handle to rotate. Arrow keys move, plus and minus resize, square brackets rotate." tabindex="0" data-crop-preview>
      <image data-crop-image></image>
      <path data-crop-mask fill="#000" fill-opacity="0.65" fill-rule="evenodd" pointer-events="none"></path>
      <path data-crop-outline fill="transparent" stroke="currentColor" vector-effect="non-scaling-stroke" stroke-width="2"></path>
      <line data-crop-rotate-arm stroke="currentColor" vector-effect="non-scaling-stroke" stroke-width="1.5" pointer-events="none"></line>
      <g data-crop-handles></g>
      <circle data-crop-rotate fill="#202326" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"></circle>
      <text x="12" y="20" class="crop-north" pointer-events="none">N ↑</text>
    </svg>
    <ul class="export-hint crop-polygon-help" data-crop-polygon-help hidden>
      <li><strong>Move a corner:</strong> drag it</li>
      <li><strong>Add a corner:</strong> double-click an edge</li>
      <li><strong>Delete a corner:</strong> double-click it (at least three stay)</li>
      <li>Every edge must face the center; edits that fold past it are skipped.</li>
    </ul>
    <label class="range-control" for="terrain-crop-size"><span>Crop size</span><output for="terrain-crop-size" data-crop-size-value>100%</output><input id="terrain-crop-size" type="range" data-crop-size min="10" max="100" step="1" value="100"></label>
    <label class="range-control" for="terrain-crop-rotation"><span>Rotation</span><output for="terrain-crop-rotation" data-crop-rotation-value>0°</output><input id="terrain-crop-rotation" type="range" data-crop-rotation min="-180" max="180" step="1" value="0"></label>
    <button type="button" class="text-button" data-crop-reset>Reset crop</button>
    <p class="export-hint" data-crop-hint></p>
  </fieldset>`;
  const svg = getRequiredElement(container, '[data-crop-preview]', SVGSVGElement);
  const select = getRequiredElement(container, '[data-crop-shape]', HTMLSelectElement);
  const slider = getRequiredElement(container, '[data-crop-size]', HTMLInputElement);
  const rotationSlider = getRequiredElement(container, '[data-crop-rotation]', HTMLInputElement);
  const handlesGroup = getRequiredElement(container, '[data-crop-handles]', SVGElement);
  const rotateHandle = getRequiredElement(container, '[data-crop-rotate]', SVGElement);
  let crop: TerrainCropSettings = { ...getSelection() };
  let shape: TerrainCropShape = 'rectangle';
  let polygon: readonly CropPoint[] = defaultCropPolygon;
  let width = 1;
  let height = 1;
  let previousField: HeightField | undefined;
  let imageKey = '';
  let pendingFrame: number | undefined;
  let drag: CropDrag | undefined;

  const isRound = () => shape === 'circle';
  // Side drags reshape the crop before the model's dimensions catch up.
  let ratioOverride: number | undefined;
  let hasFittedSource = false;
  const ratio = () => (isRound() ? 1 : (ratioOverride ?? getModel().widthMm / getModel().lengthMm));

  const fitToSource = () => {
    ratioOverride = width / height;
    crop = { ...defaultTerrainCrop };
  };

  const bounds = () => getTerrainCropBounds(width, height, ratio(), crop, isRound());
  const radians = () => ((crop.rotationDegrees ?? 0) * Math.PI) / 180;

  /** Crop-box local (top-left origin) to source coordinates. */
  const toSource = (box: ReturnType<typeof bounds>, point: CropPoint): CropPoint => {
    const cos = Math.cos(radians());
    const sin = Math.sin(radians());
    const dx = point.x - box.width / 2;
    const dy = point.y - box.height / 2;

    return {
      x: box.x + box.width / 2 + dx * cos - dy * sin,
      y: box.y + box.height / 2 + dx * sin + dy * cos,
    };
  };

  /** Source to crop-box local coordinates around a fixed center. */
  const toLocal = (centerX: number, centerY: number, point: CropPoint): CropPoint => {
    const cos = Math.cos(radians());
    const sin = Math.sin(radians());
    const dx = point.x - centerX;
    const dy = point.y - centerY;

    return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
  };

  const getLocalOutline = (box: ReturnType<typeof bounds>): CropPoint[] =>
    getCropFootprint(shape, polygon, box.width, box.height).outline?.slice() ?? [
      { x: 0, y: 0 },
      { x: box.width, y: 0 },
      { x: box.width, y: box.height },
      { x: 0, y: box.height },
    ];

  const paintSelection = () => {
    const box = bounds();

    crop = box.crop;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const radius = box.width / 2;
    const corners = getLocalOutline(box).map((p) => toSource(box, p));
    const path = isRound()
      ? `M ${cx - radius} ${cy} a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 ${-radius * 2} 0 Z`
      : `M ${corners.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`;

    getRequiredElement(container, '[data-crop-outline]', SVGElement).setAttribute('d', path);
    getRequiredElement(container, '[data-crop-mask]', SVGElement).setAttribute(
      'd',
      `M 0 0 H ${width} V ${height} H 0 Z ${path}`,
    );
    // Polygon corners are vertices to edit; every other shape resizes from its handles.
    const handles = isRound()
      ? [
          { x: 0, y: box.height / 2 },
          { x: box.width, y: box.height / 2 },
          { x: box.width / 2, y: 0 },
          { x: box.width / 2, y: box.height },
        ].map((p) => toSource(box, p))
      : shape === 'polygon'
        ? polygon.map((p) => toSource(box, { x: p.x * box.width, y: p.y * box.height }))
        : corners;
    const sides: [CropSide, CropPoint][] =
      shape === 'rectangle'
        ? [
            ['top', { x: box.width / 2, y: 0 }],
            ['right', { x: box.width, y: box.height / 2 }],
            ['bottom', { x: box.width / 2, y: box.height }],
            ['left', { x: 0, y: box.height / 2 }],
          ]
        : [];
    const matrix = svg.getScreenCTM();
    const pixelScale = Math.max(matrix ? Math.hypot(matrix.a, matrix.b) : 320 / width, 0.0001);
    const handleRadius = 6 / pixelScale;
    const north = getRequiredElement(container, '.crop-north', SVGElement);

    north.setAttribute('x', String(12 / pixelScale));
    north.setAttribute('y', String(20 / pixelScale));
    north.setAttribute('font-size', String(12 / pixelScale));

    handlesGroup.innerHTML =
      handles
        .map(
          (p, index) =>
            `<circle ${shape === 'polygon' ? `data-crop-vertex="${index}"` : 'data-crop-handle'} cx="${p.x}" cy="${p.y}" r="${handleRadius}" fill="currentColor" stroke="#202326" stroke-width="1" vector-effect="non-scaling-stroke"/>`,
        )
        .join('') +
      sides
        .map(([side, local]) => {
          const p = toSource(box, local);

          return `<rect data-crop-side="${side}" x="${p.x - handleRadius * 0.8}" y="${p.y - handleRadius * 0.8}" width="${handleRadius * 1.6}" height="${handleRadius * 1.6}" transform="rotate(${crop.rotationDegrees ?? 0} ${p.x} ${p.y})" fill="currentColor" stroke="#202326" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
        })
        .join('');
    const armBase = toSource(box, { x: box.width / 2, y: 0 });
    const armTip = toSource(box, { x: box.width / 2, y: -22 / pixelScale });
    const arm = getRequiredElement(container, '[data-crop-rotate-arm]', SVGElement);

    arm.setAttribute('x1', String(armBase.x));
    arm.setAttribute('y1', String(armBase.y));
    arm.setAttribute('x2', String(armTip.x));
    arm.setAttribute('y2', String(armTip.y));
    rotateHandle.setAttribute('cx', String(armTip.x));
    rotateHandle.setAttribute('cy', String(armTip.y));
    rotateHandle.setAttribute('r', String(handleRadius));
    slider.value = String(Math.round(crop.size * 100));
    getRequiredElement(container, '[data-crop-size-value]', HTMLOutputElement).value =
      `${Math.round(crop.size * 100)}%`;
    const degrees = Math.round(crop.rotationDegrees ?? 0);

    rotationSlider.value = String(degrees);
    getRequiredElement(container, '[data-crop-rotation-value]', HTMLOutputElement).value =
      `${degrees}°`;
    getRequiredElement(container, '[data-crop-hint]', HTMLParagraphElement).textContent =
      shape === 'polygon'
        ? 'Drag inside to move, the top knob to rotate, or use Crop size to resize. Preview and STL use the selected area.'
        : `Drag the crop to move it, a handle to resize, or the top knob to rotate (Shift snaps to 15°). Preview and STL use the selected area.${isRound() ? ' Circle size in millimeters is set by Diameter below.' : ''}`;
    getRequiredElement(container, '[data-crop-polygon-help]', HTMLUListElement).hidden =
      shape !== 'polygon';
    getRequiredElement(container, '[data-crop-sides-row]', HTMLDivElement).hidden =
      shape !== 'polygon';
    getRequiredElement(container, '[data-crop-sides]', HTMLOutputElement).value = String(
      polygon.length,
    );
    getRequiredElement(container, '[data-crop-sides-down]', HTMLButtonElement).disabled =
      polygon.length <= cropPolygonSideLimits.minimum;
    getRequiredElement(container, '[data-crop-sides-up]', HTMLButtonElement).disabled =
      polygon.length >= cropPolygonSideLimits.maximum;
    svg.setAttribute('data-crop-center', `${crop.centerX},${crop.centerY}`);
    svg.setAttribute('data-crop-shape', shape);
  };

  const scheduleChange = () => {
    paintSelection();

    pendingFrame ??= requestAnimationFrame(() => {
      pendingFrame = undefined;
      changed(shape, shape === 'polygon' ? polygon : undefined, ratioOverride);
    });
  };

  const setRotation = (degrees: number) => {
    const rotationDegrees = normalizeRotationDegrees(degrees);

    crop = { ...crop, rotationDegrees };
  };

  select.addEventListener('change', () => {
    shape = select.value as TerrainCropShape;
    scheduleChange();
  });
  slider.addEventListener('input', () => {
    crop = { ...crop, size: slider.valueAsNumber / 100 };
    scheduleChange();
  });
  rotationSlider.addEventListener('input', () => {
    setRotation(rotationSlider.valueAsNumber);
    scheduleChange();
  });
  // Stepping keeps hand-made edits: a new corner splits an edge, and the least-felt corner goes.
  getRequiredElement(container, '[data-crop-sides-up]', HTMLButtonElement).addEventListener(
    'click',
    () => {
      if (polygon.length < cropPolygonSideLimits.maximum) {
        tryPolygon(addCropPolygonCorner(polygon));
      }
    },
  );
  getRequiredElement(container, '[data-crop-sides-down]', HTMLButtonElement).addEventListener(
    'click',
    () => {
      const fewer = removeCropPolygonCorner(polygon);

      if (fewer) {
        tryPolygon(fewer);
      }
    },
  );
  getRequiredElement(container, '[data-crop-reset]', HTMLButtonElement).addEventListener(
    'click',
    () => {
      crop = { ...defaultTerrainCrop };
      polygon = defaultCropPolygon;

      if (shape === 'rectangle') {
        fitToSource();
      }

      scheduleChange();
    },
  );

  const point = (event: MouseEvent) => {
    const matrix = svg.getScreenCTM();

    if (!matrix) {
      return { x: 0, y: 0 };
    }

    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  };

  /** Normalized crop-box position of a pointer, for polygon editing. */
  const toNormalized = (position: CropPoint): CropPoint => {
    const box = bounds();
    const local = toLocal(box.x + box.width / 2, box.y + box.height / 2, position);

    return {
      x: Math.max(0, Math.min(1, local.x / box.width + 0.5)),
      y: Math.max(0, Math.min(1, local.y / box.height + 0.5)),
    };
  };

  /** Applies a polygon edit only when it still surrounds the crop center. */
  const tryPolygon = (next: readonly CropPoint[]) => {
    if (!isStarShapedCropPolygon(next)) {
      return;
    }

    polygon = next;
    scheduleChange();
  };

  svg.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.detail > 1) {
      return;
    }

    const position = point(event);
    const box = bounds();
    const target = event.target instanceof Element ? event.target : undefined;
    const local = toLocal(box.x + box.width / 2, box.y + box.height / 2, position);
    const inside = isRound()
      ? Math.hypot(local.x, local.y) <= box.width / 2
      : isInsideCropFootprint(
          { x: local.x + box.width / 2, y: local.y + box.height / 2 },
          getCropFootprint(shape, polygon, box.width, box.height),
        );
    const vertex = target?.getAttribute('data-crop-vertex');
    const side = target?.getAttribute('data-crop-side') as CropSide | null | undefined;

    if (target === rotateHandle) {
      drag = { kind: 'rotate', crop: { ...crop } };
    } else if (vertex !== null && vertex !== undefined) {
      drag = { kind: 'vertex', index: Number(vertex) };
    } else if (side !== null && side !== undefined) {
      drag = { kind: 'side', side, crop: { ...crop }, width: box.width, height: box.height };
    } else if (target?.hasAttribute('data-crop-handle') === true) {
      drag = { kind: 'resize', crop: { ...crop } };
    } else if (inside) {
      drag = { kind: 'move', x: position.x, y: position.y, crop: { ...crop } };
    } else {
      return;
    }

    event.preventDefault();
    svg.focus();
    svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove', (event) => {
    if (!drag) {
      return;
    }

    const position = point(event);

    if (drag.kind === 'vertex') {
      const index = drag.index;

      tryPolygon(polygon.map((p, i) => (i === index ? toNormalized(position) : p)));

      return;
    }

    if (drag.kind === 'side') {
      resizeSide(drag, position);
      scheduleChange();

      return;
    }

    if (drag.kind === 'rotate') {
      const cx = drag.crop.centerX * width;
      const cy = drag.crop.centerY * height;
      const degrees = (Math.atan2(position.y - cy, position.x - cx) * 180) / Math.PI + 90;

      setRotation(event.shiftKey ? Math.round(degrees / 15) * 15 : degrees);
    } else if (drag.kind === 'resize') {
      const full = getTerrainCropBounds(
        width,
        height,
        ratio(),
        { ...drag.crop, size: 1 },
        isRound(),
      );
      const cx = drag.crop.centerX * width;
      const cy = drag.crop.centerY * height;
      const local = toLocal(cx, cy, position);
      const requested = isRound()
        ? Math.hypot(local.x, local.y) / (full.width / 2)
        : Math.max(Math.abs(local.x) / (full.width / 2), Math.abs(local.y) / (full.height / 2));
      const extent = getRotatedExtent(
        full.width,
        full.height,
        isRound() ? 0 : (drag.crop.rotationDegrees ?? 0),
      );
      // Growing stops at the source edge rather than pushing the center away.
      const maximum = Math.min(
        Math.min(cx, width - cx) / (extent.horizontal / 2),
        Math.min(cy, height - cy) / (extent.vertical / 2),
      );

      crop = { ...drag.crop, size: Math.max(0.1, Math.min(1, requested, maximum)) };
    } else {
      crop = {
        ...drag.crop,
        centerX: drag.crop.centerX + (position.x - drag.x) / width,
        centerY: drag.crop.centerY + (position.y - drag.y) / height,
      };
    }

    scheduleChange();
  });

  /** Moves one side while the opposite side stays put, reshaping the rectangle. */
  const resizeSide = (start: Extract<CropDrag, { kind: 'side' }>, position: CropPoint) => {
    const cx = start.crop.centerX * width;
    const cy = start.crop.centerY * height;
    const local = toLocal(cx, cy, position);
    const isHorizontal = start.side === 'left' || start.side === 'right';
    const sign = start.side === 'right' || start.side === 'bottom' ? 1 : -1;
    const startSpan = isHorizontal ? start.width : start.height;
    const minimumSpan = Math.min(width, height) * 0.05;
    const span = Math.max(minimumSpan, (isHorizontal ? local.x : local.y) * sign + startSpan / 2);
    const shift = ((span - startSpan) / 2) * sign;
    const cos = Math.cos(radians());
    const sin = Math.sin(radians());
    const nextWidth = isHorizontal ? span : start.width;
    const nextHeight = isHorizontal ? start.height : span;
    const centerX = cx + (isHorizontal ? shift * cos : -shift * sin);
    const centerY = cy + (isHorizontal ? shift * sin : shift * cos);
    const nextRatio = nextWidth / nextHeight;
    const full = getTerrainCropBounds(width, height, nextRatio, {
      ...start.crop,
      size: 1,
    });

    ratioOverride = nextRatio;
    crop = {
      ...start.crop,
      centerX: centerX / width,
      centerY: centerY / height,
      size: Math.min(1, nextWidth / full.width),
    };
  };

  const endDrag = () => {
    drag = undefined;
  };

  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('lostpointercapture', endDrag);
  svg.addEventListener('dblclick', (event) => {
    if (shape !== 'polygon') {
      return;
    }

    const target = event.target instanceof Element ? event.target : undefined;
    const vertex = target?.getAttribute('data-crop-vertex');

    if (vertex !== null && vertex !== undefined) {
      if (polygon.length > 3) {
        tryPolygon(polygon.filter((_, index) => index !== Number(vertex)));
      }

      return;
    }

    const clicked = toNormalized(point(event));
    let nearestEdge = 0;
    let nearestDistance = Infinity;

    polygon.forEach((a, index) => {
      const b = polygon[(index + 1) % polygon.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const t = Math.max(
        0,
        Math.min(1, ((clicked.x - a.x) * dx + (clicked.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
      );
      const distance = Math.hypot(clicked.x - a.x - dx * t, clicked.y - a.y - dy * t);

      if (distance < nearestDistance) {
        nearestEdge = index;
        nearestDistance = distance;
      }
    });

    tryPolygon([...polygon.slice(0, nearestEdge + 1), clicked, ...polygon.slice(nearestEdge + 1)]);
  });
  svg.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 0.05 : 0.01;
    const turn = event.shiftKey ? 15 : 1;

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
    } else if (event.key === '[' || event.key === '{') {
      setRotation((crop.rotationDegrees ?? 0) - turn);
    } else if (event.key === ']' || event.key === '}') {
      setRotation((crop.rotationDegrees ?? 0) + turn);
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
      const model = getModel();

      shape = model.cropShape ?? 'rectangle';
      polygon = model.cropPolygon ?? defaultCropPolygon;
      crop = { ...getSelection() };
      select.value = shape;
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

      // The model has caught up with any reshape unless one is still waiting to be sent.
      if (pendingFrame === undefined) {
        ratioOverride = undefined;
      }

      // A fresh project's rectangle starts as the whole source rather than a square inside it.
      if (!hasFittedSource) {
        hasFittedSource = true;
        const isUntouched =
          shape === 'rectangle' &&
          JSON.stringify(crop) === JSON.stringify(defaultTerrainCrop) &&
          model.widthMm === defaultTerrainModelSettings.widthMm &&
          model.lengthMm === defaultTerrainModelSettings.lengthMm;

        if (isUntouched) {
          fitToSource();
          scheduleChange();
        }
      }

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
