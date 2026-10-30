import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

void test(
  'design-system mode ships as its own chunk, outside the studio entry bundle',
  { skip: !existsSync('dist') },
  () => {
    const scripts = readdirSync('dist/assets').filter((file) => file.endsWith('.js'));
    const entryScripts = scripts.filter((file) => file.startsWith('index-'));

    assert.ok(scripts.some((file) => file.startsWith('system-mode-')));
    assert.ok(entryScripts.length > 0);

    for (const file of entryScripts) {
      assert.ok(
        !readFileSync(`dist/assets/${file}`, 'utf8').includes('These are the only colours'),
        `${file} carries the system registry; it should only load with the system-mode chunk.`,
      );
    }
  },
);
