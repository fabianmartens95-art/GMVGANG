import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  enhanceCreatorApplicationPage,
  LEGACY_CREATOR_CTA_URL,
  PORTAL_JOIN_URL,
  PORTAL_LOGIN_URL,
} from '../src/creator-application-page.mjs';
import { pages, renderPage } from '../src/site.mjs';

const creatorPage = pages.find((page) => page.path === '/creator/');

function creatorHtml() {
  assert.ok(creatorPage);
  return enhanceCreatorApplicationPage(renderPage(creatorPage));
}

test('Creator hero positions the Portal as the primary product', () => {
  const html = creatorHtml();

  assert.match(html, /<title>Creator Portal \| GMVGANG<\/title>/);
  assert.match(html, /GMVGANG Creator Portal/);
  assert.match(html, /Dein TikTok Shop Creator Hub\./);
  assert.match(html, /persönlichen GMVGANG Creator Workspace/);
  assert.match(html, /href="https:\/\/app\.gmvgang\.de\/join"[^>]*>Kostenlos als Creator starten<\/a>/);
  assert.match(html, /href="https:\/\/app\.gmvgang\.de\/login"[^>]*>Zum Portal-Login<\/a>/);
});

test('Creator page explains the live portal modules instead of the legacy application workflow', () => {
  const html = creatorHtml();

  for (const feature of [
    'Creator-Profil',
    'Qualifizierung',
    'Brand Matches',
    'Campaigns & Samples',
    'Performance',
    'Referral Hub',
  ]) {
    assert.match(html, new RegExp(feature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(html, /operative GMV-, Order-, Commission- und Content-Werte/);
  assert.match(html, /TikTok-verifizierte Datensynchronisierung wird separat weiter ausgebaut/);
  assert.match(html, /Account statt Formular-Chaos/);
  assert.doesNotMatch(html, /So läuft es ab/);
  assert.doesNotMatch(html, /Schnellbewerbung/);
  assert.doesNotMatch(html, /Vertrag & Match/);
});

test('Creator public journey no longer exposes Tally', () => {
  const html = creatorHtml();

  assert.ok(html.includes(PORTAL_JOIN_URL));
  assert.ok(html.includes(PORTAL_LOGIN_URL));
  assert.doesNotMatch(html, new RegExp(LEGACY_CREATOR_CTA_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(html, /tally\.so/i);
});

test('Creator page enhancement fails closed if the legacy migration markers disappear', () => {
  assert.throws(
    () => enhanceCreatorApplicationPage('<html><head></head><body><main></main></body></html>'),
    /CREATOR_LEGACY_CTA_NOT_FOUND/,
  );
});
