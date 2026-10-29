import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkup } from './test-helpers';
import { TextField } from './text-field';

const noop = (): void => undefined;

void test('TextField links its label to the input by explicit and generated ids', () => {
  const explicit = renderMarkup(<TextField id="link" label="Link" value="" onChange={noop} />);
  const generated = renderMarkup(<TextField label="Link" value="" onChange={noop} />);
  const generatedId = /<label[^>]*for="([^"]+)"/.exec(generated)?.[1];

  assert.match(explicit, /<label[^>]*for="link"/);
  assert.match(explicit, /<input[^>]*id="link"/);
  assert.notEqual(generatedId, undefined);
  assert.match(generated, new RegExp(`<input[^>]*id="${generatedId}"`));
});

void test('TextField shows the dash placeholder unless given another', () => {
  assert.match(
    renderMarkup(<TextField label="Link" value="" onChange={noop} />),
    /placeholder="—"/,
  );
  assert.match(
    renderMarkup(<TextField label="Link" value="" placeholder="https://" onChange={noop} />),
    /placeholder="https:\/\/"/,
  );
});

void test('TextField marks itself invalid and renders an alert for an error', () => {
  const markup = renderMarkup(
    <TextField id="link" label="Link" value="x" error="Not a link." onChange={noop} />,
  );

  assert.match(markup, /aria-invalid="true"/);
  assert.match(markup, /aria-describedby="link-error"/);
  assert.match(markup, /<small[^>]*id="link-error"[^>]*role="alert">Not a link\.<\/small>/);
});

void test('TextField without an error is not invalid', () => {
  const markup = renderMarkup(<TextField label="Link" value="x" onChange={noop} />);

  assert.doesNotMatch(markup, /aria-invalid|role="alert"/);
});

void test('TextField is monospace by default and opts out', () => {
  assert.match(renderMarkup(<TextField label="L" value="" onChange={noop} />), /data-mono="true"/);
  assert.match(
    renderMarkup(<TextField label="L" value="" isMonospace={false} onChange={noop} />),
    /data-mono="false"/,
  );
});
