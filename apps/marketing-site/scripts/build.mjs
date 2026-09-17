import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enhanceBrandPageForPlatform, enhanceHomepageForPlatform } from '../src/brand-marketing-pages.mjs';
import { enhanceCreatorApplicationPage } from '../src/creator-application-page.mjs';
import { pages, renderPage } from '../src/site.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const repoRoot = join(root, '..', '..');
const dist = join(root, 'dist');
const src = join(root, 'src');
const designSystemTokens = join(repoRoot, 'packages', 'design-system', 'tokens.css');
const assetVersion = '20260917-brand-product-v1';

function versionStaticAssets(html) {
  return html
    .replace('href="/styles.css"', `href="/styles.css?v=${assetVersion}"`)
    .replace('src="/client.js"', `src="/client.js?v=${assetVersion}` + '"');
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(designSystemTokens, join(dist, 'tokens.css'));
await cp(join(src, 'styles.css'), join(dist, 'styles.css'));
await cp(join(src, 'client.js'), join(dist, 'client.js'));
await cp(join(src, 'creator-application.css'), join(dist, 'creator-application.css'));
await cp(join(src, 'creator-application.js'), join(dist, 'creator-application.js'));
await cp(join(src, 'creator-portal-showcase.css'), join(dist, 'creator-portal-showcase.css'));
await cp(join(src, 'brand-product-showcase.css'), join(dist, 'brand-product-showcase.css'));

for (const page of pages) {
  const targetDir = page.path === '/' ? dist : join(dist, page.path.replace(/^\//, ''));
  await mkdir(targetDir, { recursive: true });
  const rendered = versionStaticAssets(renderPage(page));
  const output = page.path === '/creator/'
    ? enhanceCreatorApplicationPage(rendered)
    : page.path === '/brands/'
      ? enhanceBrandPageForPlatform(rendered)
      : page.path === '/'
        ? enhanceHomepageForPlatform(rendered)
        : rendered;
  await writeFile(join(targetDir, 'index.html'), output, 'utf8');
}

await writeFile(
  join(dist, 'robots.txt'),
  'User-agent: *\nAllow: /\nSitemap: https://gmvgang.de/sitemap.xml\n',
  'utf8',
);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
  .filter((page) => page.index !== false)
  .map((page) => `  <url><loc>https://gmvgang.de${page.path}</loc></url>`)
  .join('\n')}\n</urlset>\n`;
await writeFile(join(dist, 'sitemap.xml'), sitemap, 'utf8');

await writeFile(
  join(dist, '_headers'),
  `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n\n/styles.css\n  Cache-Control: no-cache\n/tokens.css\n  Cache-Control: no-cache\n/creator-portal-showcase.css\n  Cache-Control: no-cache\n/brand-product-showcase.css\n  Cache-Control: no-cache\n`,
  'utf8',
);

await writeFile(
  join(dist, '404.html'),
  versionStaticAssets(renderPage({
    path: '/404',
    title: 'Seite nicht gefunden | GMVGANG',
    description: 'Die angeforderte Seite wurde nicht gefunden.',
    eyebrow: '404',
    heading: 'Diese Seite gibt es nicht.',
    lead: 'Zurück zur GMVGANG Startseite.',
    body: '<p><a class="button button-primary" href="/">Zur Startseite</a></p>',
    index: false,
  })),
  'utf8',
);

console.log(`Built ${pages.length} GMVGANG marketing pages into ${dist}`);
