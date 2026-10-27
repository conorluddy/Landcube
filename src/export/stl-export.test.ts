import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBinaryStl } from './stl-export';
import type { TerrainSurfaceBuffers } from '../terrain-surface';

/** A closed tetrahedron: the smallest solid the STL writer accepts. */
const tetrahedron: TerrainSurfaceBuffers = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0]),
  indices: new Uint32Array([0, 1, 2, 0, 3, 1, 1, 3, 2, 0, 2, 3]),
};

function readHeader(stl: ArrayBuffer): string {
  return new TextDecoder().decode(new Uint8Array(stl, 0, 80)).replace(/\0+$/, '');
}

void test('model STLs keep their original header', () => {
  assert.equal(
    readHeader(createBinaryStl(tetrahedron)),
    'Topogra terrain model | units: millimeters | Z up',
  );
});

void test('a label names the part in the header without touching the triangle count', () => {
  const stl = createBinaryStl(tetrahedron, 'Topogra frame-2');

  assert.equal(readHeader(stl), 'Topogra frame-2 | units: millimeters | Z up');
  assert.equal(new DataView(stl).getUint32(80, true), 4);
});

void test('a label too long for the 80-byte header is rejected', () => {
  assert.throws(() => createBinaryStl(tetrahedron, 'x'.repeat(60)), /limit is 80/);
});
