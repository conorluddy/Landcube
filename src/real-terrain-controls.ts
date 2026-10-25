import { realTerrainPresets, realTerrainPresetGroups } from './constants/real-terrain';
import { loadBrowserRealTerrain } from './browser-real-terrain';
import { realTerrainBounds } from './constants/real-terrain';
import type { RealTerrain } from './real-terrain';

/** Mounts explicit network loading controls; failed requests retain the current landscape. */
export function mountRealTerrainControls(
  panel: HTMLElement,
  applyTerrain: (terrain: RealTerrain | undefined) => void,
): void {
  const section = document.createElement('div');

  section.className = 'real-terrain-controls';
  section.innerHTML = `<p class="export-hint">Choose a real-world location or use a generated landscape.</p><div class="detail-content">
    <div class="select-row"><label for="terrain-place">Location</label><select id="terrain-place">${realTerrainPresetGroups
      .map(
        ({ country, locations }) =>
          `<optgroup label="${country}">${locations
            .map(
              ({ name, latitude, longitude }) =>
                `<option value="${latitude},${longitude}"${name === realTerrainPresets[0].name ? ' selected' : ''}>${name}</option>`,
            )
            .join('')}</optgroup>`,
      )
      .join('')}</select></div>
    <div class="control-grid"><label>Latitude<input id="terrain-latitude" type="number" min="-85" max="85" step="any" value="${realTerrainPresets[0].latitude}"></label><label>Longitude<input id="terrain-longitude" type="number" min="-180" max="180" step="any" value="${realTerrainPresets[0].longitude}"></label></div>
    <label>Area span (km)<input id="terrain-span" type="number" min="${realTerrainBounds.minimumSpanKm}" max="${realTerrainBounds.maximumSpanKm}" value="${realTerrainPresets[0].spanKm}"></label>
    <label>Maximum depth below sea level (m)<input id="terrain-max-depth" type="number" min="0" max="11000" step="any" value="20"></label>
    <label>Elevation floor (m, optional)<input id="terrain-elevation-floor" type="number" min="-11000" max="8900" step="any" placeholder="Include all elevations"></label>
    <label class="toggle-row">Sea-level hatching<input type="checkbox" role="switch" data-sea-level checked></label>
    <p>Hatches terrain at or below 0 m. This is an elevation indicator, not a water map. Included in exports; session-only.</p>
    <p>Omit low elevations to reduce coastal source artifacts. This does not trace the shoreline.</p>
    <div class="actions"><button type="button" data-load class="primary-button">Load terrain</button><button type="button" data-generated class="text-button">Use generated</button></div>
    <p data-credit></p><p data-status role="status">Loads public elevation tiles. Location is session-only; Copy link saves styling only.</p>
    <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener noreferrer">Terrain data sources & attribution ↗</a>
  </div>`;
  const slot = panel.querySelector('[data-real-terrain-slot]');

  if (!slot) {
    throw new Error('Real terrain control slot is missing.');
  }

  slot.replaceWith(section);
  const latitude = section.querySelector<HTMLInputElement>('#terrain-latitude');
  const longitude = section.querySelector<HTMLInputElement>('#terrain-longitude');
  const span = section.querySelector<HTMLInputElement>('#terrain-span');
  const maxDepth = section.querySelector<HTMLInputElement>('#terrain-max-depth');
  const elevationFloor = section.querySelector<HTMLInputElement>('#terrain-elevation-floor');
  const loadButton = section.querySelector<HTMLButtonElement>('[data-load]');
  const status = section.querySelector<HTMLElement>('[data-status]');
  let requestVersion = 0;
  let loadedTerrain: RealTerrain | undefined;
  const hatching = section.querySelector<HTMLInputElement>('[data-sea-level]');

  hatching?.addEventListener('change', () => {
    if (loadedTerrain) {
      applyTerrain({ ...loadedTerrain, seaLevelHatching: hatching.checked });
    }
  });

  if (!latitude || !longitude || !span || !maxDepth || !elevationFloor || !loadButton || !status) {
    throw new Error('Real terrain controls are incomplete.');
  }

  section.querySelector('select')?.addEventListener('change', (event) => {
    if (event.target instanceof HTMLSelectElement) {
      const selected = event.target.value;
      const coordinates = selected.split(',');

      latitude.value = coordinates[0];
      longitude.value = coordinates[1];
      const preset = realTerrainPresets.find(
        (place) => `${place.latitude},${place.longitude}` === selected,
      );

      if (preset) {
        span.value = String(preset.spanKm);
      }
    }
  });
  section.querySelector('[data-generated]')?.addEventListener('click', () => {
    requestVersion++;
    loadButton.disabled = false;
    loadedTerrain = undefined;
    applyTerrain(undefined);
    status.textContent = 'Using generated terrain.';
  });
  loadButton.addEventListener('click', () => {
    const version = ++requestVersion;

    loadButton.disabled = true;
    status.textContent = 'Downloading elevation tiles…';
    void loadBrowserRealTerrain(
      latitude.valueAsNumber,
      longitude.valueAsNumber,
      span.valueAsNumber,
      elevationFloor.value === '' ? undefined : elevationFloor.valueAsNumber,
      maxDepth.valueAsNumber,
    )
      .then((terrain) => {
        if (version !== requestVersion) {
          return;
        }

        loadedTerrain = terrain;
        applyTerrain({ ...terrain, seaLevelHatching: hatching?.checked ?? true });
        const credit = section.querySelector('[data-credit]');

        if (credit) {
          credit.textContent = terrain.attribution;
        }

        status.textContent =
          'Real terrain loaded. Cursor deformation is disabled. Location is session-only.';
        console.info(
          JSON.stringify({
            event: 'real_terrain_loaded',
            latitude: latitude.valueAsNumber,
            longitude: longitude.valueAsNumber,
          }),
        );
      })
      .catch((error: unknown) => {
        if (version === requestVersion) {
          status.textContent =
            error instanceof Error ? error.message : 'Terrain could not load. Please retry.';
          console.error('Terrain loading failed', error);
        }
      })
      .finally(() => {
        if (version === requestVersion) {
          loadButton.disabled = false;
        }
      });
  });
}
