import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkup } from '../test-helpers';
import { Wipe } from './wipe';

const sideBMarkup = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0,0L1,1"/></svg>';

function render(props: Partial<Parameters<typeof Wipe>[0]> = {}): string {
  return renderMarkup(
    <Wipe
      sideBMarkup={sideBMarkup}
      sideBBackground="#153c68"
      dividerFraction={0.25}
      onDividerChange={() => undefined}
      inspectorState="expanded"
      {...props}
    />,
  );
}

void test('the divider position is a CSS custom property in percent', () => {
  assert.ok(render().includes('--lc-wipe-position:25%'));
});

void test('side B hosts the render and stays out of the accessibility tree', () => {
  const markup = render();

  assert.match(markup, /<div class="lc-wipe__side-b"[^>]*aria-hidden="true"/);
  assert.ok(markup.includes(sideBMarkup));
  assert.ok(markup.includes('background:#153c68'));
});

void test('A and B tags label the two sides', () => {
  const markup = render();

  assert.ok(markup.includes('data-side="a"><span class="lc-tag" data-variant="outlineBone">A'));
  assert.ok(markup.includes('data-side="b"><span class="lc-tag" data-variant="outlineBone">B'));
});

void test('the handle is a focusable slider with a percent value', () => {
  const markup = render({ dividerFraction: 0.634 });

  assert.ok(markup.includes('role="slider"'));
  assert.ok(markup.includes('aria-label="Compare divider"'));
  assert.ok(markup.includes('aria-valuenow="63"'));
  assert.ok(markup.includes('aria-valuemin="0"'));
  assert.ok(markup.includes('aria-valuemax="100"'));
  assert.ok(markup.includes('tabindex="0"'));
});

void test('a previewing wipe has no handle', () => {
  assert.ok(!render({ isInteractive: false }).includes('role="slider"'));
});

void test('the wipe follows the inspector state for its tag insets', () => {
  assert.ok(render({ inspectorState: 'collapsed' }).includes('data-inspector="collapsed"'));
});
