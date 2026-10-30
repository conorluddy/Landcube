import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PNG } from 'pngjs';
import { engineConfiguration } from '../constants/engine';
import { versionOneDesignDefaults } from '../constants/design';
import { validateDesignSettings } from '../design-settings';
import type { DesignSettings } from '../types/design';
import { createOutputRenderer } from './image-export';
import { createNodeExportFile } from './node-image-export';

/** Creates a small valid design for Node rasterization checks. */
function design(changes: Partial<DesignSettings> = {}) {
  const result = validateDesignSettings({
    ...versionOneDesignDefaults,
    width: 320,
    height: 240,
    seed: 745,
    ...changes,
  });

  assert.ok(result.ok);

  return result.data;
}

void test('Node exports SVG and scaled PNG without browser globals', () => {
  const renderer = createOutputRenderer(engineConfiguration);
  const svg = createNodeExportFile(design(), renderer);
  const png = createNodeExportFile(design({ format: 'png', pngScale: 2 }), renderer);

  assert.ok(svg.ok);
  assert.equal(svg.data.mimeType, 'image/svg+xml');
  assert.equal(svg.data.filename, 'landcube-745-320x240.svg');
  assert.match(new TextDecoder().decode(svg.data.bytes), /viewBox="0 0 320 240"/);
  assert.ok(png.ok);
  assert.equal(png.data.mimeType, 'image/png');
  assert.equal(png.data.filename, 'landcube-745-640x480.png');

  const decoded = PNG.sync.read(Buffer.from(png.data.bytes));

  assert.equal(decoded.width, 640);
  assert.equal(decoded.height, 480);
  assert.equal(decoded.data[3], 255);
});

void test('transparent Node PNG retains an alpha channel', () => {
  const result = createNodeExportFile(
    design({ format: 'png', transparent: true }),
    createOutputRenderer(engineConfiguration),
  );

  assert.ok(result.ok);
  assert.equal(PNG.sync.read(Buffer.from(result.data.bytes)).data[3], 0);
});
