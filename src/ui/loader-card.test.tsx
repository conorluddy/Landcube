import assert from 'node:assert/strict';
import test from 'node:test';
import { LoaderCard } from './loader-card';
import { renderMarkup } from './test-helpers';

void test('LoaderCard is a status region with a determinate progressbar', () => {
  const markup = renderMarkup(
    <LoaderCard title="Loading terrain" fraction={0.333} detail="3 of 9 tiles" />,
  );

  assert.match(markup, /role="status"/);
  assert.match(markup, />33%</);
  assert.match(markup, />3 of 9 tiles</);
  assert.match(markup, /role="progressbar"[^>]*aria-valuenow="0.333"/);
});

void test('LoaderCard with an unknown fraction is indeterminate and shows no percent', () => {
  const markup = renderMarkup(<LoaderCard title="Loading terrain" fraction={NaN} />);

  assert.match(markup, /data-indeterminate="true"/);
  assert.ok(!markup.includes('%'));
  assert.ok(!markup.includes('aria-valuenow'));
});

void test('LoaderCard offers Cancel only when it can be cancelled', () => {
  const cancellable = renderMarkup(
    <LoaderCard title="x" fraction={0} onCancel={() => undefined} />,
  );

  assert.match(cancellable, />Cancel</);
  assert.ok(!renderMarkup(<LoaderCard title="x" fraction={0} />).includes('Cancel'));
});
