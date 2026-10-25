import {
  defaultTerrainLighting,
  terrainLightingControls,
  type TerrainLightingSettings,
} from './terrain-lighting';
import type { HeightField } from './types/terrain';
import type { SeaLevelGeometry } from './sea-level';
import { getRequiredElement } from './dom-elements';
import type { Contour } from './types/contours';
import type { DesignSettings } from './types/design';
import type { createTerrain3d } from './terrain-3d';

/** Loads WebGL only when the experimental view is requested. */
export function mountTerrain3dControls(
  panel: HTMLElement,
  changed: () => void,
  notify: (message: string) => void,
): {
  isActive(): boolean;
  update(
    contours: Contour[],
    width: number,
    height: number,
    settings: DesignSettings,
    field: HeightField,
    seaLevel?: SeaLevelGeometry,
  ): void;
} {
  const section = document.createElement('section');

  section.id = 'three-d-content';
  section.className = 'terrain-3d-controls';
  section.hidden = true;
  section.setAttribute('aria-label', '3D settings');
  section.innerHTML = `
    <label class="toggle-row">Show raised contours<input type="checkbox" role="switch" data-view></label>
    <p class="export-hint">Explore the current landscape in 3D. Palette and terrain controls are in Settings.</p>
    <div data-options hidden>
      <label class="toggle-row">Contour lines<input type="checkbox" role="switch" data-show-contours checked></label>
      <fieldset><legend>Shape</legend>
        <label class="range-control" for="terrain-3d-height"><span>Height exaggeration</span><output data-height-value>0.3×</output><input id="terrain-3d-height" data-height type="range" min="0" max="1" step="0.05" value="0.3"></label>
      </fieldset>
      <fieldset><legend>Surface</legend>
        <label class="toggle-row">Matte surface<input type="checkbox" role="switch" data-surface checked></label>
        <div data-surface-options>
          <label class="toggle-row">Match background<input type="checkbox" role="switch" data-surface-match checked></label>
          <div class="colour-row"><label>Surface color<input type="color" data-surface-color value="#202326" disabled></label></div>
        </div>
        <p class="export-hint">Turn off the surface for floating contours.</p>
      </fieldset>
      <fieldset data-lighting><legend>Lighting</legend>
        ${terrainLightingControls
          .map(
            ({ key, label, min, max, step, suffix }) =>
              `<label class="range-control" for="terrain-light-${key}"><span>${label}</span><output data-light-value="${key}">${defaultTerrainLighting[key]}${suffix}</output><input id="terrain-light-${key}" data-light="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${defaultTerrainLighting[key]}"></label>`,
          )
          .join('')}
        <button type="button" class="text-button" data-reset-lighting>Reset lighting</button>
        <p class="export-hint">Low light brings out ridges. Fill softens dark areas. Lighting affects the matte surface.</p>
      </fieldset>
      <fieldset><legend>Camera</legend>
        <label class="toggle-row">Auto-rotate<input type="checkbox" role="switch" data-rotate></label>
        <button type="button" class="text-button" data-reset>Reset camera</button>
        <p class="export-hint">Drag to orbit · scroll or pinch to zoom · right-drag to pan.</p>
      </fieldset>
    </div>
    <p class="export-hint">3D settings apply to this session. Exports and shared links use the 2D design.</p>`;
  getRequiredElement(panel, '#export-content', HTMLElement).before(section);
  const toggle = getRequiredElement(section, '[data-view]', HTMLInputElement);
  const options = getRequiredElement(section, '[data-options]', HTMLElement);
  let view: ReturnType<typeof createTerrain3d> | undefined;
  let active = false;
  let lighting: TerrainLightingSettings = { ...defaultTerrainLighting };

  toggle.addEventListener('change', () => {
    void activate();
  });

  async function activate(): Promise<void> {
    toggle.disabled = true;

    try {
      if (toggle.checked && !view) {
        const module = await import('./terrain-3d');

        view = module.createTerrain3d();
        view.setLighting(lighting);
        view.setContours(
          getRequiredElement(section, '[data-show-contours]', HTMLInputElement).checked,
        );
        view.setHeight(
          Number(getRequiredElement(section, '[data-height]', HTMLInputElement).value),
        );
        view.setSurface(getRequiredElement(section, '[data-surface]', HTMLInputElement).checked);

        if (!getRequiredElement(section, '[data-surface-match]', HTMLInputElement).checked) {
          view.setSurfaceColor(
            getRequiredElement(section, '[data-surface-color]', HTMLInputElement).value,
          );
        }
      }

      active = toggle.checked;
      options.hidden = !active;
      document.querySelector('#terrain')?.toggleAttribute('hidden', active);
      view?.setVisible(active);
      changed();
    } catch {
      active = false;
      toggle.checked = false;
      options.hidden = true;
      document.querySelector('#terrain')?.removeAttribute('hidden');
      view?.setVisible(false);
      notify('The 3D preview could not start. Your browser needs WebGL 2 support.');
    } finally {
      toggle.disabled = false;
    }
  }

  getRequiredElement(section, '[data-height]', HTMLInputElement).addEventListener(
    'input',
    (event) => {
      const height = Number((event.target as HTMLInputElement).value);

      view?.setHeight(height);
      getRequiredElement(section, '[data-height-value]', HTMLOutputElement).value = `${height}×`;
    },
  );
  getRequiredElement(section, '[data-show-contours]', HTMLInputElement).addEventListener(
    'change',
    (event) => {
      view?.setContours((event.target as HTMLInputElement).checked);
    },
  );
  getRequiredElement(section, '[data-surface]', HTMLInputElement).addEventListener(
    'change',
    (event) => {
      const enabled = (event.target as HTMLInputElement).checked;

      view?.setSurface(enabled);
      getRequiredElement(section, '[data-surface-options]', HTMLElement).hidden = !enabled;
    },
  );
  getRequiredElement(section, '[data-surface-match]', HTMLInputElement).addEventListener(
    'change',
    (event) => {
      const matches = (event.target as HTMLInputElement).checked;
      const picker = getRequiredElement(section, '[data-surface-color]', HTMLInputElement);

      picker.disabled = matches;
      view?.setSurfaceColor(matches ? undefined : picker.value);
      changed();
    },
  );
  getRequiredElement(section, '[data-surface-color]', HTMLInputElement).addEventListener(
    'input',
    (event) => {
      view?.setSurfaceColor((event.target as HTMLInputElement).value);
    },
  );

  for (const { key, suffix } of terrainLightingControls) {
    getRequiredElement(section, `[data-light="${key}"]`, HTMLInputElement).addEventListener(
      'input',
      (event) => {
        const value = (event.target as HTMLInputElement).valueAsNumber;

        lighting[key] = value;
        getRequiredElement(section, `[data-light-value="${key}"]`, HTMLOutputElement).value =
          `${value}${suffix}`;
        view?.setLighting(lighting);
      },
    );
  }

  getRequiredElement(section, '[data-reset-lighting]', HTMLButtonElement).addEventListener(
    'click',
    () => {
      lighting = { ...defaultTerrainLighting };

      for (const { key, suffix } of terrainLightingControls) {
        getRequiredElement(section, `[data-light="${key}"]`, HTMLInputElement).value = String(
          lighting[key],
        );
        getRequiredElement(section, `[data-light-value="${key}"]`, HTMLOutputElement).value =
          `${lighting[key]}${suffix}`;
      }

      view?.setLighting(lighting);
    },
  );

  getRequiredElement(section, '[data-rotate]', HTMLInputElement).addEventListener(
    'change',
    (event) => {
      view?.setRotating((event.target as HTMLInputElement).checked);
    },
  );
  getRequiredElement(section, '[data-reset]', HTMLButtonElement).addEventListener('click', () =>
    view?.reset(),
  );

  return {
    isActive: () => active,
    update: (
      contours: Contour[],
      width: number,
      height: number,
      settings: DesignSettings,
      field: HeightField,
      seaLevel?: SeaLevelGeometry,
    ) => {
      if (getRequiredElement(section, '[data-surface-match]', HTMLInputElement).checked) {
        getRequiredElement(section, '[data-surface-color]', HTMLInputElement).value =
          settings.background;
      }

      if (active) {
        view?.update(contours, width, height, settings, field, seaLevel);
      }
    },
  };
}
