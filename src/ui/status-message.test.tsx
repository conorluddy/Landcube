import assert from 'node:assert/strict';
import test from 'node:test';
import { StatusMessage } from './status-message';
import { renderMarkup } from './test-helpers';

void test('StatusMessage is a polite status region by default', () => {
  const markup = renderMarkup(<StatusMessage kind="ok">Real terrain loaded</StatusMessage>);

  assert.match(markup, /role="status"/);
  assert.match(markup, /aria-live="polite"/);
  assert.ok(markup.includes('>Real terrain loaded</span>'));
});

void test('StatusMessage with isAlert is an alert without a polite live region', () => {
  const markup = renderMarkup(
    <StatusMessage kind="fault" isAlert>
      Preview decode unavailable
    </StatusMessage>,
  );

  assert.match(markup, /role="alert"/);
  assert.ok(!markup.includes('aria-live'));
});

void test('StatusMessage announces its fault code with the message', () => {
  const markup = renderMarkup(
    <StatusMessage kind="fault" code="E-204" isAlert>
      Coverage gap
    </StatusMessage>,
  );

  assert.match(markup, /<span class="lc-status-message__code">E-204<\/span>/);
  assert.ok(!markup.includes('aria-hidden="true">E-204'));
});

void test('StatusMessage renders nothing when empty unless it must stay mounted', () => {
  assert.equal(renderMarkup(<StatusMessage kind="info">{''}</StatusMessage>), '');
  assert.equal(renderMarkup(<StatusMessage kind="info" />), '');
});

void test('an always-mounted empty StatusMessage is an empty focusable live region', () => {
  const markup = renderMarkup(
    <StatusMessage kind="info" id="roads-status" tabIndex={-1} isAlwaysMounted>
      {''}
    </StatusMessage>,
  );

  assert.equal(
    markup,
    '<div id="roads-status" class="lc-status-message" data-kind="info" role="status" aria-live="polite" tabindex="-1"></div>',
  );
});

void test('StatusMessage draws a decorative signal mark per kind', () => {
  const expectedMarks = [
    ['ok', 'ok'],
    ['fault', 'fault'],
    ['info', 'waypoint'],
  ] as const;

  for (const [kind, markKind] of expectedMarks) {
    const markup = renderMarkup(<StatusMessage kind={kind}>Message</StatusMessage>);

    assert.match(markup, new RegExp(`data-kind="${markKind}"[^>]*aria-hidden="true"`));
  }
});
