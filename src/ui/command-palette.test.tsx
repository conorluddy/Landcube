import assert from 'node:assert/strict';
import test from 'node:test';
import { CommandPalette, type CommandPaletteProps, type CommandResult } from './command-palette';
import { renderMarkup } from './test-helpers';

const results: CommandResult[] = [
  { kind: 'parameter', id: 'contourCount', label: 'Density', code: 'CONT.01', detail: '23' },
  { kind: 'location', id: 'location-0', label: 'Ben Nevis', detail: 'Scotland' },
  { kind: 'action', id: 'action-export', label: 'Open export' },
];

function renderPalette(props: Partial<CommandPaletteProps> = {}): string {
  return renderMarkup(
    <CommandPalette
      isOpen
      query="den"
      onQueryChange={() => undefined}
      results={results}
      activeIndex={0}
      onActivate={() => undefined}
      onSelect={() => undefined}
      onClose={() => undefined}
      {...props}
    />,
  );
}

void test('CommandPalette renders nothing while closed, so no combobox exists', () => {
  assert.equal(renderPalette({ isOpen: false }), '');
});

void test('the input is a combobox wired to the listbox and the active option', () => {
  const markup = renderPalette();
  const listboxId = /id="([^"]+)" role="listbox"/.exec(markup)?.[1];

  assert.match(markup, /role="combobox"/);
  assert.match(markup, /aria-label="Find a command"/);
  assert.match(markup, /aria-expanded="true"/);
  assert.ok(listboxId !== undefined);
  assert.ok(markup.includes(`aria-controls="${listboxId}"`));
  assert.match(markup, /aria-activedescendant="[^"]+-option-0"/);
  assert.match(markup, /id="[^"]+-option-0" role="option" aria-selected="true"/);
});

void test('results are grouped by kind under captions', () => {
  const markup = renderPalette();
  const groups = markup.match(/role="group" aria-labelledby/g) ?? [];

  assert.equal(groups.length, 3);
  assert.ok(markup.indexOf('Parameters') < markup.indexOf('Locations'));
  assert.ok(markup.indexOf('Locations') < markup.indexOf('Actions'));
  assert.match(markup, /CONT\.01<\/span><span class="lc-command-palette__label">Density/);
});

void test('the preview pane announces the value diff politely', () => {
  const markup = renderPalette({
    preview: { label: 'Interval (m)', from: '20 m', to: '25 m' },
    valueDraft: '25',
  });

  assert.match(markup, /aria-live="polite"/);
  assert.match(markup, /<span>20 m<\/span>.*→.*25 m/);
  assert.match(markup, /aria-label="New value for Interval \(m\)"/);
  assert.match(markup, /Set value/);
});

void test('quick values render as buttons in a labelled group', () => {
  const markup = renderPalette({
    quickValues: [
      { label: 'On', value: 'on' },
      { label: 'Off', value: 'off' },
    ],
  });

  assert.match(markup, /role="group" aria-label="Quick values"/);
  assert.equal((markup.match(/lc-command-palette__chip/g) ?? []).length, 2);
});

void test('desktop shows keyboard hints; mobile is a sheet with a Cancel button', () => {
  const desktop = renderPalette();
  const mobile = renderPalette({ isMobile: true });

  assert.match(desktop, /data-layout="modal"/);
  assert.match(desktop, /lc-command-palette__hints/);
  assert.match(mobile, /data-layout="sheet"/);
  assert.doesNotMatch(mobile, /lc-command-palette__hints/);
  assert.match(mobile, />Cancel</);
});

void test('a long label stays a single text node', () => {
  const label = 'Maximum depth below sea level in metres for coastal terrain tiles';
  const markup = renderPalette({ results: [{ kind: 'parameter', id: 'x', label }] });

  assert.ok(markup.includes(`>${label}</span>`));
});
