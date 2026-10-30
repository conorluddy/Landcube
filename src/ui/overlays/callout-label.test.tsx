import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkup } from '../test-helpers';
import { CalloutLabel } from './callout-label';

void test('CalloutLabel sits on its anchor with the value over its meta lines', () => {
  const markup = renderMarkup(
    <CalloutLabel anchor={{ xPx: 120.4, yPx: 80 }} value="3.75 km" meta={['Bearing 090°']} />,
  );

  assert.equal(
    markup,
    '<div class="lc-callout-label" style="--lc-callout-x:120px;--lc-callout-y:80px"><span class="lc-callout-label__leader" aria-hidden="true"></span><div class="lc-callout-label__box"><span class="lc-callout-label__value">3.75 km</span><span class="lc-callout-label__meta">Bearing 090°</span></div></div>',
  );
});

void test('CalloutLabel skips empty meta lines', () => {
  const markup = renderMarkup(<CalloutLabel anchor={{ xPx: 0, yPx: 0 }} value="—" meta={['']} />);

  assert.ok(!markup.includes('lc-callout-label__meta'));
});
