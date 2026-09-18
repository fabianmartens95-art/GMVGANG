const LEGACY_CREATOR_CTA_URL = 'https://tally.so/r/68BbAO';
const PORTAL_JOIN_URL = 'https://app.gmvgang.de/join';
const PORTAL_LOGIN_URL = 'https://app.gmvgang.de/login?next=%2Fcreator';
const SHOWCASE_STYLESHEET = '/creator-portal-showcase.css';

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
      <section class="section creator-showcase" aria-labelledby="creator-showcase-heading">
        <div class="creator-showcase__intro">
          <p class="kicker">Portal Vorschau</p>
          <h2 id="creator-showcase-heading">So sieht dein Creator Workspace aus.</h2>
          <p>Deine wichtigsten Creator-Prozesse laufen in einem zentralen Workspace: Profil, Qualifizierung, Matches, Campaigns, Performance und Referrals.</p>
          <p class="creator-showcase__note">UI-Vorschau der aktuellen Portal-Struktur. Angezeigte Namen, Werte und Status sind neutrale Platzhalter und keine Performance-Claims.</p>
        </div>

        <div class="creator-preview-grid" aria-label="Vorschau der Creator Portal Module">
          <article class="creator-preview-card">
            <div class="creator-preview-card__meta"><strong>Creator-Profil</strong><span class="creator-preview-card__badge">Beispielansicht</span></div>
            <div class="creator-window">
              <aside class="creator-window__nav" aria-hidden="true">
                <div class="creator-window__brand">GMVGANG</div>
                <span>Übersicht</span><span data-active="true">Profil</span><span>Qualifizierung</span><span>Matches</span><span>Campaigns</span>
              </aside>
              <div class="creator-window__main">
                <div class="creator-window__topline"><span class="creator-window__eyebrow">Creator Identity</span><span class="creator-window__status">Account geschützt</span></div>
                <h3>@deinusername</h3>
                <p class="creator-window__lead">Deine Basis für Matching, Qualifizierung und Zusammenarbeit.</p>
                <div class="creator-ui-grid">
                  <div class="creator-ui-card creator-ui-card--wide"><span>Profilvollständigkeit</span><strong>Dein Fortschritt</strong><div class="creator-progress"><span></span></div></div>
                  <div class="creator-ui-card"><span>Markt</span><strong>Dein Markt</strong></div>
                  <div class="creator-ui-card"><span>Content-Sprache</span><strong>Deine Sprache</strong></div>
                  <div class="creator-ui-card creator-ui-card--wide"><span>Kategorien</span><div class="creator-chip-row"><span class="creator-chip">Kategorie 1</span><span class="creator-chip">Kategorie 2</span><span class="creator-chip">Kategorie 3</span></div></div>
                </div>
              </div>
            </div>
            <div class="creator-preview-card__copy"><h3>Dein Profil als zentrale Identität</h3><p>Verwalte TikTok-Username, Anzeigename, Markt, Sprache und Kategorien. Dein Profil zeigt außerdem Status und Fortschritt.</p></div>
          </article>

          <article class="creator-preview-card">
            <div class="creator-preview-card__meta"><strong>Qualifizierung</strong><span class="creator-preview-card__badge">Beispielansicht</span></div>
            <div class="creator-window">
              <aside class="creator-window__nav" aria-hidden="true">
                <div class="creator-window__brand">GMVGANG</div>
                <span>Übersicht</span><span>Profil</span><span data-active="true">Qualifizierung</span><span>Matches</span><span>Campaigns</span>
              </aside>
              <div class="creator-window__main">
                <div class="creator-window__topline"><span class="creator-window__eyebrow">Creator Qualification</span><span class="creator-window__status">R2</span></div>
                <h3>Shop, Content & Umsetzung</h3>
                <p class="creator-window__lead">Deine Angaben ersetzen schrittweise verstreute Formulare.</p>
                <div class="creator-status-list">
                  <div class="creator-status-row"><strong>TikTok Shop</strong><span>DEINE ANGABE</span></div>
                  <div class="creator-status-row"><strong>Content-Formate</strong><span>VIDEO · LIVE · UGC</span></div>
                  <div class="creator-status-row"><strong>Produktkategorien</strong><span>1–3 AUSWAHLEN</span></div>
                  <div class="creator-status-row"><strong>Content-Kapazität</strong><span>PRO WOCHE</span></div>
                </div>
              </div>
            </div>
            <div class="creator-preview-card__copy"><h3>Qualifizierung direkt im Portal</h3><p>Erfasse Shop-Status, Content-Formate, LIVE-Erfahrung, Kategorien und deine realistische Produktionskapazität.</p></div>
          </article>

          <article class="creator-preview-card">
            <div class="creator-preview-card__meta"><strong>Matches & Campaigns</strong><span class="creator-preview-card__badge">Beispielansicht</span></div>
            <div class="creator-window">
              <aside class="creator-window__nav" aria-hidden="true">
                <div class="creator-window__brand">GMVGANG</div>
                <span>Übersicht</span><span>Profil</span><span>Qualifizierung</span><span data-active="true">Matches</span><span>Campaigns</span>
              </aside>
              <div class="creator-window__main">
                <div class="creator-window__topline"><span class="creator-window__eyebrow">Opportunities</span><span class="creator-window__status">Nur freigegebene Daten</span></div>
                <h3>Deine Opportunities</h3>
                <p class="creator-window__lead">Matches und Campaigns werden accountbezogen freigeschaltet.</p>
                <div class="creator-status-list">
                  <div class="creator-status-row"><strong>Brand Match</strong><span>FREIGEGEBEN</span></div>
                  <div class="creator-status-row"><strong>Sample</strong><span>STATUS SICHTBAR</span></div>
                  <div class="creator-status-row"><strong>Briefing & Content</strong><span>NÄCHSTER SCHRITT</span></div>
                  <div class="creator-status-row"><strong>Campaign Verlauf</strong><span>ZENTRAL</span></div>
                </div>
              </div>
            </div>
            <div class="creator-preview-card__copy"><h3>Vom Match bis zum veröffentlichten Content</h3><p>Behalte freigegebene Matches, Campaigns, Sample-Status und Content-Fortschritt an einem Ort im Blick.</p></div>
          </article>

          <article class="creator-preview-card">
            <div class="creator-preview-card__meta"><strong>Performance</strong><span class="creator-preview-card__badge">Operativ</span></div>
            <div class="creator-window">
              <aside class="creator-window__nav" aria-hidden="true">
                <div class="creator-window__brand">GMVGANG</div>
                <span>Übersicht</span><span>Matches</span><span>Campaigns</span><span data-active="true">Performance</span><span>Referrals</span>
              </aside>
              <div class="creator-window__main">
                <div class="creator-window__topline"><span class="creator-window__eyebrow">Performance</span><span class="creator-window__status">Provisional</span></div>
                <h3>Entwicklung im Blick</h3>
                <div class="creator-sync-banner">Operative Portalwerte werden zentralisiert. TikTok-verifizierte Datensynchronisierung wird separat weiter ausgebaut.</div>
                <div class="creator-kpi-grid">
                  <div class="creator-kpi"><span>GMV</span><strong>—</strong></div>
                  <div class="creator-kpi"><span>Orders</span><strong>—</strong></div>
                  <div class="creator-kpi"><span>Commission</span><strong>—</strong></div>
                  <div class="creator-kpi"><span>Content</span><strong>—</strong></div>
                </div>
                <div class="creator-status-row"><strong>Campaign Performance</strong><span>WENN VERFÜGBAR</span></div>
              </div>
            </div>
            <div class="creator-preview-card__copy"><h3>Performance ohne erfundene Zahlen</h3><p>Soweit Daten verfügbar sind, bündelt das Portal operative GMV-, Order-, Commission- und Content-Werte. Nicht verifizierte Werte werden entsprechend gekennzeichnet.</p></div>
          </article>

          <article class="creator-preview-card creator-preview-card--wide">
            <div class="creator-preview-card__meta"><strong>Referral Hub</strong><span class="creator-preview-card__badge">Creator → Creator</span></div>
            <div class="creator-window">
              <aside class="creator-window__nav" aria-hidden="true">
                <div class="creator-window__brand">GMVGANG</div>
                <span>Übersicht</span><span>Campaigns</span><span>Performance</span><span data-active="true">Referrals</span><span>Profil</span>
              </aside>
              <div class="creator-window__main">
                <div class="creator-window__topline"><span class="creator-window__eyebrow">Referral Hub</span><span class="creator-window__status">Persönlicher Link</span></div>
                <h3>Creator empfehlen. Fortschritt sehen.</h3>
                <p class="creator-window__lead">Dein persönlicher Referral-Link und die attribuierten Meilensteine an einem Ort.</p>
                <div class="creator-referral-link"><span>app.gmvgang.de/join?ref=</span><b>DEIN-CODE</b></div>
                <div class="creator-milestones">
                  <div class="creator-milestone"><strong>01</strong><span>Registriert</span></div>
                  <div class="creator-milestone"><strong>02</strong><span>Qualifiziert</span></div>
                  <div class="creator-milestone"><strong>03</strong><span>Aktiv</span></div>
                  <div class="creator-milestone"><strong>04</strong><span>Performing</span></div>
                </div>
              </div>
            </div>
            <div class="creator-preview-card__copy"><h3>Referral Hub mit nachvollziehbaren Meilensteinen</h3><p>Nutze deinen persönlichen Link und verfolge attribuierte Empfehlungen. Rewards werden erst über eine separate, kontrollierte Freigabe aktiviert.</p></div>
          </article>
        </div>

        <div class="creator-value-strip">
          <article><strong>Ein Account</strong><span>Deine Creator-Identität bleibt zentral statt über Formulare und Chats verteilt.</span></article>
          <article><strong>Klare nächste Schritte</strong><span>Profil, Qualifizierung, Matches und Campaigns bauen logisch aufeinander auf.</span></article>
          <article><strong>Nur relevante Daten</strong><span>Du siehst deine freigegebenen Bereiche – keine fremden Creator- oder internen Operations-Daten.</span></article>
        </div>

        <div class="action-row">
          <a class="button button-primary" href="${PORTAL_JOIN_URL}">Kostenlos als Creator starten</a>
          <a class="button button-secondary" href="${PORTAL_LOGIN_URL}">Bereits registriert? Zum Portal</a>
        </div>
      </section>

      <section class="section">
        <p class="kicker">Dein Creator Workspace</p>
        <h2>Was du im Portal erledigen kannst.</h2>
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
        <p class="kicker">Warum Portal statt Formular</p>
        <h2>Die Zusammenarbeit endet nicht nach der Registrierung.</h2>
        <div class="card-grid">
          <article class="card"><h3>Persistentes Profil</h3><p>Deine Angaben bleiben Teil deines Accounts und müssen nicht bei jedem neuen Prozess erneut übermittelt werden.</p></article>
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
    .replace('</head>', `  <link rel="stylesheet" href="${SHOWCASE_STYLESHEET}">\n</head>`)
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

export { LEGACY_CREATOR_CTA_URL, PORTAL_JOIN_URL, PORTAL_LOGIN_URL, SHOWCASE_STYLESHEET };
