import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pages, renderPage, SITE_INDEXABLE } from '../src/site.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const byPath = (path) => pages.find((page) => page.path === path);

test('migration contains all required public routes', () => {
  for (const path of ['/', '/brands/', '/creator/', '/ueber-gmvgang/', '/potenzialanalyse/', '/analyse-erhalten/', '/impressum/', '/datenschutz/']) {
    assert.ok(byPath(path), `missing ${path}`);
  }
});

test('preview build is globally noindex until final domain cutover', () => {
  assert.equal(SITE_INDEXABLE, false);
  for (const page of pages) {
    const html = renderPage(page);
    assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
  }
});

test('potential check is eligible for production indexing once global gate is enabled', () => {
  assert.notEqual(byPath('/potenzialanalyse/').index, false);
});

test('potential check preserves native intake boundary without Make fallback', () => {
  const html = renderPage(byPath('/potenzialanalyse/'));
  assert.match(html, /id="pc-form"/);
  assert.doesNotMatch(html, /hook\.eu1\.make\.com/);
  assert.doesNotMatch(html, /make\.com/i);
  for (const field of ['potential_score', 'potential_band', 'potential_crm', 'tiktok_shop_crm', 'branche_crm', 'assessment_summary', 'source_url']) {
    assert.match(html, new RegExp(`name="${field}"`));
  }
});

test('client allows real writes only on production domains', async () => {
  const source = await readFile(join(root, 'src/client.js'), 'utf8');
  assert.match(source, /new Set\(\['gmvgang\.de', 'www\.gmvgang\.de'\]\)/);
  assert.match(source, /if \(!productionHost\)/);
  assert.match(source, /Vorschau-\/Testmodus: Der echte Formularversand ist nur auf gmvgang\.de freigeschaltet/);
  assert.doesNotMatch(source, /hostname\.endsWith\('\.pages\.dev'\)/);
});

test('mobile navigation can be closed with Escape and restores focus', async () => {
  const source = await readFile(join(root, 'src/client.js'), 'utf8');
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /menuButton\.focus\(\)/);
});

test('client only routes to result after confirmed native save and only transfers score/band', async () => {
  const source = await readFile(join(root, 'src/client.js'), 'utf8');
  assert.match(source, /result\.saved !== true/);
  assert.match(source, /query\.set\('score'/);
  assert.match(source, /query\.set\('band'/);
  assert.doesNotMatch(source, /query\.set\('email'/);
  assert.doesNotMatch(source, /query\.set\('contact_name'/);
  assert.doesNotMatch(source, /query\.set\('brand'/);
});

test('privacy copy reflects the current Cloudflare and Supabase intake stack', () => {
  const html = renderPage(byPath('/datenschutz/'));
  assert.match(html, /Cloudflare Pages/);
  assert.match(html, /Supabase/);
  assert.match(html, /Notion/);
  assert.doesNotMatch(html, /Make/);
  assert.doesNotMatch(html, /Website wird mit Webflow bereitgestellt/);
});
