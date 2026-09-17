import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  enhanceCreatorApplicationPage,
  PORTAL_JOIN_URL,
  PORTAL_LOGIN_URL,
  TALLY_FALLBACK_URL,
} from '../src/creator-application-page.mjs';
import { pages, renderPage } from '../src/site.mjs';

const creatorPage = pages.find((page) => page.path === '/creator/');

test('Creator primary CTA is routed from Tally to the portal join flow', () => {
  assert.ok(creatorPage);
  const html = enhanceCreatorApplicationPage(renderPage(creatorPage));

  assert.match(html, /href="https:\/\/app\.gmvgang\.de\/join"[^>]*>Kostenlos als Creator starten<\/a>/);
  assert.match(html, /id="creator-portal"/);
  assert.match(html, /GMVGANG Creator Portal/);
});

test('Creator page exposes both registration and returning-user portal access', () => {
  const html = enhanceCreatorApplicationPage(renderPage(creatorPage));

  assert.ok(html.includes(PORTAL_JOIN_URL));
  assert.ok(html.includes(PORTAL_LOGIN_URL));
  assert.match(html, /Bereits registriert\? Zum Portal/);
  assert.doesNotMatch(html, /id="creator-application-form"/);
  assert.doesNotMatch(html, /src="\/creator-application\.js"/);
});

test('Tally remains only as a technical fallback', () => {
  const html = enhanceCreatorApplicationPage(renderPage(creatorPage));
  const matches = html.match(new RegExp(TALLY_FALLBACK_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? [];

  assert.equal(matches.length, 1);
  assert.match(html, /Schnellbewerbung als Fallback öffnen/);
});

test('Creator page enhancement fails closed if the expected migration CTA disappears', () => {
  assert.throws(
    () => enhanceCreatorApplicationPage('<html><head></head><body><main></main></body></html>'),
    /CREATOR_TALLY_CTA_NOT_FOUND/,
  );
});
