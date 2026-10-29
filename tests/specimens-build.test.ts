import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import test from 'node:test';

// dist/ only exists after `npm run build`; ci:local and test:e2e build first.
void test(
  'production dist contains no specimens page or bundle',
  { skip: !existsSync('dist') },
  () => {
    const distFiles = readdirSync('dist', { recursive: true, encoding: 'utf8' });

    assert.deepEqual(
      distFiles.filter((file) => file.includes('specimens')),
      [],
    );
  },
);
