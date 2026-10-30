import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseDesignParameters, validateDesignSettings } from '../design-settings';
import { ExportSheet } from '../ui/export-sheet';
import { createStudioController, type StudioEffects, type StudioState } from './controller';
import {
  buildExportSheetModel,
  type ExportPanelHandlers,
  type ExportPanelUiState,
} from './export-sheet-model';

const noop = (): void => undefined;
const handlers: ExportPanelHandlers = {
  changeFormat: noop,
  changeSizeChoice: noop,
  changeWidth: () => true,
  changeHeight: () => true,
  changeResolution: noop,
  setTransparent: noop,
  setExtraLargeAllowed: noop,
  failPreview: noop,
  download: noop,
  changeStillScale: noop,
  downloadStill: noop,
  downloadStl: noop,
  downloadPart: noop,
  setPartSelected: noop,
  downloadSelectedParts: noop,
  downloadAttribution: noop,
  openDossier: noop,
};
const idleUi: ExportPanelUiState = {
  previewUrl: 'blob:preview',
  error: '',
  isBusy: false,
  sizeChoice: 'custom',
  stillScale: 2,
  isStillBusy: false,
  selectedPartIds: new Set(),
};

async function createState(
  query: string,
  options: { is3d: boolean; frame?: boolean },
): Promise<StudioState> {
  const initial = parseDesignParameters(new URLSearchParams(query));

  assert.ok(initial.ok);
  let design = initial.data.settings;
  const effects: StudioEffects = {
    applyTerrain: noop,
    activate: () => Promise.resolve(),
    sceneChanged: noop,
    modelChanged: noop,
    resetCamera: noop,
    setCameraDirection: () => undefined,
    walkAt: () => false,
    applyViewPreset: noop,
    pickFocus: () => Promise.resolve(false),
    captureCameraShot: () => 'not-3d',
    flyToCameraShot: () => undefined,
    playCameraShots: () => undefined,
    stopCameraShots: () => undefined,
    downloadStill: () => Promise.resolve({ width: 1, height: 1 }),
    downloadStl: noop,
    roadsChanged: noop,
    frameChanged: noop,
    downloadFrameStl: noop,
  };
  const controller = createStudioController({
    getSettings: () => design,
    updateSettings: (candidate) => {
      const result = validateDesignSettings(candidate);

      if (result.ok) {
        design = result.data;
      }

      return result.ok;
    },
    newLandscape: noop,
    isSeedLocked: false,
    lockSeed: noop,
    getShareUrl: () => 'https://landcube.test/',
    copyLink: () => Promise.resolve({ ok: true, data: undefined }),
  });

  controller.connect(effects);

  if (options.is3d) {
    await controller.selectView('3d');
    controller.metrics(24);
  }

  if (options.frame === true) {
    controller.frame({ preset: 'tray' });
  }

  return controller.getSnapshot();
}

function renderBindings(state: StudioState): string {
  const model = buildExportSheetModel({ state, ui: idleUi, handlers });

  return renderToStaticMarkup(createElement(ExportSheet, { model }));
}

void test('2D SVG state maps to the binding labels and an SVG download', async () => {
  const state = await createState('v=1&seed=123&width=480&height=320', { is3d: false });
  const model = buildExportSheetModel({ state, ui: idleUi, handlers });
  const markup = renderBindings(state);

  assert.equal(model.primaryAction.label, 'Download SVG');
  assert.equal(model.target, 'Seed 123 · Generated');
  assert.equal(model.fields.resolution, undefined);
  assert.equal(model.still, undefined);
  assert.equal(model.model, undefined);

  for (const label of ['Format', 'Size', 'Width', 'Height', 'Transparent background']) {
    assert.ok(markup.includes(`>${label}</`), label);
  }

  assert.ok(markup.includes('Allow extra-large exports'));
  assert.ok(markup.includes('alt="Settled landscape export preview"'));
});

void test('PNG state adds Resolution and the PNG download name', async () => {
  const state = await createState('v=1&seed=123&width=480&height=320&format=png', {
    is3d: false,
  });
  const model = buildExportSheetModel({ state, ui: idleUi, handlers });

  assert.equal(model.primaryAction.label, 'Download PNG');
  assert.deepEqual(model.fields.resolution?.options, ['1', '2']);
  assert.ok(renderBindings(state).includes('>Resolution</'));
});

void test('a PNG over the pixel limit disables the download and raises a fault', async () => {
  const state = await createState('v=1&seed=123&width=4096&height=240&format=png&pngScale=2', {
    is3d: false,
  });
  const model = buildExportSheetModel({ state, ui: idleUi, handlers });

  assert.equal(model.primaryAction.isDisabled, true);
  assert.match(model.faults[0].message, /at most 4096 px per side/);
});

void test('busy state relabels and disables the primary action', async () => {
  const state = await createState('v=1&seed=123', { is3d: false });
  const model = buildExportSheetModel({ state, ui: { ...idleUi, isBusy: true }, handlers });

  assert.equal(model.primaryAction.label, 'Generating…');
  assert.equal(model.primaryAction.isDisabled, true);
});

void test('3D state offers STL, still and soon-only 3MF and GLB', async () => {
  const state = await createState('v=1&seed=123', { is3d: true });
  const model = buildExportSheetModel({ state, ui: idleUi, handlers });
  const markup = renderBindings(state);

  assert.deepEqual(
    model.model?.formats.map(({ id, isSoon }) => [id, isSoon]),
    [
      ['stl', false],
      ['3mf', true],
      ['glb', true],
    ],
  );

  for (const name of ['Download STL', 'Download 3D still']) {
    assert.ok(markup.includes(`>${name}</span>`), name);
  }
});

void test('frame parts become checkbox rows with a size and their own download', async () => {
  const state = await createState('v=1&seed=123', { is3d: true, frame: true });
  const model = buildExportSheetModel({ state, ui: idleUi, handlers });
  const part = model.model?.parts?.[0];

  assert.ok(part);
  assert.equal(part.download.label, `Download ${part.id} STL`);
  assert.match(part.detail ?? '', /KB|MB/);
  assert.ok(renderBindings(state).includes(`>Download ${part.id} STL</span>`));
});

void test('the all-parts action needs a selection and is idle while jobs run', async () => {
  const state = await createState('v=1&seed=123', { is3d: true, frame: true });
  const partIds =
    state.frame.assembly?.ok === true ? state.frame.assembly.data.parts.map(({ id }) => id) : [];
  const selectedUi = { ...idleUi, selectedPartIds: new Set(partIds) };
  const selected = buildExportSheetModel({ state, ui: selectedUi, handlers });
  const none = buildExportSheetModel({ state, ui: idleUi, handlers });
  const running = buildExportSheetModel({
    state: {
      ...state,
      exportJobs: [{ id: 'frame', label: 'frame STL', status: 'meshing', fraction: 0 }],
    },
    ui: selectedUi,
    handlers,
  });

  assert.equal(selected.model?.partsAction?.isDisabled, false);
  assert.equal(none.model?.partsAction?.isDisabled, true);
  assert.equal(running.model?.partsAction?.isDisabled, true);
  assert.equal(running.jobs?.length, 1);
});

void test('without a frame there are no parts and no notice', async () => {
  const state = await createState('v=1&seed=123', { is3d: true });
  const model = buildExportSheetModel({ state, ui: idleUi, handlers });

  assert.deepEqual(model.model?.parts, []);
  assert.equal(model.model.notice, undefined);
  assert.equal(model.attribution, undefined);
});
