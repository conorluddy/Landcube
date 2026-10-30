import assert from 'node:assert/strict';
import test from 'node:test';
import { FaultCard } from './fault-card';
import { renderMarkup } from './test-helpers';

const noop = (): void => undefined;

void test('FaultCard is an alert section named by its code and title', () => {
  const markup = renderMarkup(
    <FaultCard
      code="E-201"
      title="Tile download failed"
      primaryAction={{ label: 'Retry', onClick: noop }}
    >
      Check your connection.
    </FaultCard>,
  );
  const labelledBy = /aria-labelledby="([^"]+)"/.exec(markup)?.[1];

  assert.match(markup, /^<section class="lc-fault-card lc-glass"[^>]*role="alert"/);
  assert.ok(labelledBy !== undefined && markup.includes(`id="${labelledBy}"`));
  assert.match(markup, />E-201<\/span>/);
  assert.match(markup, />Tile download failed<\/span>/);
  assert.match(markup, />Check your connection\.</);
});

void test('FaultCard shows the metric and secondary actions when given', () => {
  const markup = renderMarkup(
    <FaultCard
      code="E-201"
      title="Tile download failed"
      metric="3 of 9 tiles"
      primaryAction={{ label: 'Retry', onClick: noop }}
      secondaryActions={[
        { label: 'Dismiss', onClick: noop },
        { label: 'Procedural', onClick: noop },
      ]}
    >
      Body
    </FaultCard>,
  );

  assert.match(markup, />3 of 9 tiles<\/span>/);
  assert.match(markup, />Dismiss</);
  assert.match(markup, />Procedural</);
});

void test('FaultCard inline drops the glass surface', () => {
  const markup = renderMarkup(
    <FaultCard
      code="E-202"
      title="Map data unavailable"
      isInline
      primaryAction={{ label: 'Retry', onClick: noop }}
    >
      Busy
    </FaultCard>,
  );

  assert.match(markup, /class="lc-fault-card"/);
  assert.match(markup, /data-inline="true"/);
});

void test('FaultCard rejects more than two secondary actions', () => {
  const actions = [1, 2, 3].map((index) => ({ label: `Action ${index}`, onClick: noop }));

  assert.throws(
    () =>
      renderMarkup(
        <FaultCard code="E-1" title="x" primaryAction={actions[0]} secondaryActions={actions}>
          Body
        </FaultCard>,
      ),
    /at most 2 secondary actions, got 3/,
  );
});
