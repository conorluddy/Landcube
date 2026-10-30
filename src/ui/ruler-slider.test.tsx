import assert from 'node:assert/strict';
import test from 'node:test';
import { RulerSlider, rulerSliderFraction } from './ruler-slider';
import { renderMarkup } from './test-helpers';

const noop = (): void => undefined;

/** Copied from the original `Range` field; the e2e `output[for]` selectors read this. */
function originalRangeOutputText(value: number, suffix = '', displayValue?: string): string {
  return displayValue ?? `${Number(value.toFixed(2))}${suffix}`;
}

function outputText(markup: string): string {
  const match = /<output[^>]*>(.*?)<\/output>/.exec(markup);

  assert.ok(match, 'expected an <output> element');

  return match[1].replaceAll(/<[^>]+>/g, '');
}

function renderSlider(props: Partial<Parameters<typeof RulerSlider>[0]> = {}): string {
  return renderMarkup(
    <RulerSlider label="Weight" value={1} min={0} max={4} step={0.1} onChange={noop} {...props} />,
  );
}

void test('RulerSlider output text matches the original Range contract', () => {
  const cases: { value: number; unit?: string; displayValue?: string }[] = [
    { value: 3 },
    { value: 0.1 + 0.2 },
    { value: 1.005 },
    { value: -2.5 },
    { value: 0 },
    { value: 12, unit: ' s' },
    { value: 0.456, unit: '%' },
    { value: 2, displayValue: '1:50 000' },
    { value: 2, unit: ' m', displayValue: 'Fine' },
  ];

  for (const { value, unit, displayValue } of cases) {
    assert.equal(
      outputText(renderSlider({ value, unit, displayValue })),
      originalRangeOutputText(value, unit, displayValue),
    );
  }
});

void test('RulerSlider links label and output to the input by an explicit id', () => {
  const markup = renderSlider({ id: 'weight' });

  assert.match(markup, /<label[^>]*for="weight"/);
  assert.match(markup, /<output[^>]*for="weight"/);
  assert.match(markup, /<input[^>]*id="weight"[^>]*type="range"/);
});

void test('RulerSlider links label and output to the input by a generated id', () => {
  const markup = renderSlider();
  const labelFor = /<label[^>]*for="([^"]+)"/.exec(markup)?.[1];

  assert.notEqual(labelFor, undefined);
  assert.match(markup, new RegExp(`<output[^>]*for="${labelFor}"`));
  assert.match(markup, new RegExp(`<input[^>]*id="${labelFor}"`));
});

void test('RulerSlider announces displayValue as aria-valuetext', () => {
  assert.match(renderSlider({ displayValue: 'Fine' }), /aria-valuetext="Fine"/);
  assert.doesNotMatch(renderSlider(), /aria-valuetext/);
});

void test('RulerSlider draws tickCount ticks, ten by default', () => {
  assert.equal(renderSlider().match(/lc-ruler-slider__tick"/g)?.length, 10);
  assert.equal(renderSlider({ tickCount: 4 }).match(/lc-ruler-slider__tick"/g)?.length, 4);
});

void test('RulerSlider fraction is clamped and zero when min equals max', () => {
  assert.equal(rulerSliderFraction(2, 0, 4), 0.5);
  assert.equal(rulerSliderFraction(-1, 0, 4), 0);
  assert.equal(rulerSliderFraction(9, 0, 4), 1);
  assert.equal(rulerSliderFraction(3, 3, 3), 0);
  assert.equal(rulerSliderFraction(Number.NaN, 0, 4), 0);
  assert.match(renderSlider({ value: 2 }), /--lc-slider-fraction:0\.5/);
});

void test('RulerSlider disables the native input', () => {
  assert.match(renderSlider({ disabled: true }), /<input[^>]*disabled=""/);
});
