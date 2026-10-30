import { defineConfig, loadEnv } from 'vite';

/** Keeps the built site portable across repository and custom-domain hosting. */
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'LANDCUBE_');
  const siteUrl = new URL(environment.LANDCUBE_SITE_URL || 'https://landcu.be/');

  if (
    !['https:', 'http:'].includes(siteUrl.protocol) ||
    siteUrl.search ||
    siteUrl.hash ||
    siteUrl.username ||
    siteUrl.password
  ) {
    throw new Error(
      'LANDCUBE_SITE_URL must be an HTTP(S) URL without credentials, query or fragment.',
    );
  }

  if (!siteUrl.pathname.endsWith('/')) {
    siteUrl.pathname += '/';
  }

  const canonicalUrl = siteUrl.href;

  return {
    base: './',
    plugins: [
      {
        name: 'site-seo',
        transformIndexHtml(html) {
          return html.replaceAll('https://landcu.be/', canonicalUrl);
        },
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'robots.txt',
            source: `User-agent: *\nAllow: /\n\nSitemap: ${canonicalUrl}sitemap.xml\n`,
          });
          this.emitFile({
            type: 'asset',
            fileName: 'sitemap.xml',
            source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${canonicalUrl}</loc>\n  </url>\n</urlset>\n`,
          });
        },
      },
    ],
  };
});
