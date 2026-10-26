import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  terrainDecorationFadeFraction,
  terrainMorphEndFraction,
  terrainMorphStartFraction,
  terrainTransitionDurationMs,
} from './constants/terrain-transition';
import { evaluateTerrainTransition, interpolateTerrainValues } from './terrain-transition';

const duration = terrainTransitionDurationMs;
const at = (fraction: number) => evaluateTerrainTransition(fraction * duration, duration);

void test('transition starts on the previous terrain and lands exactly on the destination', () => {
  assert.deepEqual(at(0), {
    terrainProgress: 0,
    outgoingOpacity: 1,
    incomingOpacity: 0,
    isComplete: false,
  });
  assert.deepEqual(at(1), {
    terrainProgress: 1,
    outgoingOpacity: 0,
    incomingOpacity: 1,
    isComplete: true,
  });
  assert.equal(at(-1).terrainProgress, 0);
  assert.equal(at(5).isComplete, true);
});

void test('transition outputs stay within unit range and terrain never overshoots', () => {
  let previousProgress = 0;

  for (let step = 0; step <= 400; step++) {
    const frame = at(step / 400);

    for (const value of [frame.terrainProgress, frame.outgoingOpacity, frame.incomingOpacity]) {
      assert.ok(value >= 0 && value <= 1, `step ${step} produced ${value}`);
    }

    assert.ok(frame.terrainProgress >= previousProgress);
    previousProgress = frame.terrainProgress;
  }
});

void test('terrain holds still while decorations fade at either end', () => {
  assert.equal(at(terrainMorphStartFraction).terrainProgress, 0);
  assert.equal(at(terrainMorphEndFraction).terrainProgress, 1);
  assert.equal(at(0.5).terrainProgress, 0.5);
  assert.equal(at(terrainDecorationFadeFraction).outgoingOpacity, 0);
  assert.equal(at(1 - terrainDecorationFadeFraction).incomingOpacity, 0);
  assert.ok(at(1 - terrainDecorationFadeFraction / 2).incomingOpacity > 0);
});

void test('frames depend only on elapsed time, not evaluation order', () => {
  const times = [1730, 12, 999, 1730, 0, 2000, 12];
  const forward = times.map((time) => evaluateTerrainTransition(time, duration));
  const backward = [...times].reverse().map((time) => evaluateTerrainTransition(time, duration));

  assert.deepEqual(forward, backward.reverse());
});

void test('interpolation reproduces the destination exactly at completion', () => {
  const destination = new Float32Array([0.1, -3.7, 1e-7]);
  const output = new Float32Array(3);

  interpolateTerrainValues([5, 5, 5], destination, 1, output);
  assert.deepEqual(output, destination);
  interpolateTerrainValues([0, 0, 0], [2, 4, 6], 0.5, output);
  assert.deepEqual([...output], [1, 2, 3]);
});

void test('mismatched terrain buffers fail with an actionable message', () => {
  assert.throws(() => {
    interpolateTerrainValues([1, 2], [1, 2, 3], 0.5, new Float32Array(3));
  }, /source 2, destination 3.*Rebuild without a transition/);
  assert.throws(() => evaluateTerrainTransition(10, 0), /positive duration/);
});
