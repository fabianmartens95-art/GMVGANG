import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  contentDigest,
  versionCssImports,
  versionHtmlAssets,
} from '../src/asset-versioning.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

test('content digest changes when asset content changes', () => {
  assert.match(contentDigest('body { color: red; }'), /^[a-f0-9]{16}$/);
  assert.notEqual(
    contentDigest('body { color: red; }'),
    contentDigest('body { color: blue; }'),
  );
});

test('HTML asset references receive deterministic content versions', () => {
  const html = '<link rel="stylesheet" href="/styles.css"><script src="/client.js"></script>';
  const output = versionHtmlAssets(html, {
    '/styles.css': 'aaaabbbbccccdddd',
    '/client.js': '1111222233334444',
  });

  assert.match(output, /href="\/styles\.css\?v=aaaabbbbccccdddd"/);
  assert.match(output, /src="\/client\.js\?v=1111222233334444"/);
  assert.doesNotMatch(output, /href="\/styles\.css"/);
});

test('CSS imports receive the dependency content version', () => {
  const css = '@import url("/tokens.css");\nbody { color: var(--gmv-color-off-white); }';
  const output = versionCssImports(css, {
    '/tokens.css': 'abcdef0123456789',
  });

  assert.match(output, /url\("\/tokens\.css\?v=abcdef0123456789"\)/);
});

test('unrelated external and local URLs remain untouched', () => {
  const html = '<a href="/terms/">Terms</a><script src="https://example.com/app.js"></script>';
  const output = versionHtmlAssets(html, {
    '/client.js': '1111222233334444',
  });
  assert.equal(output, html);
});

test('marketing source does not rely on manually bumped date-based asset versions', async () => {
  const sources = await Promise.all([
    readFile(join(root, 'scripts/build.mjs'), 'utf8'),
    readFile(join(root, 'src/brand-marketing-pages.mjs'), 'utf8'),
    readFile(join(root, 'src/creator-application-page.mjs'), 'utf8'),
  ]);
  const combined = sources.join('\n');
  assert.doesNotMatch(combined, /assetVersion\s*=\s*['"]/);
  assert.doesNotMatch(combined, /\?v=20\d{6}/);
  assert.match(combined, /contentDigest/);
  assert.match(combined, /versionHtmlAssets/);
});
