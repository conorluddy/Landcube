import assert from 'node:assert/strict';
import test from 'node:test';
import { groupCommandsByKind, rankCommands, type RankableCommand } from './command-ranking';

const commands: RankableCommand[] = [
  { kind: 'parameter', id: 'scene-water-style', label: 'Water style', sectionId: 'Scene' },
  { kind: 'parameter', id: 'strokeWidth', label: 'Weight', code: 'CONT.02', sectionId: 'Contours' },
  {
    kind: 'parameter',
    id: 'indexStrokeWidth',
    label: 'Index weight',
    code: 'CONT.03',
    sectionId: 'Contours',
  },
  {
    kind: 'parameter',
    id: 'featureScale',
    label: 'Feature scale',
    code: 'TERR.02',
    sectionId: 'Terrain',
  },
  { kind: 'action', id: 'action-section-contours', label: 'Go to Contours', code: 'CONT' },
];

void test('a prefix match ranks above a word-start match above a substring match', () => {
  const ranked = rankCommands('weight', [
    { kind: 'parameter', id: 'a', label: 'Overweight lines' },
    { kind: 'parameter', id: 'b', label: 'Index weight' },
    { kind: 'parameter', id: 'c', label: 'Weight' },
  ]);

  assert.deepEqual(
    ranked.map(({ id }) => id),
    ['c', 'b', 'a'],
  );
});

void test('codes and ids match as well as labels', () => {
  assert.deepEqual(
    rankCommands('cont.03', commands).map(({ id }) => id),
    ['indexStrokeWidth'],
  );
  assert.deepEqual(
    rankCommands('stroke', commands).map(({ id }) => id),
    ['strokeWidth', 'indexStrokeWidth'],
  );
});

void test('camelCase ids split into words for word-start matches', () => {
  assert.deepEqual(
    rankCommands('scale', commands).map(({ id }) => id),
    ['featureScale'],
  );
});

void test('ties keep section order, then index order', () => {
  const ranked = rankCommands('w', commands);

  assert.deepEqual(
    ranked.map(({ id }) => id),
    ['strokeWidth', 'scene-water-style', 'indexStrokeWidth'],
  );
});

void test('an empty query keeps every command in index order', () => {
  assert.deepEqual(rankCommands('  ', commands), commands);
});

void test('commands with no match are dropped', () => {
  assert.deepEqual(rankCommands('zzz', commands), []);
});

void test('grouping by kind puts parameters, then locations, then actions', () => {
  const grouped = groupCommandsByKind([
    { kind: 'action', id: 'x', label: 'X' },
    { kind: 'location', id: 'y', label: 'Y' },
    { kind: 'parameter', id: 'z', label: 'Z' },
    { kind: 'action', id: 'w', label: 'W' },
  ]);

  assert.deepEqual(
    grouped.map(({ id }) => id),
    ['z', 'y', 'x', 'w'],
  );
});
