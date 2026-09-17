import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BRAND_LOGIN_URL,
  enhanceBrandPageForPlatform,
  enhanceHomepageForPlatform,
} from '../src/brand-marketing-pages.mjs';
import { pages, renderPage } from '../src/site.mjs';

const byPath = (path) => pages.find((page) => page.path === path);

function homepageHtml() {
  const page = byPath('/');
  assert.ok(page);
  return enhanceHomepageForPlatform(renderPage(page));
}

function brandHtml() {
  const page = byPath('/brands/');
  assert.ok(page);
  return enhanceBrandPageForPlatform(renderPage(page));
}

test('homepage positions GMVGANG as platform plus operations', () => {
  const html = homepageHtml();

  assert.match(html, /TikTok Shop Operating System für Brands & Creator/);
  assert.match(html, /TikTok Shop steuern\. Creator aktivieren\. Profitabilität verstehen\./);
  assert.match(html, /Eine Plattform\. Zwei Workspaces\./);
  assert.match(html, /BRAND WORKSPACE/);
  assert.match(html, /CREATOR WORKSPACE/);
  assert.match(html, /SERVICE LAYER/);
  assert.match(html, /Software \+ Operations/);
  assert.match(html, /Brand Workspace ansehen/);
  assert.match(html, new RegExp(BRAND_LOGIN_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, /brand-product-showcase\.css/);
});

test('brand page showcases only implemented Brand read-model capabilities as live', () => {
  const html = brandHtml();

  assert.match(html, /Steuern Sie TikTok Shop in einem System\./);
  assert.match(html, /Profitability Center/);
  assert.match(html, /Next Best Actions/);
  assert.match(html, /Performance & Data Coverage/);
  assert.match(html, /Tenant-geschütztes Overview/);
  assert.match(html, /serverseitige Organization-ID/);
  assert.match(html, /dargestellte Striche und Statusbeispiele sind keine Live-Kundendaten/);
  assert.match(html, new RegExp(BRAND_LOGIN_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('brand page clearly separates route-ready modules from finished functionality', () => {
  const html = brandHtml();

  assert.match(html, /Module im Ausbau/);
  for (const moduleName of ['Campaigns', 'Creator Intelligence', 'Approvals', 'Reporting']) {
    assert.match(html, new RegExp(moduleName));
  }
  assert.equal((html.match(/ROUTE READY/g) ?? []).length, 4);
  assert.match(html, /Fachlogik wird schrittweise ergänzt/);
  assert.match(html, /nicht als vollständig fertig dargestellt/);
});

test('brand and homepage no longer lead with the old agency-only positioning', () => {
  const home = homepageHtml();
  const brand = brandHtml();

  assert.doesNotMatch(home, /TikTok Shop skalieren\. Profitabel, transparent, creator‑getrieben\./);
  assert.doesNotMatch(brand, /TikTok Shop als Wachstumskanal – nicht als Einzelmaßnahme\./);
  assert.doesNotMatch(brand, /Unser Arbeitsmodell/);
});
