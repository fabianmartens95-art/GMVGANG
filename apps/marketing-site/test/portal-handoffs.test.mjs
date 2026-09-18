import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BRAND_LOGIN_URL, enhanceBrandPageForPlatform } from '../src/brand-marketing-pages.mjs';
import { PORTAL_JOIN_URL, PORTAL_LOGIN_URL, enhanceCreatorApplicationPage } from '../src/creator-application-page.mjs';
import { pages, renderPage } from '../src/site.mjs';

const byPath = (path) => pages.find((page) => page.path === path);

test('global public navigation exposes the canonical Portal login', () => {
  const page = byPath('/');
  assert.ok(page);
  const html = renderPage(page);
  assert.match(html, /href="https:\/\/app\.gmvgang\.de\/login">Portal Login<\/a>/);
});

test('Brand marketing login returns authenticated users to the Brand workspace', () => {
  assert.equal(BRAND_LOGIN_URL, 'https://app.gmvgang.de/login?next=%2Fbrand');
  const page = byPath('/brands/');
  assert.ok(page);
  const html = enhanceBrandPageForPlatform(renderPage(page));
  assert.ok(html.includes(BRAND_LOGIN_URL));
});

test('Creator marketing keeps registration on join and login returns to the Creator workspace', () => {
  assert.equal(PORTAL_JOIN_URL, 'https://app.gmvgang.de/join');
  assert.equal(PORTAL_LOGIN_URL, 'https://app.gmvgang.de/login?next=%2Fcreator');
  const page = byPath('/creator/');
  assert.ok(page);
  const html = enhanceCreatorApplicationPage(renderPage(page));
  assert.ok(html.includes(PORTAL_JOIN_URL));
  assert.ok(html.includes(PORTAL_LOGIN_URL));
});
