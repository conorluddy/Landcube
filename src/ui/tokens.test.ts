import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Remove this test when `design/` is retired: until then the handoff file stays the source of truth.
void test('src/ui/tokens.css is a byte-for-byte copy of design/tokens.css', () => {
  const handoffTokens = readFileSync(new URL('../../design/tokens.css', import.meta.url));
  const shippedTokens = readFileSync(new URL('./tokens.css', import.meta.url));

  assert.ok(
    handoffTokens.equals(shippedTokens),
    'Re-copy design/tokens.css to src/ui/tokens.css (cp design/tokens.css src/ui/tokens.css).',
  );
});
