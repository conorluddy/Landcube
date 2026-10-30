import assert from 'node:assert/strict';
import test from 'node:test';
import { keepSystemLink, readSystemLink, replaceSystemLink, writeSystemLink } from './system-link';

void test('a mode=system link reads its part reference, id or code', () => {
  assert.deepEqual(readSystemLink(new URLSearchParams('mode=system&part=PRIM.04')), {
    partReference: 'PRIM.04',
  });
  assert.deepEqual(readSystemLink(new URLSearchParams('mode=system')), {
    partReference: undefined,
  });
});

void test('anything other than mode=system is not a system link', () => {
  assert.equal(readSystemLink(new URLSearchParams('part=PRIM.04')), undefined);
  assert.equal(readSystemLink(new URLSearchParams('mode=studio')), undefined);
});

void test('writing sets both keys beside existing parameters, and undefined removes them', () => {
  const linked = writeSystemLink('https://landcube.test/?v=1&seed=4#top', 'ruler-slider');

  assert.equal(linked, 'https://landcube.test/?v=1&seed=4&mode=system&part=ruler-slider#top');
  assert.equal(writeSystemLink(linked, undefined), 'https://landcube.test/?v=1&seed=4#top');
});

void test('a rewritten design URL keeps the system link from the address bar', () => {
  assert.equal(
    keepSystemLink(
      'https://landcube.test/?mode=system&part=tag',
      'https://landcube.test/?v=1&seed=9',
    ),
    'https://landcube.test/?v=1&seed=9&mode=system&part=tag',
  );
  assert.equal(
    keepSystemLink('https://landcube.test/?mode=system', 'https://landcube.test/?v=1'),
    'https://landcube.test/?v=1&mode=system',
  );
  assert.equal(
    keepSystemLink('https://landcube.test/?seed=1', 'https://landcube.test/?v=1&seed=9'),
    'https://landcube.test/?v=1&seed=9',
  );
});

void test('a blocked address-bar update logs one URL_FAILED and does not throw', (context) => {
  const warnings: string[] = [];

  context.mock.method(console, 'warn', (message: string) => {
    warnings.push(message);
  });
  replaceSystemLink('https://landcube.test/', 'tag', {
    state: null,
    replaceState: () => {
      throw new Error('Denied');
    },
  });

  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /"code":"URL_FAILED"/);
});
