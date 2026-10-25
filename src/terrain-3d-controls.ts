import {
  terrainMaterialPresets,
  landFinishes,
  waterFinishes,
  type LandFinish,
  type WaterFinish,
} from './terrain-materials';
import { mountTerrainCropControls } from './terrain-crop-controls';
import type { TerrainCropSettings } from './terrain-crop';
import { getTerrainWaterColor } from './terrain-water';
import {
  defaultTerrainModelSettings,
  validateTerrainModelSettings,
  type TerrainModelSettings,
} from './terrain-model';
import {
  defaultTerrainLighting,
  getSuggestedTerrainLightDirection,
  terrainLightingControls,
  type TerrainLightingSettings,
} from './terrain-lighting';
import type { HeightField } from './types/terrain';
import type { SeaLevelGeometry } from './sea-level';
import { getRequiredElement } from './dom-elements';
import type { Contour } from './types/contours';
import type { DesignSettings } from './types/design';
import type { createTerrain3d, WaterStyle } from './terrain-3d';

/** Loads WebGL only when the experimental view is requested. */
export function mountTerrain3dControls(
  panel: HTMLElement,
  changed: () => void,
  notify: (message: string) => void,
): {
  isActive(): boolean;
  getModelSettings(): TerrainModelSettings;
  getCropSettings(): TerrainCropSettings;
  updateCropPreview(
    field: HeightField,
    width: number,
    height: number,
    settings: DesignSettings,
  ): void;
  update(
    contours: Contour[],
    width: number,
    height: number,
    settings: DesignSettings,
    field: HeightField,
    seaLevel?: SeaLevelGeometry,
    attribution?: string,
    location?: { latitude: number; longitude: number },
  ): void;
} {
  const section = document.createElement('section');

  section.id = 'three-d-content';
  section.className = 'terrain-3d-controls';
  section.hidden = true;
  section.setAttribute('aria-label', '3D settings');
  section.innerHTML = `
    <label class="toggle-row">Show raised contours<input type="checkbox" role="switch" data-view></label>
    <p class="export-hint">Explore the current landscape in 3D. Palette controls are in Settings; real terrain is in Location.</p>
    <div data-options hidden>
      <label class="toggle-row">Contour lines<input type="checkbox" role="switch" data-show-contours checked></label>
      <div data-crop-slot></div>
      <fieldset><legend>Model dimensions</legend>
        <div class="control-grid">
          <label><span data-model-width-label>Width (X, mm)</span><input data-model="widthMm" type="number" min="1" max="1000" step="any" value="150"></label>
          <label data-model-length-label>Length (Y, mm)<input data-model="lengthMm" type="number" min="1" max="1000" step="any" value="150"></label>
        </div>
        <label>Base thickness (mm)<input data-model="baseThicknessMm" type="number" min="0.1" max="100" step="any" value="3"></label>
        <p class="export-hint">Minimum material below the lowest valley. Terrain uses the selected crop above.</p>
        <p class="export-hint">Model: <output data-model-size>150 × 150 mm</output> · Overall height: <output data-model-height>—</output></p>
        <button type="button" class="primary-button" data-stl>Download STL</button>
        <p class="export-hint">Import units: millimeters. STL includes a solid base and terrain only.</p>
        <p class="export-hint" data-model-credit hidden></p>
        <button type="button" class="text-button" data-model-attribution hidden>Download attribution</button>
      </fieldset>
      <fieldset><legend>Shape</legend>
        <label class="range-control" for="terrain-3d-height"><span>Height exaggeration</span><output data-height-value>0.3×</output><input id="terrain-3d-height" data-height type="range" min="0" max="1" step="0.05" value="0.3"></label>
      </fieldset>
      <fieldset><legend>Materials</legend>
        <label class="select-row">Material preset<select data-material-preset><option value="custom">Custom</option>${Object.entries(
          terrainMaterialPresets,
        )
          .map(([key, preset]) => `<option value="${key}">${preset.label}</option>`)
          .join('')}</select></label>
        <p class="export-hint">Pair land and water colors and finishes, then adjust either below.</p>
      </fieldset>
      <fieldset><legend>Surface</legend>
        <label class="toggle-row">Show land surface<input type="checkbox" role="switch" data-surface checked></label>
        <div data-surface-options>
          <label class="select-row">Land finish<select data-land-finish>${Object.entries(
            landFinishes,
          )
            .map(([key, finish]) => `<option value="${key}">${finish.label}</option>`)
            .join('')}</select></label>
          <label class="toggle-row">Solid base<input type="checkbox" role="switch" data-solid-base></label>
          <label class="toggle-row">Match background<input type="checkbox" role="switch" data-surface-match checked></label>
          <div class="colour-row"><label>Surface color<input type="color" data-surface-color value="#202326" disabled></label></div>
        </div>
        <p class="export-hint">Turn off the surface for floating contours.</p>
      </fieldset>
      <fieldset><legend>Ground</legend>
        <label class="toggle-row">Studio floor<input type="checkbox" role="switch" data-ground checked></label>
        <label class="toggle-row">Match canvas<input type="checkbox" role="switch" data-ground-match></label>
        <div class="colour-row"><label>Floor color<input type="color" data-ground-color value="#b4b4b4"></label></div>
        <label class="toggle-row">North arrow<input type="checkbox" role="switch" data-north disabled></label>
        <p class="export-hint">The studio surrounds the solid base with a continuous floor and real cast shadows. Match the canvas or choose a floor color. The north arrow is available for real locations and stays aligned as you orbit. These decorations are omitted from STL.</p>
      </fieldset>
      <fieldset><legend>Water</legend>
        <label class="select-row">Water style<select data-water-style><option value="hatched">Hatched</option><option value="solid" selected>Solid</option><option value="off">Off</option></select></label>
        <div data-water-color-row>
          <label class="select-row">Water finish<select data-water-finish>${Object.entries(
            waterFinishes,
          )
            .map(([key, finish]) => `<option value="${key}">${finish.label}</option>`)
            .join('')}</select></label>
          <label class="toggle-row">Match terrain<input type="checkbox" role="switch" data-water-match checked></label>
          <div class="colour-row"><label>Water color<input type="color" data-water-color value="#1c1f21" disabled></label></div>
        </div>
        <div data-water-opacity-row hidden><label class="range-control" for="water-opacity"><span>Water opacity</span><output data-water-opacity-value>40%</output><input id="water-opacity" data-water-opacity type="range" min="0" max="100" step="1" value="40"></label></div>
        <label class="toggle-row">Preview water level<input type="checkbox" role="switch" data-preview-water></label>
        <div data-preview-water-row hidden><label class="range-control" for="preview-water-level"><span>Water level</span><output data-preview-water-value>40%</output><input id="preview-water-level" data-preview-water-level type="range" min="0" max="100" step="1" value="40"></label></div>
        <p class="export-hint">Uses sea level from Location, or enable Preview water level to flood the current terrain. Translucent resin reveals the seabed through the top and cut edges. Preview levels are relative to the terrain height range and apply only to 3D.</p>
      </fieldset>
      <fieldset data-lighting><legend>Lighting</legend>
        <label class="select-row">Light source<select data-light-mode><option value="sun">Sun</option><option value="moon">Moon</option><option value="off">Off</option></select></label>
        ${terrainLightingControls
          .map(
            ({ key, label, min, max, step, suffix }) =>
              `<label class="range-control" for="terrain-light-${key}"><span>${label}</span><output data-light-value="${key}">${defaultTerrainLighting[key]}${suffix}</output><input id="terrain-light-${key}" data-light="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${defaultTerrainLighting[key]}"></label>`,
          )
          .join('')}
        <button type="button" class="text-button" data-reset-lighting>Reset lighting</button>
        <p class="export-hint">Sun casts warm light; Moon casts cool light. Direction is clockwise from north. Locations suggest a hemisphere-based sunrise angle, rather than an astronomical sun position. Off keeps only the soft fill light.</p>
      </fieldset>
      <fieldset><legend>Camera</legend>
        <label class="toggle-row">Auto-rotate<input type="checkbox" role="switch" data-rotate></label>
        <button type="button" class="text-button" data-reset>Reset camera</button>
        <p class="export-hint">Drag to orbit · scroll or pinch to zoom · right-drag to pan.</p>
      </fieldset>
    </div>
    <p class="export-hint">3D settings apply to this session. SVG/PNG exports and shared links use the 2D design.</p>`;
  getRequiredElement(panel, '#export-content', HTMLElement).before(section);
  const toggle = getRequiredElement(section, '[data-view]', HTMLInputElement);
  const options = getRequiredElement(section, '[data-options]', HTMLElement);
  let view: ReturnType<typeof createTerrain3d> | undefined;
  let active = false;
  let modelSettings: TerrainModelSettings = { ...defaultTerrainModelSettings };
  let attributionText = '';
  let seed = 0;

  const updateModelLabels = () => {
    const circular = modelSettings.cropShape === 'circle';

    getRequiredElement(section, '[data-model-width-label]', HTMLElement).textContent = circular
      ? 'Diameter (mm)'
      : 'Width (X, mm)';
    getRequiredElement(section, '[data-model-length-label]', HTMLElement).hidden = circular;
    getRequiredElement(section, '[data-model-size]', HTMLOutputElement).value = circular
      ? `${modelSettings.widthMm} mm diameter`
      : `${modelSettings.widthMm} × ${modelSettings.lengthMm} mm`;
  };

  const cropControls = mountTerrainCropControls(
    getRequiredElement(section, '[data-crop-slot]', HTMLElement),
    () => modelSettings,
    (shape) => {
      modelSettings = { ...modelSettings, cropShape: shape };
      updateModelLabels();
      view?.setModelSettings(modelSettings);
      changed();
    },
  );

  const syncWaterColor = () => {
    if (getRequiredElement(section, '[data-water-match]', HTMLInputElement).checked) {
      getRequiredElement(section, '[data-water-color]', HTMLInputElement).value =
        getTerrainWaterColor(
          getRequiredElement(section, '[data-surface-color]', HTMLInputElement).value,
        );
    }
  };

  const markCustom = () => {
    getRequiredElement(section, '[data-material-preset]', HTMLSelectElement).value = 'custom';
  };

  for (const selector of [
    '[data-land-finish]',
    '[data-water-finish]',
    '[data-surface-match]',
    '[data-surface-color]',
    '[data-water-match]',
    '[data-water-color]',
    '[data-water-style]',
  ]) {
    getRequiredElement(section, selector, HTMLElement).addEventListener('input', markCustom);
    getRequiredElement(section, selector, HTMLElement).addEventListener('change', markCustom);
  }

  getRequiredElement(section, '[data-land-finish]', HTMLSelectElement).addEventListener(
    'change',
    (event) => {
      view?.setLandFinish((event.target as HTMLSelectElement).value as LandFinish);
    },
  );
  getRequiredElement(section, '[data-water-finish]', HTMLSelectElement).addEventListener(
    'change',
    (event) => {
      const finish = (event.target as HTMLSelectElement).value as WaterFinish;

      view?.setWaterFinish(finish);
      getRequiredElement(section, '[data-water-opacity-row]', HTMLElement).hidden =
        finish !== 'translucent';
    },
  );
  getRequiredElement(section, '[data-material-preset]', HTMLSelectElement).addEventListener(
    'change',
    (event) => {
      const key = (event.target as HTMLSelectElement).value as keyof typeof terrainMaterialPresets;
      const preset = (
        terrainMaterialPresets as Partial<
          Record<string, (typeof terrainMaterialPresets)[keyof typeof terrainMaterialPresets]>
        >
      )[key];

      if (!preset) {
        return;
      }

      for (const [target, color] of [
        ['surface', preset.land],
        ['water', preset.water],
      ]) {
        getRequiredElement(section, `[data-${target}-match]`, HTMLInputElement).checked = false;
        const picker = getRequiredElement(section, `[data-${target}-color]`, HTMLInputElement);

        picker.disabled = false;
        picker.value = color;
      }

      getRequiredElement(section, '[data-surface]', HTMLInputElement).checked = true;
      getRequiredElement(section, '[data-surface-options]', HTMLElement).hidden = false;
      getRequiredElement(section, '[data-water-style]', HTMLSelectElement).value = 'solid';
      getRequiredElement(section, '[data-water-color-row]', HTMLElement).hidden = false;
      getRequiredElement(section, '[data-land-finish]', HTMLSelectElement).value =
        preset.landFinish;
      getRequiredElement(section, '[data-water-finish]', HTMLSelectElement).value =
        preset.waterFinish;
      getRequiredElement(section, '[data-water-opacity-row]', HTMLElement).hidden = true;
      view?.setSurface(true);
      view?.setSurfaceColor(preset.land);
      view?.setWaterColor(preset.water);
      view?.setLandFinish(preset.landFinish);
      view?.setWaterFinish(preset.waterFinish);
      view?.setWaterStyle('solid');
    },
  );

  getRequiredElement(section, '[data-water-opacity]', HTMLInputElement).addEventListener(
    'input',
    (event) => {
      const value = (event.target as HTMLInputElement).valueAsNumber;

      getRequiredElement(section, '[data-water-opacity-value]', HTMLOutputElement).value =
        `${value}%`;
      view?.setWaterOpacity(value / 100);
    },
  );

  const syncPreviewWater = () => {
    const enabled = getRequiredElement(section, '[data-preview-water]', HTMLInputElement).checked;
    const value = getRequiredElement(
      section,
      '[data-preview-water-level]',
      HTMLInputElement,
    ).valueAsNumber;

    getRequiredElement(section, '[data-preview-water-row]', HTMLElement).hidden = !enabled;
    getRequiredElement(section, '[data-preview-water-value]', HTMLOutputElement).value =
      `${value}%`;
    view?.setPreviewWaterLevel(enabled ? value / 100 : undefined);
  };

  getRequiredElement(section, '[data-preview-water]', HTMLInputElement).addEventListener(
    'change',
    syncPreviewWater,
  );
  getRequiredElement(section, '[data-preview-water-level]', HTMLInputElement).addEventListener(
    'input',
    syncPreviewWater,
  );

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  };

  for (const input of section.querySelectorAll<HTMLInputElement>('[data-model]')) {
    input.addEventListener('change', () => {
      const key = input.dataset.model as keyof TerrainModelSettings;
      const candidate = { ...modelSettings, [key]: input.valueAsNumber };

      try {
        validateTerrainModelSettings(candidate);
        modelSettings = candidate;
        view?.setModelSettings(modelSettings);
        updateModelLabels();
        changed();
      } catch (error) {
        input.value = String(modelSettings[key]);
        notify(error instanceof Error ? error.message : 'Invalid model dimensions.');
      }
    });
  }

  getRequiredElement(section, '[data-stl]', HTMLButtonElement).addEventListener('click', () => {
    try {
      if (!view) {
        throw new Error('Enable the 3D view before downloading STL.');
      }

      download(
        new Blob([view.getStl()], { type: 'model/stl' }),
        modelSettings.cropShape === 'circle'
          ? `topogra-${seed}-circle-${modelSettings.widthMm}mm.stl`
          : `topogra-${seed}-${modelSettings.widthMm}x${modelSettings.lengthMm}mm.stl`,
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : 'STL export failed. Please retry.');
    }
  });
  getRequiredElement(section, '[data-model-attribution]', HTMLButtonElement).addEventListener(
    'click',
    () => {
      download(
        new Blob([attributionText], { type: 'text/plain' }),
        `topogra-${seed}-attribution.txt`,
      );
    },
  );
  let lighting: TerrainLightingSettings = { ...defaultTerrainLighting };
  let locationLatitude: number | undefined;
  let lastLocationKey = '';
  let customLightDirection = false;

  const syncLightingControls = () => {
    for (const { key, suffix } of terrainLightingControls) {
      getRequiredElement(section, `[data-light="${key}"]`, HTMLInputElement).value = String(
        lighting[key],
      );
      getRequiredElement(section, `[data-light-value="${key}"]`, HTMLOutputElement).value =
        `${lighting[key]}${suffix}`;
    }
  };

  toggle.addEventListener('change', () => {
    void activate();
  });

  async function activate(): Promise<void> {
    toggle.disabled = true;

    try {
      if (toggle.checked && !view) {
        const module = await import('./terrain-3d');

        view = module.createTerrain3d((heightMm) => {
          getRequiredElement(section, '[data-model-height]', HTMLOutputElement).value =
            `${Number(heightMm.toFixed(2))} mm`;
        });
        view.setLandFinish(
          getRequiredElement(section, '[data-land-finish]', HTMLSelectElement).value as LandFinish,
        );
        view.setWaterFinish(
          getRequiredElement(section, '[data-water-finish]', HTMLSelectElement)
            .value as WaterFinish,
        );
        view.setWaterOpacity(
          getRequiredElement(section, '[data-water-opacity]', HTMLInputElement).valueAsNumber / 100,
        );
        syncPreviewWater();
        view.setModelSettings(modelSettings);
        view.setLighting(lighting);
        view.setGround(getRequiredElement(section, '[data-ground]', HTMLInputElement).checked);
        view.setGroundColor(
          getRequiredElement(section, '[data-ground-match]', HTMLInputElement).checked
            ? undefined
            : getRequiredElement(section, '[data-ground-color]', HTMLInputElement).value,
        );
        view.setWaterStyle(
          getRequiredElement(section, '[data-water-style]', HTMLSelectElement).value as WaterStyle,
        );
        view.setWaterColor(
          getRequiredElement(section, '[data-water-match]', HTMLInputElement).checked
            ? undefined
            : getRequiredElement(section, '[data-water-color]', HTMLInputElement).value,
        );
        view.setContours(
          getRequiredElement(section, '[data-show-contours]', HTMLInputElement).checked,
        );
        view.setHeight(
          Number(getRequiredElement(section, '[data-height]', HTMLInputElement).value),
        );
        view.setBase(getRequiredElement(section, '[data-solid-base]', HTMLInputElement).checked);
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
  getRequiredElement(section, '[data-solid-base]', HTMLInputElement).addEventListener(
    'change',
    (event) => {
      view?.setBase((event.target as HTMLInputElement).checked);
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
      syncWaterColor();
    },
  );
  getRequiredElement(section, '[data-surface-color]', HTMLInputElement).addEventListener(
    'input',
    (event) => {
      view?.setSurfaceColor((event.target as HTMLInputElement).value);
      syncWaterColor();
    },
  );

  getRequiredElement(section, '[data-ground]', HTMLInputElement).addEventListener(
    'change',
    (event) => view?.setGround((event.target as HTMLInputElement).checked),
  );
  getRequiredElement(section, '[data-ground-match]', HTMLInputElement).addEventListener(
    'change',
    (event) => {
      const matches = (event.target as HTMLInputElement).checked;
      const picker = getRequiredElement(section, '[data-ground-color]', HTMLInputElement);

      picker.disabled = matches;
      view?.setGroundColor(matches ? undefined : picker.value);
      changed();
    },
  );
  getRequiredElement(section, '[data-ground-color]', HTMLInputElement).addEventListener(
    'input',
    (event) => view?.setGroundColor((event.target as HTMLInputElement).value),
  );
  getRequiredElement(section, '[data-north]', HTMLInputElement).addEventListener(
    'change',
    (event) => view?.setNorthArrow((event.target as HTMLInputElement).checked),
  );
  getRequiredElement(section, '[data-water-style]', HTMLSelectElement).addEventListener(
    'change',
    (event) => {
      const style = (event.target as HTMLSelectElement).value as WaterStyle;

      getRequiredElement(section, '[data-water-color-row]', HTMLElement).hidden = style !== 'solid';
      view?.setWaterStyle(style);
    },
  );
  getRequiredElement(section, '[data-water-match]', HTMLInputElement).addEventListener(
    'change',
    (event) => {
      const matches = (event.target as HTMLInputElement).checked;
      const picker = getRequiredElement(section, '[data-water-color]', HTMLInputElement);

      picker.disabled = matches;
      syncWaterColor();
      view?.setWaterColor(matches ? undefined : picker.value);
    },
  );
  getRequiredElement(section, '[data-water-color]', HTMLInputElement).addEventListener(
    'input',
    (event) => {
      view?.setWaterColor((event.target as HTMLInputElement).value);
    },
  );
  getRequiredElement(section, '[data-light-mode]', HTMLSelectElement).addEventListener(
    'change',
    (event) => {
      lighting.mode = (event.target as HTMLSelectElement).value as TerrainLightingSettings['mode'];
      view?.setLighting(lighting);
    },
  );

  for (const { key, suffix } of terrainLightingControls) {
    getRequiredElement(section, `[data-light="${key}"]`, HTMLInputElement).addEventListener(
      'input',
      (event) => {
        const value = (event.target as HTMLInputElement).valueAsNumber;

        lighting[key] = value;

        if (key === 'direction') {
          customLightDirection = true;
        }

        getRequiredElement(section, `[data-light-value="${key}"]`, HTMLOutputElement).value =
          `${value}${suffix}`;
        view?.setLighting(lighting);
      },
    );
  }

  getRequiredElement(section, '[data-reset-lighting]', HTMLButtonElement).addEventListener(
    'click',
    () => {
      customLightDirection = false;
      lighting = {
        ...defaultTerrainLighting,
        direction: getSuggestedTerrainLightDirection(locationLatitude),
      };
      getRequiredElement(section, '[data-light-mode]', HTMLSelectElement).value = lighting.mode;

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
    getModelSettings: () => ({ ...modelSettings }),
    getCropSettings: () => cropControls.getCrop(),
    updateCropPreview: (field, width, height, settings) => {
      cropControls.update(field, width, height, settings);
    },
    update: (
      contours: Contour[],
      width: number,
      height: number,
      settings: DesignSettings,
      field: HeightField,
      seaLevel?: SeaLevelGeometry,
      attribution?: string,
      location?: { latitude: number; longitude: number },
    ) => {
      locationLatitude = location?.latitude;
      const locationKey = location ? `${location.latitude},${location.longitude}` : '';

      if (locationKey !== lastLocationKey) {
        lastLocationKey = locationKey;

        if (!customLightDirection) {
          lighting.direction = getSuggestedTerrainLightDirection(locationLatitude);
          syncLightingControls();
          view?.setLighting(lighting);
        }
      }

      seed = settings.seed;
      attributionText = attribution ?? '';
      const north = getRequiredElement(section, '[data-north]', HTMLInputElement);

      north.disabled = attribution === undefined;
      view?.setNorthArrow(north.checked && !north.disabled);
      const credit = getRequiredElement(section, '[data-model-credit]', HTMLElement);

      credit.textContent = attributionText;
      credit.hidden = !attributionText;
      getRequiredElement(section, '[data-model-attribution]', HTMLButtonElement).hidden =
        !attributionText;

      if (getRequiredElement(section, '[data-surface-match]', HTMLInputElement).checked) {
        getRequiredElement(section, '[data-surface-color]', HTMLInputElement).value =
          settings.background;
      }

      syncWaterColor();

      if (getRequiredElement(section, '[data-ground-match]', HTMLInputElement).checked) {
        getRequiredElement(section, '[data-ground-color]', HTMLInputElement).value =
          settings.background;
      }

      if (active) {
        view?.update(contours, width, height, settings, field, seaLevel);
      }
    },
  };
}
