import assert from 'node:assert/strict';
import test from 'node:test';
import { ListRow } from './list-row';
import { SettingsGroup } from './settings-group';
import { renderMarkup } from './test-helpers';

void test('SettingsGroup is a section named by its title', () => {
  const markup = renderMarkup(
    <SettingsGroup title="Data sources">
      <ListRow title="Terrarium" />
    </SettingsGroup>,
  );

  assert.match(markup, /^<section class="lc-settings-group" aria-label="Data sources">/);
  assert.match(markup, /lc-group-header/);
  assert.match(markup, /lc-settings-group__rows"><div class="lc-list-row">/);
});

void test('SettingsGroup shows its code decoratively', () => {
  const markup = renderMarkup(
    <SettingsGroup title="Theme" code="SET.01">
      <ListRow title="Row" />
    </SettingsGroup>,
  );

  assert.match(markup, /aria-hidden="true">SET\.01</);
});
