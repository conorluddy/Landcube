import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import test from 'node:test';
import type { Specimen } from '../ui/specimens';
import { renderMarkup } from '../ui/test-helpers';
import { FoundationPlate } from './foundation-plates';
import { systemParts, systemSections } from './registry';

const uiDirectory = new URL('../ui/', import.meta.url);

void test('every src/ui component with specimens has exactly one part, and every part has specimens', async () => {
  const specimenComponents = await loadSpecimenComponentNames();
  const partComponents = systemParts.flatMap((part) =>
    part.kind === 'component' ? [part.component] : [],
  );
  const missing = specimenComponents.filter((name) => !partComponents.includes(name));
  const unknown = partComponents.filter((name) => !specimenComponents.includes(name));

  assert.deepEqual(missing, [], 'Add a part to src/system/parts/components.ts for each of these.');
  assert.deepEqual(unknown, [], 'These parts name no defineSpecimens component.');
  assert.equal(new Set(partComponents).size, partComponents.length, 'A component has two parts.');
});

void test('part ids are unique', () => {
  const ids = systemParts.map((part) => part.id);

  assert.equal(new Set(ids).size, ids.length);
});

void test('codes run from 01 within each section, in browse order', () => {
  for (const section of systemSections) {
    const codes = systemParts
      .filter((part) => part.section === section.id)
      .map((part) => part.code);

    codes.forEach((code, index) => {
      assert.equal(code, `${section.id}.${String(index + 1).padStart(2, '0')}`);
    });
  }
});

void test('parts are listed section by section, in rail order', () => {
  const order = systemSections.map((section) => section.id);
  const positions = systemParts.map((part) => order.indexOf(part.section));

  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(
    positions,
    [...positions].sort((a, b) => a - b),
  );
});

void test('every foundation cell renders as a plate', () => {
  for (const part of systemParts) {
    if (part.kind !== 'foundation') {
      continue;
    }

    for (const cell of part.cells) {
      const markup = renderMarkup(<FoundationPlate cell={cell} />);

      assert.match(markup, /system-plate/, `${part.id} ${cell.k} ${cell.label}`);
    }
  }
});

// === HELPERS ===

async function loadSpecimenComponentNames(): Promise<string[]> {
  const files = [
    ...readdirSync(uiDirectory).map((name) => new URL(name, uiDirectory)),
    ...readdirSync(new URL('overlays/', uiDirectory)).map(
      (name) => new URL(`overlays/${name}`, uiDirectory),
    ),
  ].filter((url) => url.pathname.endsWith('.specimens.tsx'));
  const modules = await Promise.all(
    files.map(async (url) => (await import(url.href)) as { default: Specimen[] }),
  );

  return modules.map((module) => module.default[0].component);
}
