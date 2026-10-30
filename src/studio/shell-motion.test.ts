import assert from 'node:assert/strict';
import test from 'node:test';
import { createShellMotion } from './shell-motion';

function fakeShell() {
  const attributes = new Map<string, string>();

  return {
    attributes,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    removeAttribute: (name: string) => void attributes.delete(name),
  };
}

void test('turntable and morph holds leave glass blur alone by default', () => {
  const shell = fakeShell();
  const motion = createShellMotion(() => shell as unknown as Element);

  motion.setHeld('turntable', true);
  motion.setHeld('morph', true);
  motion.pulse();
  assert.equal(shell.attributes.has('data-motion'), false);

  motion.setHeld('turntable', false);
  motion.setHeld('morph', false);
  assert.equal(shell.attributes.has('data-motion'), false);
});
