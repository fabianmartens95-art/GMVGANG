const LEGACY_CREATOR_CTA_URL = 'https://tally.so/r/68BbAO';
const PORTAL_JOIN_URL = 'https://app.gmvgang.de/join';
const PORTAL_LOGIN_URL = 'https://app.gmvgang.de/login';

const legacyCreatorBody = `
      <section class="section">
        <h2>So läuft es ab</h2>
        <div class="card-grid"><article class="card"><h3>1 · Schnellbewerbung</h3><p>Du gibst uns die wichtigsten Angaben zu deinem TikTok-Profil.</p></article><article class="card"><h3>2 · Profil & Screening</h3><p>Wir prüfen Fit, Aktivität und mögliche Produktkategorien.</p></article><article class="card"><h3>3 · Gespräch</h3><p>Wenn es passt, klären wir Zusammenarbeit und Erwartungen.</p></article><article class="card"><h3>4 · Vertrag & Match</h3><p>Nach der Aktivierung matchen wir dich mit passenden Brands und Produkten.</p></article><article class="card"><h3>5 · Sample & Briefing</h3><p>Du erhältst Produkt und klare Vorgaben für die Zusammenarbeit.</p></article><article class="card"><h3>6 · Content & Performance</h3><p>Content geht live und die Performance wird nachvollziehbar erfasst.</p></article></div>
      </section>
      <section class="section section-dark">
        <h2>Grundvoraussetzungen</h2>
        <p>Du bist mindestens 18 Jahre alt, auf TikTok aktiv und arbeitest zuverlässig. Entscheidend ist nicht nur Reichweite, sondern auch Produktfit und Umsetzungsqualität.</p>
      </section>`;

const creatorPortalBody = `
      <section class="section">
        <p class="kicker">Dein Creator Workspace</p>
        <h2>Ein Portal. Dein kompletter Creator-Workflow.</h2>
        <p>Der bisherige Formularprozess wird durch einen eigenen GMVGANG Creator Workspace ersetzt. Du verwaltest deinen Zugang und die für dich freigeschalteten Creator-Funktionen direkt im Portal.</p>
        <div class="card-grid">
          <article class="card"><h3>Creator-Profil</h3><p>Verwalte TikTok-Username, Anzeigename, Markt, Content-Sprache und deine Kategorien. Dein Profil zeigt außerdem Status und Vollständigkeit.</p></article>
          <article class="card"><h3>Qualifizierung</h3><p>Erfasse TikTok-Shop-Status, Content-Formate, LIVE-Erfahrung, Produktkategorien und deine realistische Content-Kapazität direkt im Portal.</p></article>
          <article class="card"><h3>Brand Matches</h3><p>Freigegebene Matches erscheinen in deinem persönlichen Workspace. Interne Scores und Daten anderer Creator bleiben geschützt.</p></article>
          <article class="card"><h3>Campaigns & Samples</h3><p>Behalte aktive Campaigns sowie Sample- und Content-Status an einem Ort im Blick – vom Briefing bis zum veröffentlichten Content.</p></article>
          <article class="card"><h3>Performance</h3><p>Soweit verfügbar, siehst du operative GMV-, Order-, Commission- und Content-Werte. TikTok-verifizierte Datensynchronisierung wird separat weiter ausgebaut.</p></article>
          <article class="card"><h3>Referral Hub</h3><p>Nutze deinen persönlichen Referral-Link und verfolge attribuierte Empfehlungen und deren Meilensteine. Rewards werden erst über eine separate Freigabe aktiviert.</p></article>
        </div>
      </section>

      <section class="section section-dark">
        <p class="kicker">Neuer Einstieg</p>
        <h2>Account statt Formular-Chaos.</h2>
        <p>Du startest direkt im Portal. Nach dem Account-Aufbau vervollständigst du dein Creator-Profil und durchläufst die Qualifizierung. Danach werden dir nur die Bereiche und Daten angezeigt, die für deinen Creator-Status freigeschaltet sind.</p>
        <div class="card-grid">
          <article class="card"><h3>01 · Account erstellen</h3><p>Starte über den öffentlichen Creator-Zugang und lege deinen GMVGANG Account an.</p></article>
          <article class="card"><h3>02 · Profil vervollständigen</h3><p>Hinterlege deine Creator-Basisdaten und baue eine saubere Grundlage für Matching und Zusammenarbeit auf.</p></article>
          <article class="card"><h3>03 · Qualifizierung abschließen</h3><p>Ergänze Shop-, Content- und Verfügbarkeitsdaten. Die interne Freigabe erfolgt anschließend separat.</p></article>
        </div>
      </section>

      <section class="section">
        <p class="kicker">Transparenz statt Blackbox</p>
        <h2>Du siehst, was für dich relevant ist.</h2>
        <div class="card-grid">
          <article class="card"><h3>Eigener Status</h3><p>Dein Profil und deine Qualifizierung zeigen deinen aktuellen Fortschritt, ohne interne Operations-Daten offenzulegen.</p></article>
          <article class="card"><h3>Freigegebene Opportunities</h3><p>Matches und Campaigns werden erst sichtbar, wenn sie für deinen Account freigegeben und ausführbar sind.</p></article>
          <article class="card"><h3>Messbare Entwicklung</h3><p>Performance- und Campaign-Daten werden schrittweise zentralisiert, statt über verstreute Formulare, Chats und Tabellen zu laufen.</p></article>
        </div>
      </section>

      <section id="creator-portal" class="section section-dark" aria-labelledby="creator-portal-heading">
        <p class="kicker">GMVGANG Creator Portal</p>
        <h2 id="creator-portal-heading">Starte direkt in deinem Creator Workspace.</h2>
        <p>Erstelle deinen Account, vervollständige dein Profil und nutze den neuen GMVGANG Creator Workflow direkt im Portal.</p>
        <div class="action-row">
          <a class="button button-primary" href="${PORTAL_JOIN_URL}">Kostenlos als Creator starten</a>
          <a class="button button-secondary" href="${PORTAL_LOGIN_URL}">Bereits registriert? Zum Portal</a>
        </div>
      </section>`;

export function enhanceCreatorApplicationPage(html) {
  if (typeof html !== 'string' || !html.includes('</main>')) {
    throw new Error('CREATOR_PAGE_MARKUP_INVALID');
  }

  const legacyAction = `<div class="action-row"><a class="button button-primary" href="${LEGACY_CREATOR_CTA_URL}">Als Creator bewerben</a></div>`;
  if (!html.includes(legacyAction)) {
    throw new Error('CREATOR_LEGACY_CTA_NOT_FOUND');
  }
  if (!html.includes(legacyCreatorBody)) {
    throw new Error('CREATOR_LEGACY_BODY_NOT_FOUND');
  }

  const portalActions = `<div class="action-row"><a class="button button-primary" href="${PORTAL_JOIN_URL}">Kostenlos als Creator starten</a><a class="button button-secondary" href="${PORTAL_LOGIN_URL}">Zum Portal-Login</a></div>`;

  return html
    .replace('<title>Für Creator | GMVGANG</title>', '<title>Creator Portal | GMVGANG</title>')
    .replace(
      '<meta name="description" content="Passende Brands, passende Produkte und klare Zusammenarbeit für TikTok Shop Creator.">',
      '<meta name="description" content="GMVGANG Creator Portal für TikTok Shop Creator: Profil, Qualifizierung, Matches, Campaigns, Performance und Referrals in einem Workspace.">',
    )
    .replace('<p class="eyebrow">Für Creator</p>', '<p class="eyebrow">GMVGANG Creator Portal</p>')
    .replace('<h1>Passende Brands. Passende Produkte. Klare Zusammenarbeit.</h1>', '<h1>Dein TikTok Shop Creator Hub.</h1>')
    .replace(
      '<p class="hero-lead">Wir bringen Creator mit Produkten zusammen, die zum Content, zur Community und zur Arbeitsweise passen.</p>',
      '<p class="hero-lead">Profil, Qualifizierung, Brand Matches, Campaigns, Performance und Referrals – gebündelt in deinem persönlichen GMVGANG Creator Workspace.</p>',
    )
    .replace(legacyAction, portalActions)
    .replace(legacyCreatorBody, creatorPortalBody);
}

export { LEGACY_CREATOR_CTA_URL, PORTAL_JOIN_URL, PORTAL_LOGIN_URL };
