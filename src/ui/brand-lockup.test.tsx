import assert from 'node:assert/strict';
import test from 'node:test';
import { BrandLockup } from './brand-lockup';
import { renderMarkup } from './test-helpers';

/** Approximates the accessible name: visible text with aria-hidden subtrees removed. */
function accessibleName(markup: string): string {
  return markup
    .replace(/<span[^>]*aria-hidden="true"[^>]*>[^<]*<\/span>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

void test('BrandLockup is an h1 named "LANDCU.BE {context}" by default', () => {
  const markup = renderMarkup(<BrandLockup context="Studio" />);

  assert.match(markup, /^<h1 class="lc-brand-lockup" data-size="bar">/);
  assert.equal(accessibleName(markup), 'LANDCU.BE Studio');
});

void test('BrandLockup renders a paragraph when isHeading is false', () => {
  const markup = renderMarkup(<BrandLockup context="Studio" isHeading={false} size="splash" />);

  assert.match(markup, /^<p class="lc-brand-lockup" data-size="splash">/);
  assert.ok(!markup.includes('<h1'));
});

void test('BrandLockup keeps authoring case of the context for CSS to capitalise', () => {
  assert.match(renderMarkup(<BrandLockup context="Studio" />), />Studio<\/span>/);
});
