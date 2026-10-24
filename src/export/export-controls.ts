import { getRequiredElement } from '../dom-elements';
import {
  imageExportFormats,
  maximumOutputDimensionPixels,
  maximumExtraLargeOutputDimensionPixels,
  minimumOutputDimensionPixels,
  outputSettingKeys,
  pngResolutionScales,
} from '../constants/design';
import { imageMimeTypes, outputSizePresets } from '../constants/export';
import { operationErrorCodes } from '../constants/operations';
import { readDesignControlValue } from '../design-control-values';
import { clampOutputDimensionPixels } from '../design-settings';
import { logOperationError } from '../operation-logging';
import type { DesignSettings } from '../types/design';
import type { ExportActions, ExportState, OutputRenderer } from '../types/export';
import type { OperationError } from '../types/operations';
import { createExportFile, downloadExport, getRasterDimensions } from './image-export';

// === PUBLIC API ===
/** Coordinates export options, settled previews, and download feedback. */
export function mountExportControls(
  panel: HTMLElement,
  actions: ExportActions,
  renderer: OutputRenderer,
): () => void {
  const content = document.createElement('section');

  content.id = 'export-content';
  content.hidden = true;
  content.setAttribute('aria-label', 'Export options');
  content.innerHTML = `
    <div class="select-row"><label for="format">Format</label><select id="format">${imageExportFormats.map((format) => `<option value="${format}">${format.toUpperCase()}</option>`).join('')}</select></div>
    <div class="select-row"><label for="output-size">Size</label><select id="output-size">${outputSizePresets.map((preset) => `<option value="${preset.value}">${preset.label}</option>`).join('')}</select></div>
    <label class="toggle-row" for="allowExtraLargeExports">Allow extra-large exports<input id="allowExtraLargeExports" type="checkbox" aria-describedby="large-export-warning"></label>
    <p id="large-export-warning" class="export-hint">Up to 12,288 px per side. Large PNGs can use over 576 MiB of memory and may freeze or crash this tab, especially on mobile.</p>
    <div class="dimension-row"><label for="width">Width<input id="width" type="number" min="${minimumOutputDimensionPixels}" max="${maximumOutputDimensionPixels}" step="1" inputmode="numeric"></label><span aria-hidden="true">×</span><label for="height">Height<input id="height" type="number" min="${minimumOutputDimensionPixels}" max="${maximumOutputDimensionPixels}" step="1" inputmode="numeric"></label></div>
    <p id="dimension-hint" class="export-hint"></p>
    <div id="png-options" class="select-row"><label for="pngScale">Resolution</label><select id="pngScale">${pngResolutionScales.map((scale) => `<option value="${scale}">${scale}×</option>`).join('')}</select></div>
    <label class="toggle-row" for="transparent">Transparent background<input id="transparent" type="checkbox" role="switch"></label>
    <div class="output-preview"><img id="output-preview-image" alt="Settled landscape export preview"></div>
    <p id="output-dimensions" class="export-hint"></p><p id="export-error" role="status" hidden></p>
    <button type="button" id="download" class="primary-button">Download SVG</button>`;
  getRequiredElement(panel, '#shared-footer', HTMLElement).before(content);
  const exportToggleButton = getRequiredElement(panel, '#export-toggle', HTMLButtonElement);
  const settingsToggleButton = getRequiredElement(panel, '#settings-toggle', HTMLButtonElement);
  const settingsContent = getRequiredElement(panel, '#settings-content', HTMLElement);
  const downloadButton = getRequiredElement(content, '#download', HTMLButtonElement);
  const previewImage = getRequiredElement(content, '#output-preview-image', HTMLImageElement);
  const errorText = getRequiredElement(content, '#export-error', HTMLElement);
  let state: ExportState = { phase: 'idle' };
  let previewUrl: string | undefined;
  let previousSvg: string | undefined;
  let previewAnimationFrameIdentifier: number | undefined;

  /** Keeps export failure state and accessible feedback consistent. */
  const reportError = (error: OperationError, isDownloadError = false) => {
    if (state.phase !== 'generating' || isDownloadError) {
      state = { phase: 'failed', error };
    }

    logOperationError(error);
    errorText.hidden = false;
    errorText.textContent = error.message;
  };

  /** Synchronizes output controls and schedules a settled preview when visible. */
  function refreshExportControls() {
    const settings = actions.getSettings();
    const maximumDimensionPixels = settings.allowExtraLargeExports
      ? maximumExtraLargeOutputDimensionPixels
      : maximumOutputDimensionPixels;

    for (const key of ['width', 'height'] as const) {
      getRequiredElement(content, `#${key}`, HTMLInputElement).max = String(maximumDimensionPixels);
    }

    getRequiredElement(content, '#dimension-hint', HTMLElement).textContent =
      `${minimumOutputDimensionPixels}–${maximumDimensionPixels} px per side · anchored at the top left`;

    for (const key of outputSettingKeys) {
      const input = getRequiredElement(content, `#${key}`, HTMLElement);

      if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) {
        throw new Error(`Output control "${key}" must be an input or select element.`);
      }

      if (input.hasAttribute('aria-invalid')) {
        continue;
      }

      if (input instanceof HTMLInputElement && input.type === 'checkbox') {
        input.checked = Boolean(settings[key]);
      } else {
        input.value = String(settings[key]);
      }
    }

    getRequiredElement(content, '#png-options', HTMLElement).hidden = settings.format !== 'png';
    const raster = getRasterDimensions(settings);
    const isInvalid = settings.format === 'png' && !raster.ok;

    downloadButton.disabled =
      state.phase === 'generating' || isInvalid || content.querySelector('[aria-invalid]') !== null;
    downloadButton.textContent =
      state.phase === 'generating' ? 'Generating…' : `Download ${settings.format.toUpperCase()}`;
    errorText.hidden = !isInvalid && state.phase !== 'failed';

    if (!raster.ok && isInvalid) {
      errorText.textContent = raster.error.message;
    }

    const scale = settings.format === 'png' ? settings.pngScale : 1;

    getRequiredElement(content, '#output-dimensions', HTMLElement).textContent =
      `${settings.width * scale} × ${settings.height * scale} px · cursor hill excluded`;

    if (content.hidden || previewAnimationFrameIdentifier !== undefined) {
      return;
    }

    previewAnimationFrameIdentifier = requestAnimationFrame(() => {
      previewAnimationFrameIdentifier = undefined;

      try {
        const svg = renderer.getSvg(actions.getSettings());

        if (svg === previousSvg) {
          return;
        }

        const nextUrl = URL.createObjectURL(new Blob([svg], { type: imageMimeTypes.svg }));

        if (previewUrl !== undefined) {
          URL.revokeObjectURL(previewUrl);
        }

        previousSvg = svg;
        previewUrl = nextUrl;
        previewImage.src = nextUrl;
      } catch {
        previousSvg = undefined;
        reportError({
          code: operationErrorCodes.exportFailed,
          message: 'Could not generate the preview. Reduce the output dimensions and try again.',
          retryable: true,
        });
      }
    });
  }

  /** Shows one stage at a time while preserving edits and export state. */
  function setExportMode(isExportMode: boolean) {
    content.hidden = !isExportMode;
    settingsContent.hidden = isExportMode;
    exportToggleButton.setAttribute('aria-pressed', String(isExportMode));
    settingsToggleButton.setAttribute('aria-pressed', String(!isExportMode));
    getRequiredElement(panel, '#panel-body', HTMLElement).scrollTop = 0;
    refreshExportControls();
  }

  exportToggleButton.addEventListener('click', () => {
    setExportMode(true);
  });
  settingsToggleButton.addEventListener('click', () => {
    setExportMode(false);
  });
  panel.addEventListener(
    'keydown',
    (event) => {
      /** Returns to design settings before a subsequent Escape collapses controls. */
      if (event.key !== 'Escape' || content.hidden) {
        return;
      }

      event.preventDefault();
      setExportMode(false);
      exportToggleButton.focus();
    },
    { capture: true },
  );
  content.addEventListener('change', (event) => {
    /** Keeps invalid edits visible until the user supplies supported dimensions. */
    const input = event.target;

    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) {
      return;
    }

    const settings = actions.getSettings();
    let nextDesignSettings = { ...settings };

    if (input.id === 'output-size') {
      const [width, height] =
        input.value === 'viewport'
          ? [window.innerWidth, window.innerHeight].map((value) =>
              clampOutputDimensionPixels(value),
            )
          : input.value.split('x').map(Number);

      if (input.value === 'custom') {
        return;
      }

      nextDesignSettings = { ...nextDesignSettings, width, height };
    } else if (input.id in nextDesignSettings) {
      const key = input.id as keyof DesignSettings;
      const value = readDesignControlValue(input, nextDesignSettings[key]);

      nextDesignSettings = { ...nextDesignSettings, [key]: value };
    } else {
      return;
    }

    if (input.id === 'allowExtraLargeExports' && !nextDesignSettings.allowExtraLargeExports) {
      nextDesignSettings.width = Math.min(nextDesignSettings.width, maximumOutputDimensionPixels);
      nextDesignSettings.height = Math.min(nextDesignSettings.height, maximumOutputDimensionPixels);
    }

    if (!actions.updateSettings(nextDesignSettings)) {
      input.setAttribute('aria-invalid', 'true');
      downloadButton.disabled = true;

      return;
    }

    input.removeAttribute('aria-invalid');

    if (input.id === 'width' || input.id === 'height') {
      getRequiredElement(content, '#output-size', HTMLSelectElement).value = 'custom';
    }

    if (input.id === 'output-size' && input.value === 'viewport') {
      input.value = 'custom';
    }

    if (state.phase !== 'generating') {
      state = { phase: 'idle' };
    }

    refreshExportControls();
  });
  downloadButton.addEventListener('click', () => {
    void downloadCurrentDesign().catch((error: unknown) => {
      const operationError = {
        code: operationErrorCodes.exportFailed,
        message:
          error instanceof Error
            ? error.message
            : 'The requested operation failed. Please try again.',
        retryable: true,
      };

      reportError(operationError, true);
      refreshExportControls();
    });
  });
  previewImage.addEventListener('error', () => {
    previousSvg = undefined;
    reportError({
      code: operationErrorCodes.exportFailed,
      message: 'The preview could not be displayed. Try reopening Export or choose a smaller size.',
      retryable: true,
    });
  });
  window.addEventListener('pagehide', () => {
    /** Releases preview resources when the document leaves the active page. */
    if (previewUrl !== undefined) {
      URL.revokeObjectURL(previewUrl);
    }

    previewUrl = previousSvg = undefined;

    if (previewAnimationFrameIdentifier !== undefined) {
      cancelAnimationFrame(previewAnimationFrameIdentifier);
    }

    previewAnimationFrameIdentifier = undefined;
  });
  window.addEventListener('pageshow', refreshExportControls);
  refreshExportControls();

  return refreshExportControls;

  /** Captures output state and reports download results. */
  async function downloadCurrentDesign(): Promise<void> {
    /** Captures committed settings before yielding to paint the busy state. */
    if (state.phase === 'generating') {
      return;
    }

    const exportSettingsSnapshot = actions.getSettings();

    state = { phase: 'generating' };
    refreshExportControls();
    // Yield so the busy state paints before contour generation.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          resolve();
        }),
      ),
    );
    const result = await createExportFile(exportSettingsSnapshot, renderer);
    const downloaded = result.ok ? downloadExport(result.data) : result;

    if (!downloaded.ok) {
      reportError(downloaded.error, true);
    } else {
      state = { phase: 'idle' };
      actions.notify('Download started.');
    }

    refreshExportControls();
  }
}
