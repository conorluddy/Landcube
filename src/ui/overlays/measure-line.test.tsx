import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkup } from '../test-helpers';
import { MeasureLine } from './measure-line';

const noop = () => undefined;

void test('MeasureLine without points is only the measuring surface', () => {
  const markup = renderMarkup(<MeasureLine onSurfacePointer={noop} onEndpointMove={noop} />);

  assert.equal(
    markup,
    '<div class="lc-measure-line"><div class="lc-measure-line__surface"></div></div>',
  );
});

void test('MeasureLine draws a line with eleven ticks and two named endpoints', () => {
  const markup = renderMarkup(
    <MeasureLine
      start={{ xPx: 0, yPx: 0 }}
      end={{ xPx: 100, yPx: 0 }}
      onSurfacePointer={noop}
      onEndpointMove={noop}
    >
      <i>callout</i>
    </MeasureLine>,
  );
  const strokePath = /class="lc-measure-line__stroke" d="([^"]+)"/.exec(markup)?.[1] ?? '';

  assert.ok(strokePath.startsWith('M 0 0 L 100 0 M 0 -6 L 0 6 M 10 -3 L 10 3'));
  assert.equal(strokePath.match(/M /g)?.length, 12);
  assert.ok(
    markup.includes('aria-label="Measure start" style="--lc-measure-x:0px;--lc-measure-y:0px"'),
  );
  assert.ok(
    markup.includes('aria-label="Measure end" style="--lc-measure-x:100px;--lc-measure-y:0px"'),
  );
  assert.ok(markup.endsWith('<i>callout</i></div>'));
});

void test('MeasureLine with one endpoint shows it without a line', () => {
  const markup = renderMarkup(
    <MeasureLine start={{ xPx: 4, yPx: 8 }} onSurfacePointer={noop} onEndpointMove={noop} />,
  );

  assert.ok(markup.includes('aria-label="Measure start"'));
  assert.ok(!markup.includes('Measure end'));
  assert.ok(!markup.includes('lc-measure-line__stroke'));
});
