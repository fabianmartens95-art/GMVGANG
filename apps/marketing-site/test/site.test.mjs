import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pages, renderPage } from '../src/site.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const byPath = (path) => pages.find((page) => page.path === path);

test('migration contains all required public routes', () => {
  for (const path of ['/', '/brands/', '/creator/', '/ueber-gmvgang/', '/potenzialanalyse/', '/analyse-erhalten/', '/impressum/', '/datenschutz/']) {
    assert.ok(byPath(path), `missing ${path}`);
  }
});

test('preview build is globally noindex until final domain cutover', () => {
  for (const page of pages) {
    const html = renderPage(page);
    assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
  }
});

test('potential check preserves secure intake boundary', () => {
  const html = renderPage(byPath('/potenzialanalyse/'));
  assert.match(html, /id="pc-form"/);
  assert.match(html, /hook\.eu1\.make\.com\/pxnd9dc4dd9egwjsjerlxwbo2jpfam9t/);
  for (const field of ['potential_score', 'potential_band', 'potential_crm', 'tiktok_shop_crm', 'branche_crm', 'assessment_summary', 'source_url']) {
    assert.match(html, new RegExp(`name="${field}"`));
  }
});

test('client only routes to result after confirmed Make save and only transfers score/band', async () => {
  const source = await readFile(join(root, 'src/client.js'), 'utf8');
  assert.match(source, /result\.saved !== true/);
  assert.match(source, /query\.set\('score'/);
  assert.match(source, /query\.set\('band'/);
  assert.doesNotMatch(source, /query\.set\('email'/);
  assert.doesNotMatch(source, /query\.set\('contact_name'/);
  assert.doesNotMatch(source, /query\.set\('brand'/);
});

test('privacy copy reflects Cloudflare migration and no longer describes Webflow as hosting', () => {
  const html = renderPage(byPath('/datenschutz/'));
  assert.match(html, /Cloudflare Pages/);
  assert.match(html, /Make/);
  assert.match(html, /Notion/);
  assert.doesNotMatch(html, /Website wird mit Webflow bereitgestellt/);
});
