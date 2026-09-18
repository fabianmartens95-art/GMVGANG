import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  enhanceCreatorApplicationPage,
  LEGACY_CREATOR_CTA_URL,
  PORTAL_JOIN_URL,
  PORTAL_LOGIN_URL,
  SHOWCASE_STYLESHEET,
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
  assert.match(html, /href="https:\/\/app\.gmvgang\.de\/login\?next=%2Fcreator"[^>]*>Zum Portal-Login<\/a>/);
});

test('Creator page shows visual product previews for the live portal modules', () => {
  const html = creatorHtml();

  assert.ok(html.includes(SHOWCASE_STYLESHEET));
  assert.match(html, /So sieht dein Creator Workspace aus/);
  assert.match(html, /creator-preview-grid/);
  assert.match(html, /UI-Vorschau der aktuellen Portal-Struktur/);

  for (const feature of [
    'Creator-Profil',
    'Qualifizierung',
    'Matches & Campaigns',
    'Performance',
    'Referral Hub',
  ]) {
    assert.match(html, new RegExp(feature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(html, /@deinusername/);
  assert.match(html, /DEIN-CODE/);
  assert.match(html, /GMV<\/span><strong>—<\/strong>/);
  assert.match(html, /keine Performance-Claims/);
});

test('Creator page explains the portal workflow instead of the legacy application workflow', () => {
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
  assert.match(html, /Warum Portal statt Formular/);
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
