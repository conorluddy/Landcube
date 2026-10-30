import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

for (const siteUrl of ['https://landcu.be/', 'https://example.com/studio/']) {
  void test(`production SEO URLs and crawl files agree for ${siteUrl}`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'landcube-seo-'));

    try {
      execFileSync(
        process.execPath,
        ['node_modules/vite/bin/vite.js', 'build', '--outDir', directory],
        {
          env: { ...process.env, LANDCUBE_SITE_URL: siteUrl },
          stdio: 'pipe',
        },
      );
      const html = readFileSync(join(directory, 'index.html'), 'utf8');

      assert.ok(html.includes(`<link rel="canonical" href="${siteUrl}"`));
      assert.ok(html.includes(`<meta property="og:url" content="${siteUrl}"`));
      const schemaMatch = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);

      assert.ok(schemaMatch);
      const schema: unknown = JSON.parse(schemaMatch[1]);

      assert.ok(schema !== null && typeof schema === 'object' && 'url' in schema);

      assert.equal(schema.url, siteUrl);
      assert.ok(
        readFileSync(join(directory, 'sitemap.xml'), 'utf8').includes(`<loc>${siteUrl}</loc>`),
      );
      assert.ok(
        readFileSync(join(directory, 'robots.txt'), 'utf8').includes(
          `Sitemap: ${siteUrl}sitemap.xml`,
        ),
      );
      assert.ok(html.includes(`content="${siteUrl}social-preview.png"`));
      const image = readFileSync(join(directory, 'social-preview.png'));

      assert.equal(image.readUInt32BE(16), 1200);
      assert.equal(image.readUInt32BE(20), 630);

      if (siteUrl !== 'https://landcu.be/') {
        assert.ok(!html.includes('https://landcu.be/'));
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
