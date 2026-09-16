import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { enhanceCreatorApplicationPage, TALLY_FALLBACK_URL } from '../src/creator-application-page.mjs';
import { pages, renderPage } from '../src/site.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const creatorPage = pages.find((page) => page.path === '/creator/');

test('Creator primary CTA is converted from Tally to the native application section', () => {
  assert.ok(creatorPage);
  const html = enhanceCreatorApplicationPage(renderPage(creatorPage));

  assert.match(html, /href="#creator-bewerbung"[^>]*>Als Creator bewerben<\/a>/);
  assert.match(html, /id="creator-bewerbung"/);
  assert.match(html, /id="creator-application-form"/);
  assert.match(html, /data-api-origin="https:\/\/app\.gmvgang\.de"/);
  assert.match(html, /src="\/creator-application\.js"/);
  assert.match(html, /href="\/creator-application\.css"/);
});

test('native Creator application preserves required intake and consent fields', () => {
  const html = enhanceCreatorApplicationPage(renderPage(creatorPage));
  for (const field of [
    'displayName',
    'tiktokHandle',
    'email',
    'phone',
    'followerBand',
    'tiktokShopExperience',
    'contentCategories',
    'ageConfirmed',
    'privacyAccepted',
    'privacyNoticeVersion',
    'referralCode',
    'company',
  ]) {
    assert.match(html, new RegExp(`name="${field}"`));
  }
  assert.match(html, /1–5 auswählen/);
  assert.match(html, /mindestens 18 Jahre alt/);
  assert.match(html, /href="\/datenschutz\/"/);
});

test('Tally remains a fallback only during migration', () => {
  const html = enhanceCreatorApplicationPage(renderPage(creatorPage));
  const matches = html.match(new RegExp(TALLY_FALLBACK_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? [];
  assert.equal(matches.length, 3);
  assert.match(html, /data-fallback-url="https:\/\/tally\.so\/r\/68BbAO"/);
  assert.match(html, /Technischer Fallback während der Umstellung/);
});

test('Creator application client keeps PII in request body and uses idempotent platform submission', async () => {
  const source = await readFile(join(root, 'src/creator-application.js'), 'utf8');
  assert.match(source, /\/api\/public\/creator-application\/config/);
  assert.match(source, /'Idempotency-Key': idempotencyKey\(\)/);
  assert.match(source, /crypto\.randomUUID\(\)/);
  assert.match(source, /body: JSON\.stringify\(payload\)/);
  assert.match(source, /new URLSearchParams\(window\.location\.search\)\.get\('ref'\)/);
  assert.doesNotMatch(source, /query\.set\('email'/);
  assert.doesNotMatch(source, /query\.set\('phone'/);
  assert.doesNotMatch(source, /query\.set\('tiktokHandle'/);
});

test('Creator page enhancement fails closed if the expected migration CTA disappears', () => {
  assert.throws(
    () => enhanceCreatorApplicationPage('<html><head></head><body><main></main></body></html>'),
    /CREATOR_TALLY_CTA_NOT_FOUND/,
  );
});
