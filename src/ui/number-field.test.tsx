import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeNumberRange,
  NumberField,
  parseNumberDraft,
  type NumberDraftRules,
} from './number-field';
import { renderMarkup } from './test-helpers';

const noop = (): void => undefined;
const bounded: NumberDraftRules = { min: 1, max: 10, isOptional: false };

void test('parseNumberDraft accepts a number inside the bounds', () => {
  assert.deepEqual(parseNumberDraft('5', bounded), { isValid: true, value: 5 });
  assert.deepEqual(parseNumberDraft('1', bounded), { isValid: true, value: 1 });
  assert.deepEqual(parseNumberDraft('10', bounded), { isValid: true, value: 10 });
});

void test('parseNumberDraft rejects empty, out of range and non-finite drafts', () => {
  for (const draft of ['', '0', '11', 'abc', 'Infinity']) {
    assert.deepEqual(parseNumberDraft(draft, bounded), { isValid: false }, draft);
  }
});

void test('parseNumberDraft treats an empty draft as undefined when optional', () => {
  assert.deepEqual(parseNumberDraft('', { ...bounded, isOptional: true }), {
    isValid: true,
    value: undefined,
  });
  assert.deepEqual(parseNumberDraft('0', { ...bounded, isOptional: true }), { isValid: false });
});

void test('describeNumberRange keeps the legacy wording', () => {
  assert.equal(describeNumberRange(1, 10), 'Enter a valid value from 1 to 10.');
  assert.equal(describeNumberRange(undefined, 10), 'Enter a valid value to 10.');
  assert.equal(describeNumberRange(undefined, undefined), 'Enter a valid value.');
});

void test('NumberField links its label to the input and shows the dash placeholder', () => {
  const markup = renderMarkup(
    <NumberField id="width" label="Width" value={undefined} onChange={noop} isOptional />,
  );

  assert.match(markup, /<label[^>]*for="width"/);
  assert.match(markup, /<input[^>]*id="width"/);
  assert.match(markup, /placeholder="—"/);
  assert.doesNotMatch(markup, /aria-invalid/);
  assert.doesNotMatch(markup, /role="alert"/);
});

void test('NumberField generates matching label and input ids', () => {
  const markup = renderMarkup(<NumberField label="Width" value={5} onChange={noop} />);
  const labelFor = /<label[^>]*for="([^"]+)"/.exec(markup)?.[1];

  assert.notEqual(labelFor, undefined);
  assert.match(markup, new RegExp(`<input[^>]*id="${labelFor}"`));
  assert.match(markup, /value="5"/);
});

void test('NumberField renders its unit in the label head', () => {
  const markup = renderMarkup(<NumberField label="Width" unit="px" value={5} onChange={noop} />);

  assert.match(markup, /<span class="lc-field__unit">px<\/span>/);
});
