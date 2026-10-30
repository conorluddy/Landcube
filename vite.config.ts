import { defineConfig, loadEnv } from 'vite';

/** Keeps the built site portable across repository and custom-domain hosting. */
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'LANDCUBE_');
  const configuredUrl = environment.LANDCUBE_SITE_URL || 'https://landcu.be/';
  const urlError =
    'Invalid LANDCUBE_SITE_URL. Set an absolute HTTP(S) URL such as https://example.com/studio/ without credentials, query or fragment.';

  if (!URL.canParse(configuredUrl)) {
    throw new Error(urlError);
  }

  const siteUrl = new URL(configuredUrl);

  if (
    !['https:', 'http:'].includes(siteUrl.protocol) ||
    siteUrl.search ||
    siteUrl.hash ||
    siteUrl.username ||
    siteUrl.password
  ) {
    throw new Error(urlError);
  }

  if (!siteUrl.pathname.endsWith('/')) {
    siteUrl.pathname += '/';
  }

  const canonicalUrl = siteUrl.href;
  const markupUrl = canonicalUrl.replaceAll('&', '&amp;').replaceAll("'", '&#39;');

  return {
    base: './',
    plugins: [
      {
        name: 'site-seo',
        transformIndexHtml(html) {
          return html
            .replaceAll('__LANDCUBE_SITE_URL__', () => markupUrl)
            .replaceAll('__LANDCUBE_SITE_URL_JSON__', () => JSON.stringify(canonicalUrl));
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
            source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${markupUrl}</loc>\n  </url>\n</urlset>\n`,
          });
        },
      },
    ],
  };
});
