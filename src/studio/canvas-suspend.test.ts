import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanvasSuspender } from './canvas-suspend';
import type { ModeFlipTimers } from './mode-flip';

void test('entering system mode suspends drawing once the canvas has faded out', () => {
  const { suspender, calls, advance } = setup();

  suspender.follow('system');
  advance(599);
  assert.deepEqual(calls, []);
  advance(1);
  assert.deepEqual(calls, [true]);
});

void test('returning before the fade ends cancels the suspend and resumes last', () => {
  const { suspender, calls, advance } = setup();

  suspender.follow('system');
  advance(300);
  suspender.follow('studio');
  advance(1000);

  assert.deepEqual(calls, [false]);
});

void test('returning after a suspend resumes at once', () => {
  const { suspender, calls, advance } = setup();

  suspender.follow('system');
  advance(600);
  suspender.follow('studio');

  assert.deepEqual(calls, [true, false]);
});

void test('repeated notifications of the same mode do nothing', () => {
  const { suspender, calls, advance } = setup();

  suspender.follow('studio');
  suspender.follow('system');
  suspender.follow('system');
  advance(1200);

  assert.deepEqual(calls, [true]);
});

// === HELPERS ===

function setup() {
  const calls: boolean[] = [];
  let now = 0;
  let nextHandle = 1;
  const queue = new Map<number, { at: number; callback: () => void }>();
  const timers: ModeFlipTimers = {
    setTimeout: (callback, delayMs) => {
      queue.set(nextHandle, { at: now + delayMs, callback });

      return nextHandle++;
    },
    clearTimeout: (handle) => {
      queue.delete(handle);
    },
  };
  const suspender = createCanvasSuspender({
    initialMode: 'studio',
    fadeMs: 600,
    timers,
    setSuspended: (isSuspended) => {
      calls.push(isSuspended);
    },
  });

  return {
    suspender,
    calls,
    advance: (ms: number) => {
      now += ms;

      for (const [handle, timer] of [...queue].sort((a, b) => a[1].at - b[1].at)) {
        if (timer.at <= now) {
          queue.delete(handle);
          timer.callback();
        }
      }
    },
  };
}
