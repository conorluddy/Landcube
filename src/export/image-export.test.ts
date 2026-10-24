import { versionOneDesignDefaults } from '../constants/design';
import { engineConfiguration } from '../constants/engine';
import { parseDesignParameters, validateDesignSettings } from '../design-settings';
import { generateLandscapeContours } from '../landscape-composition';
import { createSvgDocument } from '../svg-rendering';
import type { DesignSettings } from '../types/design';
import { createExportFile, createOutputRenderer, getRasterDimensions } from './image-export';
import assert from 'node:assert/strict';
import { test } from 'node:test';

/** Builds a validated export fixture with optional scenario overrides. */
function design(changes: Partial<DesignSettings> = {}) {
  const result = validateDesignSettings({ ...versionOneDesignDefaults, width: 320, height: 240, seed: 745, ...changes });
  assert.ok(result.ok);
  return result.data;
}
/** Extracts path data so tests can compare geometry independently of styling. */
const geometry = (svg: string) => [...svg.matchAll(/ d="([^"]*)"/g)].map(match => match[1]);

test('a standalone SVG has explicit colours, clipping, dimensions, and no interface or cursor state', async () => {
  /** Verifies a standalone SVG has explicit colours, clipping, dimensions, and no interface or cursor state. */
  const settings = design();
  const result = await createExportFile(settings, createOutputRenderer(engineConfiguration));
  assert.ok(result.ok);
  assert.equal(result.data.blob.type, 'image/svg+xml');
  assert.equal(result.data.filename, 'topogra-745-320x240.svg');
  const svg = await result.data.blob.text();
  assert.match(svg, /xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg, /viewBox="0 0 320 240"/);
  assert.match(svg, /clip-path="url\(#landscape-crop\)"/);
  assert.match(svg, /fill="#202326"/);
  assert.match(svg, /stroke="#a4adb0"/);
  assert.doesNotMatch(svg, /currentColor|<style|control-panel|cursor|<script/);
  assert.ok(geometry(svg).some(path => path.length > 0));
});

test('transparent export removes only the background while preserving the settled geometry', () => {
  /** Verifies transparent export removes only the background while preserving the settled geometry. */
  const renderer = createOutputRenderer(engineConfiguration);
  const opaque = renderer.getSvg(design());
  const transparent = renderer.getSvg(design({ transparent: true }));
  assert.doesNotMatch(transparent, /fill="#202326"/);
  assert.deepEqual(geometry(opaque), geometry(transparent));
});

test('appearance and cursor changes preserve exported geometry, while terrain changes alter it', () => {
  /** Verifies appearance and cursor changes preserve exported geometry, while terrain changes alter it. */
  const renderer = createOutputRenderer(engineConfiguration);
  const original = renderer.getSvg(design());
  for (const changes of [{ lineColor: '#ff0000', strokeWidth: 2 }, { cursorHeight: -0.4, cursorRadius: 300 }, { format: 'png' as const, pngScale: 2 as const }]) {
    const svg = renderer.getSvg(design(changes));
    assert.deepEqual(geometry(svg), geometry(original));
  }
  assert.notDeepEqual(geometry(renderer.getSvg(design({ seed: 746 }))), geometry(original));
  assert.notDeepEqual(geometry(renderer.getSvg(design({ detail: 0.8 }))), geometry(original));
  assert.notDeepEqual(geometry(renderer.getSvg(design({ contourCount: 11 }))), geometry(original));
  assert.match(renderer.getSvg(design({ width: 640, height: 480 })), /viewBox="0 0 640 480"/);
  assert.equal(renderer.getSvg(design()), original);
});

test('index off, solid and dashed modes preserve their settings and render their own styles', () => {
  /** Verifies index off, solid and dashed modes preserve their settings and render their own styles. */
  const renderer = createOutputRenderer(engineConfiguration);
  assert.match(renderer.getSvg(design({ indexEvery: 1, dashLength: 13, dashGap: 8, indexStrokeWidth: 2 })), /stroke-width="2"[^>]*stroke-dasharray="13 8"/);
  assert.doesNotMatch(renderer.getSvg(design({ indexStyle: 'solid' })), /stroke-dasharray/);
  assert.doesNotMatch(renderer.getSvg(design({ indexStyle: 'off' })), /stroke-dasharray/);
  assert.match(renderer.getSvg(design({ indexStyle: 'off' })), /stroke-width="0.85"[^>]* d=""/);
});

test('preview and download are identical after saving and restoring a complete design', async () => {
  /** Verifies preview and download are identical after saving and restoring a complete design. */
  const settings = design({ width: 390, height: 844, transparent: true, indexStyle: 'solid' });
  const renderer = createOutputRenderer(engineConfiguration);
  const preview = renderer.getSvg(settings);
  const parsed = parseDesignParameters(new URLSearchParams(Object.entries(settings).map(([key, value]) => [key, String(value)])));
  assert.ok(parsed.ok);
  const downloaded = await createExportFile(parsed.data.settings, createOutputRenderer(engineConfiguration));
  assert.ok(downloaded.ok);
  assert.equal(await downloaded.data.blob.text(), preview);
  assert.equal(preview, createSvgDocument(generateLandscapeContours(settings, engineConfiguration), settings));
});

test('PNG limits apply to final raster dimensions while SVG ignores PNG scale', async () => {
  /** Verifies PNG limits apply to final raster dimensions while SVG ignores PNG scale. */
  assert.deepEqual(getRasterDimensions(design({ width: 2048, height: 1024, pngScale: 2 })), { ok: true, data: { width: 4096, height: 2048 } });
  const oversized = design({ width: 4096, height: 100, pngScale: 2, format: 'png' });
  assert.equal(getRasterDimensions(oversized).ok, false);
  const rejected = await createExportFile(oversized, createOutputRenderer(engineConfiguration));
  assert.ok(!rejected.ok);
  assert.equal(rejected.error.code, 'INVALID_SETTINGS');
  const svg = await createExportFile(design({ pngScale: 2 }), createOutputRenderer(engineConfiguration));
  assert.ok(svg.ok);
  assert.equal(svg.data.filename, 'topogra-745-320x240.svg');
});

test('generation failures return a recoverable export error', async () => {
  /** Verifies generation failures return a recoverable export error. */
  const result = await createExportFile(design(), { getSvg: () => { throw new Error('Unavailable'); } });
  assert.ok(!result.ok);
  assert.equal(result.error.code, 'EXPORT_FAILED');
  assert.equal(result.error.retryable, true);
});

test('PNG encoding uses the selected raster resolution and releases image/canvas resources on success and failure', async context => {
  /** Verifies PNG encoding uses the selected raster resolution and releases image/canvas resources on success and failure. */
  const imageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const revoked: string[] = [];
  let nextUrl = 0;
  context.mock.method(URL, 'createObjectURL', () => `blob:test-${++nextUrl}`);
  context.mock.method(URL, 'revokeObjectURL', (url: string) => { revoked.push(url); });
  let failure: 'none' | 'decode' | 'context' | 'encode' = 'none';
  const drawnSizes: number[][] = [];
  const canvas = {
    width: 0, height: 0,
    getContext: () => failure === 'context' ? null : { drawImage: (_image: unknown, _x: number, _y: number, width: number, height: number) => { drawnSizes.push([width, height]); } },
    toBlob: (callback: BlobCallback, type: string) => callback(failure === 'encode' ? null : new Blob(['encoded'], { type })),
  };
  class LoadingImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(value: string) {
      if (value) queueMicrotask(() => failure === 'decode' ? this.onerror?.() : this.onload?.());
    }
  }
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: LoadingImage });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => canvas } });
  context.after(() => {
    if (imageDescriptor) Object.defineProperty(globalThis, 'Image', imageDescriptor);
    else Reflect.deleteProperty(globalThis, 'Image');
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  const renderer = createOutputRenderer(engineConfiguration);
  const settings = design({ format: 'png', pngScale: 2 });
  const success = await createExportFile(settings, renderer);
  assert.ok(success.ok);
  assert.equal(success.data.blob.type, 'image/png');
  assert.equal(success.data.filename, 'topogra-745-640x480.png');
  assert.deepEqual(drawnSizes, [[640, 480]]);
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
  for (const mode of ['decode', 'context', 'encode'] as const) {
    failure = mode;
    const result = await createExportFile(settings, renderer);
    assert.ok(!result.ok);
    assert.equal(result.error.code, 'EXPORT_FAILED');
    assert.equal(canvas.width, 0);
    assert.equal(canvas.height, 0);
  }
  assert.equal(revoked.length, 4);
});

test('downloads clean up their anchor and temporary URL, including when the browser rejects the click', async context => {
  /** Verifies downloads clean up their anchor and temporary URL, including when the browser rejects the click. */
  const { downloadExport } = await import('./image-export');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const revoked: string[] = [];
  let wasRemoved = false;
  let shouldFail = false;
  const anchor = { href: '', download: '', click: () => { if (shouldFail) throw new Error('Rejected'); }, remove: () => { wasRemoved = true; } };
  context.mock.method(URL, 'createObjectURL', () => 'blob:download');
  context.mock.method(URL, 'revokeObjectURL', (url: string) => { revoked.push(url); });
  context.mock.timers.enable({ apis: ['setTimeout'] });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => anchor, body: { append: () => undefined } } });
  context.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  const file = { blob: new Blob(['svg']), filename: 'landscape.svg' };
  assert.ok(downloadExport(file).ok);
  assert.equal(anchor.download, 'landscape.svg');
  assert.equal(wasRemoved, true);
  assert.equal(revoked.length, 0);
  context.mock.timers.runAll();
  assert.deepEqual(revoked, ['blob:download']);
  shouldFail = true;
  wasRemoved = false;
  const rejected = downloadExport(file);
  assert.ok(!rejected.ok);
  assert.equal(rejected.error.code, 'EXPORT_FAILED');
  assert.equal(wasRemoved, true);
  assert.equal(revoked.length, 2);
});
