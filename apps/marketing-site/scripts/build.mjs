import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enhanceCreatorApplicationPage } from '../src/creator-application-page.mjs';
import { pages, renderPage } from '../src/site.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dist = join(root, 'dist');
const src = join(root, 'src');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(join(src, 'styles.css'), join(dist, 'styles.css'));
await cp(join(src, 'client.js'), join(dist, 'client.js'));
await cp(join(src, 'creator-application.css'), join(dist, 'creator-application.css'));
await cp(join(src, 'creator-application.js'), join(dist, 'creator-application.js'));

for (const page of pages) {
  const targetDir = page.path === '/' ? dist : join(dist, page.path.replace(/^\//, ''));
  await mkdir(targetDir, { recursive: true });
  const rendered = renderPage(page);
  const output = page.path === '/creator/' ? enhanceCreatorApplicationPage(rendered) : rendered;
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
  `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n`,
  'utf8',
);

await writeFile(
  join(dist, '404.html'),
  renderPage({
    path: '/404',
    title: 'Seite nicht gefunden | GMVGANG',
    description: 'Die angeforderte Seite wurde nicht gefunden.',
    eyebrow: '404',
    heading: 'Diese Seite gibt es nicht.',
    lead: 'Zurück zur GMVGANG Startseite.',
    body: '<p><a class="button button-primary" href="/">Zur Startseite</a></p>',
    index: false,
  }),
  'utf8',
);

console.log(`Built ${pages.length} GMVGANG marketing pages into ${dist}`);
