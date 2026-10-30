import assert from 'node:assert/strict';
import test from 'node:test';
import { savedDesignThumbnailMaxBytes } from '../../constants/library';
import { engineConfiguration } from '../../constants/engine';
import { parseDesignParameters } from '../../design-settings';
import { createOutputRenderer } from '../../export/image-export';
import { createDesignThumbnailSvg, thinPathPoints } from './library-thumbnail';

void test('thinning keeps subpath starts and the last point of each path', () => {
  const svg = '<path d="M0,0L1,1L2,2L3,3L4,4L5,5Z"/><path d="M9,9L8,8"/>';

  assert.equal(thinPathPoints(svg, 1), svg);
  assert.equal(thinPathPoints(svg, 4), '<path d="M0,0L4,4L5,5Z"/><path d="M9,9L8,8"/>');
});

void test('a thumbnail of the default design fits the storage budget and is an SVG', () => {
  const parsed = parseDesignParameters(new URLSearchParams('v=1&seed=123'));

  assert.ok(parsed.ok);

  const svg = createDesignThumbnailSvg(
    parsed.data.settings,
    createOutputRenderer(engineConfiguration),
  );

  assert.ok(svg !== null);
  assert.match(svg, /^<svg\b/);
  assert.ok(new TextEncoder().encode(svg).length <= savedDesignThumbnailMaxBytes);
});

void test('the same design always produces the same thumbnail', () => {
  const parsed = parseDesignParameters(new URLSearchParams('v=1&seed=77'));

  assert.ok(parsed.ok);

  const first = createDesignThumbnailSvg(
    parsed.data.settings,
    createOutputRenderer(engineConfiguration),
  );
  const second = createDesignThumbnailSvg(
    parsed.data.settings,
    createOutputRenderer(engineConfiguration),
  );

  assert.equal(first, second);
});
