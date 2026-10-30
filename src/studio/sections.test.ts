import assert from 'node:assert/strict';
import test from 'node:test';
import type { InspectorSection } from './controller';
import { getGroupCode, getSectionForGroup, studioSections } from './sections';

void test('index contours is the third Contours group', () => {
  assert.equal(getGroupCode('index-contours'), 'CONT.03');
});

void test('groups keep their registered position, so the first and last read 01 and NN', () => {
  assert.equal(getGroupCode('autoplay'), 'TERR.01');
  assert.equal(getGroupCode('orbit'), 'CAMR.04');
  assert.equal(getGroupCode('sea-level'), 'SCEN.11');
  assert.equal(getGroupCode('route'), 'SCEN.12');
  assert.equal(getGroupCode('edge'), 'FRAM.03');
});

void test('every group code is unique', () => {
  const codes = studioSections.flatMap((section) => section.groupIds.map(getGroupCode));

  assert.equal(new Set(codes).size, codes.length);
});

void test('every group id is registered under exactly one section', () => {
  const groupIds = studioSections.flatMap((section) => [...section.groupIds]);

  assert.equal(new Set(groupIds).size, groupIds.length);

  for (const section of studioSections) {
    for (const groupId of section.groupIds) {
      assert.equal(getSectionForGroup(groupId).id, section.id);
    }
  }
});

void test('sections run 01 to 07 in design order with unique codes', () => {
  assert.deepEqual(
    studioSections.map((section) => `${String(section.index).padStart(2, '0')} ${section.code}`),
    ['01 TERR', '02 CONT', '03 COLR', '04 CAMR', '05 SCEN', '06 MODL', '07 FRAM'],
  );
});

void test('section ids and titles match the inspector sections the e2e tests address', () => {
  const inspectorSections: InspectorSection[] = [
    'Terrain',
    'Contours',
    'Colour',
    'Camera',
    'Scene',
    'Model',
    'Frame',
  ];

  assert.deepEqual(
    studioSections.map((section) => section.id),
    inspectorSections,
  );
  assert.deepEqual(
    studioSections.map((section) => section.title),
    inspectorSections,
  );
});

void test('an unregistered group id throws with a pointer to the registry', () => {
  assert.throws(
    () => getGroupCode('contour-interval'),
    /"contour-interval" is not registered.*sections\.ts/,
  );
  assert.throws(() => getSectionForGroup('nope'), /"nope" is not registered/);
});
