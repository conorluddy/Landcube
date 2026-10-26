import { getRequiredElement } from './dom-elements';
import {
  copyElevationGradient,
  elevationGradientPresets,
  getElevationGradientCss,
  maximumElevationColorStops,
  mixElevationColors,
  type ElevationGradientSettings,
} from './terrain-elevation-gradient';

/** Session-only palette editing, independent of land finish and geometry. */
export function mountElevationGradientControls(
  container: HTMLElement,
  changed: (settings: ElevationGradientSettings) => void,
): { getSettings(): ElevationGradientSettings } {
  let settings = copyElevationGradient({
    enabled: false,
    transition: 'soft',
    stops: elevationGradientPresets.paper.stops,
  });

  container.innerHTML = `<fieldset><legend>Elevation gradient</legend>
    <label class="toggle-row">Color by elevation<input type="checkbox" role="switch" data-gradient-enabled></label>
    <div data-gradient-options hidden>
      <label class="select-row">Gradient preset<select data-gradient-preset><option value="custom">Custom</option>${Object.entries(
        elevationGradientPresets,
      )
        .map(([key, preset]) => `<option value="${key}">${preset.label}</option>`)
        .join('')}</select></label>
      <label class="select-row">Transitions<select data-gradient-transition><option value="soft">Soft</option><option value="hard">Hard</option></select></label>
      <div class="elevation-gradient-preview" data-gradient-preview role="img" aria-label="Elevation colors from low to high"><div data-gradient-markers></div></div>
      <div class="elevation-gradient-labels"><span>Low elevation</span><span>High elevation</span></div>
      <div class="elevation-gradient-stops" data-gradient-stops></div>
      <div class="actions"><button type="button" class="text-button" data-gradient-add>Add color stop</button><button type="button" class="text-button" data-gradient-reverse>Reverse</button></div>
      <p class="export-hint">Soft blends between colors; Hard creates solid elevation bands. Colors stay anchored to the landscape when cropping. Land finish controls texture and sheen.</p>
    </div>
  </fieldset>`;
  const presetSelect = getRequiredElement(container, '[data-gradient-preset]', HTMLSelectElement);
  const transition = getRequiredElement(container, '[data-gradient-transition]', HTMLSelectElement);
  const rows = getRequiredElement(container, '[data-gradient-stops]', HTMLElement);
  const preview = getRequiredElement(container, '[data-gradient-preview]', HTMLElement);
  const add = getRequiredElement(container, '[data-gradient-add]', HTMLButtonElement);

  presetSelect.value = 'paper';

  const paintPreview = () => {
    preview.style.backgroundImage = getElevationGradientCss(settings);
    getRequiredElement(container, '[data-gradient-markers]', HTMLElement).innerHTML = settings.stops
      .map(
        (stop) =>
          `<span class="elevation-gradient-marker" style="left:${stop.position * 100}%;background:${stop.color}" aria-hidden="true"></span>`,
      )
      .join('');
  };

  const renderStops = () => {
    rows.innerHTML = settings.stops
      .map((stop, index) => {
        const endpoint = index === 0 || index === settings.stops.length - 1;

        return `<div class="elevation-gradient-stop">
        <label>Stop ${index + 1}<input type="color" aria-label="Stop ${index + 1} color" data-stop-color="${index}" value="${stop.color}"></label>
        <label>Position %<input type="number" aria-label="Stop ${index + 1} position" data-stop-position="${index}" min="${endpoint ? stop.position * 100 : Math.round(settings.stops[index - 1].position * 100) + 1}" max="${endpoint ? stop.position * 100 : Math.round(settings.stops[index + 1].position * 100) - 1}" step="1" value="${Math.round(stop.position * 100)}"${endpoint ? ' disabled' : ''}></label>
        <button type="button" class="text-button" data-stop-remove="${index}" aria-label="Remove stop ${index + 1}"${endpoint ? ' disabled' : ''}>×</button>
      </div>`;
      })
      .join('');
    add.disabled = settings.stops.length >= maximumElevationColorStops;
    paintPreview();
  };

  const publish = () => {
    changed(copyElevationGradient(settings));
  };

  const markCustom = () => {
    presetSelect.value = 'custom';
  };

  getRequiredElement(container, '[data-gradient-enabled]', HTMLInputElement).addEventListener(
    'change',
    (event) => {
      settings = { ...settings, enabled: (event.target as HTMLInputElement).checked };
      getRequiredElement(container, '[data-gradient-options]', HTMLElement).hidden =
        !settings.enabled;
      publish();
    },
  );
  presetSelect.addEventListener('change', () => {
    const preset = (
      elevationGradientPresets as Partial<
        Record<string, { stops: ElevationGradientSettings['stops'] }>
      >
    )[presetSelect.value];

    if (!preset) {
      return;
    }

    settings = copyElevationGradient({ ...settings, stops: preset.stops });
    renderStops();
    publish();
  });
  transition.addEventListener('change', () => {
    settings = {
      ...settings,
      transition: transition.value as ElevationGradientSettings['transition'],
    };
    paintPreview();
    publish();
  });
  rows.addEventListener('input', (event) => {
    if (
      !(event.target instanceof HTMLInputElement) ||
      !event.target.hasAttribute('data-stop-color')
    ) {
      return;
    }

    const index = Number(event.target.dataset.stopColor);
    const color = event.target.value;

    settings = {
      ...settings,
      stops: settings.stops.map((stop, i) => (i === index ? { ...stop, color } : stop)),
    };
    markCustom();
    paintPreview();
    publish();
  });
  rows.addEventListener('change', (event) => {
    if (
      !(event.target instanceof HTMLInputElement) ||
      !event.target.hasAttribute('data-stop-position')
    ) {
      return;
    }

    const input = event.target;
    const index = Number(input.dataset.stopPosition);

    input.setCustomValidity('');

    if (!Number.isFinite(input.valueAsNumber)) {
      input.setCustomValidity('Enter a position between the neighboring stops.');
    }

    if (!input.checkValidity()) {
      input.reportValidity();

      return;
    }

    settings = {
      ...settings,
      stops: settings.stops.map((stop, i) =>
        i === index ? { ...stop, position: input.valueAsNumber / 100 } : stop,
      ),
    };
    markCustom();
    renderStops();
    publish();
  });
  rows.addEventListener('click', (event) => {
    if (
      !(event.target instanceof HTMLButtonElement) ||
      !event.target.hasAttribute('data-stop-remove')
    ) {
      return;
    }

    const index = Number(event.target.dataset.stopRemove);

    if (index === 0 || index === settings.stops.length - 1) {
      return;
    }

    settings = { ...settings, stops: settings.stops.filter((_, i) => i !== index) };
    markCustom();
    renderStops();
    publish();
  });
  add.addEventListener('click', () => {
    if (settings.stops.length >= maximumElevationColorStops) {
      return;
    }

    let index = 0;

    for (let i = 1; i < settings.stops.length - 1; i++) {
      if (
        settings.stops[i + 1].position - settings.stops[i].position >
        settings.stops[index + 1].position - settings.stops[index].position
      ) {
        index = i;
      }
    }

    const first = settings.stops[index];
    const second = settings.stops[index + 1];
    const position = Math.round((first.position + second.position) * 50) / 100;
    const color = mixElevationColors(
      first.color,
      second.color,
      (position - first.position) / (second.position - first.position),
    );

    settings = {
      ...settings,
      stops: [
        ...settings.stops.slice(0, index + 1),
        { position, color },
        ...settings.stops.slice(index + 1),
      ],
    };
    markCustom();
    renderStops();
    publish();
  });
  getRequiredElement(container, '[data-gradient-reverse]', HTMLButtonElement).addEventListener(
    'click',
    () => {
      settings = {
        ...settings,
        stops: [...settings.stops].reverse().map((stop) => ({
          color: stop.color,
          position: Math.round((1 - stop.position) * 100) / 100,
        })),
      };
      markCustom();
      renderStops();
      publish();
    },
  );

  renderStops();

  return { getSettings: () => copyElevationGradient(settings) };
}
