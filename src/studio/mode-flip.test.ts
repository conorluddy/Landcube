import assert from 'node:assert/strict';
import test from 'node:test';
import type { StudioMode } from './controller';
import { createModeFlip, type ModeFlipTimers } from './mode-flip';

void test('a flip folds out, swaps the shown mode edge-on, then folds back in', () => {
  const { flip, committed, advance } = setup();

  assert.equal(flip.request('system'), true);
  assert.deepEqual(committed, ['system']);
  assert.equal(flip.getSnapshot().shownMode, 'studio');
  assert.equal(flip.getSnapshot().angleDegrees, 90);
  assert.equal(flip.getSnapshot().transition, 'foldOut');

  advance(260);
  assert.equal(flip.getSnapshot().shownMode, 'system');
  assert.equal(flip.getSnapshot().angleDegrees, -90);
  assert.equal(flip.getSnapshot().transition, 'none');

  advance(30);
  assert.equal(flip.getSnapshot().angleDegrees, 0);
  assert.equal(flip.getSnapshot().transition, 'foldIn');

  advance(410);
  assert.equal(flip.getSnapshot().isBusy, false);
  assert.equal(flip.getSnapshot().transition, 'none');
});

void test('toggles are ignored while a flip is running', () => {
  const { flip, committed, advance } = setup();

  flip.request('system');
  advance(100);

  assert.equal(flip.request('studio'), false);
  assert.deepEqual(committed, ['system']);

  advance(600);
  assert.equal(flip.request('studio'), true);
});

void test('requesting the mode already shown does nothing', () => {
  const { flip, committed } = setup();

  assert.equal(flip.request('studio'), false);
  assert.deepEqual(committed, []);
});

void test('reduced motion swaps at once without rotating or locking', () => {
  const { flip } = setup({ isReducedMotion: true });

  flip.request('system');

  assert.equal(flip.getSnapshot().shownMode, 'system');
  assert.equal(flip.getSnapshot().angleDegrees, 0);
  assert.equal(flip.getSnapshot().isBusy, false);
  assert.equal(flip.getSnapshot().sweepCount, 0);
});

void test('snapTo cancels a running flip and shows the mode flat', () => {
  const { flip, advance } = setup();

  flip.request('system');
  flip.snapTo('studio');
  advance(1000);

  assert.deepEqual(flip.getSnapshot(), {
    shownMode: 'studio',
    angleDegrees: 0,
    transition: 'none',
    isBusy: false,
    sweepCount: 1,
  });
});

// === HELPERS ===

function setup({ isReducedMotion = false } = {}) {
  const committed: StudioMode[] = [];
  const clock = createFakeTimers();
  const flip = createModeFlip({
    initialMode: 'studio',
    commit: (mode) => {
      committed.push(mode);
    },
    prefersReducedMotion: () => isReducedMotion,
    timers: clock.timers,
  });

  return { flip, committed, advance: clock.advance };
}

function createFakeTimers(): { timers: ModeFlipTimers; advance: (ms: number) => void } {
  let now = 0;
  let nextHandle = 1;
  const queue = new Map<number, { at: number; callback: () => void }>();
  const nextDue = (until: number) =>
    [...queue]
      .filter(([, timer]) => timer.at <= until)
      .sort((a, b) => a[1].at - b[1].at)
      .at(0);

  return {
    timers: {
      setTimeout: (callback, delayMs) => {
        const handle = nextHandle++;

        queue.set(handle, { at: now + delayMs, callback });

        return handle;
      },
      clearTimeout: (handle) => {
        queue.delete(handle);
      },
    },
    advance(ms) {
      const until = now + ms;

      let due = nextDue(until);

      while (due !== undefined) {
        queue.delete(due[0]);
        now = due[1].at;
        due[1].callback();
        due = nextDue(until);
      }

      now = until;
    },
  };
}
