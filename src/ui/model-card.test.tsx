import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelCard } from './model-card';
import { renderMarkup } from './test-helpers';
import { Tag } from './tag';

void test('ModelCard opens through one button holding thumbnail, title and subtitle', () => {
  const markup = renderMarkup(
    <ModelCard title="Ridge" subtitle="Seed 12" thumbnail={<i>T</i>} onOpen={() => undefined} />,
  );

  assert.match(markup, /^<article class="lc-model-card"><button class="lc-model-card__open"/);
  assert.match(markup, /<i>T<\/i>.*Ridge.*Seed 12/);
  assert.ok(!markup.includes('lc-model-card__delete'));
});

void test('ModelCard adds a delete button named after the card when onDelete is given', () => {
  const markup = renderMarkup(
    <ModelCard
      title="Ridge"
      subtitle="s"
      thumbnail={null}
      tags={<Tag variant="outlineMuted">Real</Tag>}
      onOpen={() => undefined}
      onDelete={() => undefined}
    />,
  );

  assert.match(markup, /aria-label="Delete Ridge"/);
  assert.match(markup, /lc-tag/);
});
