import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enhanceBrandPageForPlatform, enhanceHomepageForPlatform } from '../src/brand-marketing-pages.mjs';
import { enhanceCreatorApplicationPage } from '../src/creator-application-page.mjs';
import { pages, renderPage } from '../src/site.mjs';
import { contentDigest, versionCssImports, versionHtmlAssets } from '../src/asset-versioning.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const repoRoot = join(root, '..', '..');
const dist = join(root, 'dist');
const src = join(root, 'src');
const designSystemTokens = join(repoRoot, 'packages', 'design-system', 'tokens.css');

const assetSourcePaths = {
  '/tokens.css': designSystemTokens,
  '/styles.css': join(src, 'styles.css'),
  '/client.js': join(src, 'client.js'),
  '/creator-application.css': join(src, 'creator-application.css'),
  '/creator-application.js': join(src, 'creator-application.js'),
  '/creator-portal-showcase.css': join(src, 'creator-portal-showcase.css'),
  '/brand-product-showcase.css': join(src, 'brand-product-showcase.css'),
};

const assetContents = Object.fromEntries(
  await Promise.all(
    Object.entries(assetSourcePaths).map(async ([assetPath, sourcePath]) => [
      assetPath,
      await readFile(sourcePath, 'utf8'),
    ]),
  ),
);

const tokenVersion = contentDigest(assetContents['/tokens.css']);
assetContents['/styles.css'] = versionCssImports(assetContents['/styles.css'], {
  '/tokens.css': tokenVersion,
});

const assetVersions = Object.fromEntries(
  Object.entries(assetContents).map(([assetPath, content]) => [assetPath, contentDigest(content)]),
);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const [assetPath, content] of Object.entries(assetContents)) {
  await writeFile(join(dist, assetPath.slice(1)), content, 'utf8');
}

for (const page of pages) {
  const targetDir = page.path === '/' ? dist : join(dist, page.path.replace(/^\//, ''));
  await mkdir(targetDir, { recursive: true });
  const rendered = renderPage(page);
  const enhanced = page.path === '/creator/'
    ? enhanceCreatorApplicationPage(rendered)
    : page.path === '/brands/'
      ? enhanceBrandPageForPlatform(rendered)
      : page.path === '/'
        ? enhanceHomepageForPlatform(rendered)
        : rendered;
  const output = versionHtmlAssets(enhanced, assetVersions);
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
  versionHtmlAssets(renderPage({
    path: '/404',
    title: 'Seite nicht gefunden | GMVGANG',
    description: 'Die angeforderte Seite wurde nicht gefunden.',
    eyebrow: '404',
    heading: 'Diese Seite gibt es nicht.',
    lead: 'Zurück zur GMVGANG Startseite.',
    body: '<p><a class="button button-primary" href="/">Zur Startseite</a></p>',
    index: false,
  }), assetVersions),
  'utf8',
);

console.log(`Built ${pages.length} GMVGANG marketing pages into ${dist} with content-hashed asset versions`);
