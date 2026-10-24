import { designNumberConstraints, indexContourStyles, versionOneDesignDefaults } from './constants/design';
import { readDesignControlValue } from './design-control-values';
import { resetDesignStyle } from './design-settings';
import { logOperationError } from './operation-logging';
import type { DesignSettings, ValidatedDesignSettings } from './types/design';
import type { Result } from './types/operations';

export interface DesignControlActions {
  getSettings: () => ValidatedDesignSettings;
  updateSettings: (settings: DesignSettings) => boolean;
  newLandscape: () => void;
  isSeedLocked: boolean;
  lockSeed: (isLocked: boolean) => void;
  getShareUrl: () => string;
  copyLink: (url: string) => Promise<Result<void>>;
}

export interface DesignControlPanel {
  panel: HTMLElement;
  sync: () => void;
  notify: (message: string) => void;
}








const designPalettePresets = {
  Charcoal: {
    background: versionOneDesignDefaults.background,
    lineColor: versionOneDesignDefaults.lineColor,
    strokeOpacity: versionOneDesignDefaults.strokeOpacity,
    strokeWidth: versionOneDesignDefaults.strokeWidth,
    indexStrokeWidth: versionOneDesignDefaults.indexStrokeWidth,
  },
  Paper: { background: '#eee9dd', lineColor: '#716c5e', strokeOpacity: 0.45, strokeWidth: 0.8, indexStrokeWidth: 1.2 },
  Blueprint: { background: '#153c68', lineColor: '#b9dbf5', strokeOpacity: 0.55, strokeWidth: 0.8, indexStrokeWidth: 1.3 },
  Bold: { background: '#151816', lineColor: '#c2dc8a', strokeOpacity: 0.8, strokeWidth: 1.5, indexStrokeWidth: 2.4 },
};

// === PUBLIC API ===
/** Mounts style controls and binds them to validated application actions. */
export function mountDesignControls(actions: DesignControlActions): DesignControlPanel {
  const panel = document.createElement('section');
  panel.className = 'control-panel';
  panel.setAttribute('aria-label', 'Landscape controls');
  /** Uses the same numeric bounds as design validation. */
  const createRangeControlMarkup = (key: keyof typeof designNumberConstraints, label: string, suffix = '') => {
    const [min, max, step] = designNumberConstraints[key];
    return `<label class="range-control" for="${key}"><span>${label}</span><output for="${key}" data-suffix="${suffix}"></output><input id="${key}" type="range" min="${min}" max="${max}" step="${step}"></label>`;
  };
  panel.innerHTML = `
    <header class="panel-header">
      <div class="brand"><span class="brand-mark" aria-hidden="true">≋</span><h1>Topogra<span>Landscape studio</span></h1></div>
      <button type="button" id="collapse" class="icon-button" aria-expanded="true" aria-controls="panel-body" aria-label="Collapse controls"><span aria-hidden="true">−</span></button>
    </header>
    <div id="panel-body">
      <div class="panel-content">
        <fieldset class="preset-group"><legend>Palette</legend><div class="presets">${Object.entries(designPalettePresets).map(([name, preset]) => `<button type="button" data-preset="${name}" aria-pressed="false"><span class="preset-swatch" style="--swatch-bg:${preset.background};--swatch-ink:${preset.lineColor}" aria-hidden="true"></span>${name}</button>`).join('')}</div></fieldset>
        <div class="colour-row"><label for="background">Canvas<input type="color" id="background"></label><label for="lineColor">Contours<input type="color" id="lineColor"></label></div>
        <div class="control-grid">
          ${createRangeControlMarkup('strokeOpacity', 'Opacity')}
          ${createRangeControlMarkup('strokeWidth', 'Weight', ' px')}
          ${createRangeControlMarkup('contourCount', 'Density')}
          ${createRangeControlMarkup('featureScale', 'Scale', ' px')}
        </div>
        ${createRangeControlMarkup('detail', 'Terrain detail')}
        <details><summary>Index contours<span aria-hidden="true">+</span></summary><div class="detail-content">
          <div class="select-row"><label for="indexStyle">Style</label><select id="indexStyle">${indexContourStyles.map(style => `<option value="${style}">${style[0].toUpperCase()}${style.slice(1)}</option>`).join('')}</select></div>
          ${createRangeControlMarkup('indexEvery', 'Every N levels')}
          ${createRangeControlMarkup('indexStrokeWidth', 'Weight', ' px')}
          <div class="control-grid">${createRangeControlMarkup('dashLength', 'Dash', ' px')}${createRangeControlMarkup('dashGap', 'Gap', ' px')}</div>
        </div></details>
        <details><summary>Cursor interaction<span aria-hidden="true">+</span></summary><div class="detail-content">
          <label class="toggle-row" for="cursorEnabled">Enable interaction<input type="checkbox" id="cursorEnabled" role="switch"></label>
          ${createRangeControlMarkup('cursorRadius', 'Radius', ' px')}
          ${createRangeControlMarkup('cursorHeight', 'Strength')}
          ${createRangeControlMarkup('cursorResponseMs', 'Response time', ' ms')}
        </div></details>
      </div>
      <footer>
        <div class="share-actions"><button type="button" id="export-toggle" class="text-button" aria-expanded="false" aria-controls="export-content">Export ↗</button><button type="button" id="copy-link" class="text-button">Copy link</button></div>
        <p id="panel-status" role="status" aria-live="polite" hidden></p><label id="manual-link-label" hidden>Copy this link<input id="manual-link" type="text" readonly></label>
        <div class="seed-row"><span>Seed <output id="seed-value">${actions.getSettings().seed}</output></span><label class="lock-label" for="seed-lock"><input type="checkbox" id="seed-lock">Lock</label></div>
        <div class="actions"><button type="button" id="reset" class="text-button">Reset style</button><button type="button" id="new-landscape" class="primary-button"><span aria-hidden="true">↻</span> New landscape</button></div>
      </footer>
    </div>`;
  document.body.append(panel);
  /** Resolves a required input within the mounted controls. */
  const getPanelInput = (id: string) => panel.querySelector<HTMLInputElement>(`#${id}`)!;
  /** Announces feedback through the panel’s accessible status region. */
  const notify = (message: string) => {
    const status = panel.querySelector<HTMLElement>('#panel-status')!;
    status.hidden = false;
    status.textContent = message;
  };
  /** Reflects committed settings without triggering another edit. */
  function sync() {
    const settings = actions.getSettings();
    for (const element of panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.panel-content input, .panel-content select')) {
      const key = element.id as keyof DesignSettings;
      if (!(key in settings) || element.closest('#export-content')) continue;
      const value = settings[key];
      if (element instanceof HTMLInputElement && element.type === 'checkbox') element.checked = Boolean(value);
      else element.value = String(value);
      const output = panel.querySelector<HTMLOutputElement>(`output[for="${key}"]`);
      if (output) output.value = key === 'strokeOpacity' || key === 'detail' ? `${Math.round(Number(value) * 100)}%` : `${Number(Number(value).toFixed(2))}${output.dataset.suffix ?? ''}`;
    }
    panel.querySelector<HTMLOutputElement>('#seed-value')!.value = String(settings.seed);
    for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-preset]')) {
      const preset = designPalettePresets[button.dataset.preset as keyof typeof designPalettePresets];
      const isMatchingPreset = Object.entries(preset).every(([key, value]) => settings[key as keyof DesignSettings] === value);
      button.setAttribute('aria-pressed', String(isMatchingPreset));
    }
  }
  panel.querySelector('.panel-content')!.addEventListener('input', event => {
    /** Commits typed control values through the application’s validation boundary. */
    const element = event.target;
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement) || element.closest('#export-content')) return;
    const key = element.id as keyof DesignSettings;
    if (!(key in actions.getSettings())) return;
    const value = readDesignControlValue(element, actions.getSettings()[key]);
    actions.updateSettings({ ...actions.getSettings(), [key]: value });
    sync();
  });
  for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-preset]')) button.addEventListener('click', () => {
    actions.updateSettings({ ...actions.getSettings(), ...designPalettePresets[button.dataset.preset as keyof typeof designPalettePresets] });
    sync();
  });
  const collapseButton = panel.querySelector<HTMLButtonElement>('#collapse')!;
  collapseButton.addEventListener('click', () => {
    /** Synchronizes collapse state and its accessible labels. */
    const isExpanded = collapseButton.getAttribute('aria-expanded') !== 'true';
    collapseButton.setAttribute('aria-expanded', String(isExpanded));
    collapseButton.setAttribute('aria-label', isExpanded ? 'Collapse controls' : 'Expand controls');
    collapseButton.firstElementChild!.textContent = isExpanded ? '−' : '+';
    panel.querySelector<HTMLElement>('#panel-body')!.hidden = !isExpanded;
  });
  panel.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (collapseButton.getAttribute('aria-expanded') === 'true') { collapseButton.click(); collapseButton.focus(); }
  });
  panel.querySelector('#reset')!.addEventListener('click', () => {
    actions.updateSettings(resetDesignStyle(actions.getSettings()));
    sync();
  });
  const regenerateLandscapeButton = panel.querySelector<HTMLButtonElement>('#new-landscape')!;
  getPanelInput('seed-lock').checked = actions.isSeedLocked;
  regenerateLandscapeButton.disabled = actions.isSeedLocked;
  getPanelInput('seed-lock').addEventListener('change', () => {
    regenerateLandscapeButton.disabled = getPanelInput('seed-lock').checked;
    actions.lockSeed(getPanelInput('seed-lock').checked);
  });
  regenerateLandscapeButton.addEventListener('click', () => { actions.newLandscape(); sync(); });
  panel.querySelector('#copy-link')!.addEventListener('click', async () => {
    /** Falls back to a selectable link when clipboard access fails. */
    const url = actions.getShareUrl();
    const result = await actions.copyLink(url);
    if (result.ok) {
      panel.querySelector<HTMLElement>('#manual-link-label')!.hidden = true;
      notify('Link copied. Open it to restore this design.');
      return;
    }
    logOperationError(result.error);
    panel.querySelector<HTMLElement>('#manual-link-label')!.hidden = false;
    getPanelInput('manual-link').value = url;
    getPanelInput('manual-link').focus();
    getPanelInput('manual-link').select();
    notify(result.error.message);
  });
  sync();
  return { panel, sync, notify };
}
