const nav = [
  ['/brands/', 'Für Brands'],
  ['/creator/', 'Creator'],
  ['/ueber-gmvgang/', 'Über GMVGANG'],
];

const cards = (items) => `<div class="card-grid">${items
  .map(([title, text]) => `<article class="card"><h3>${title}</h3><p>${text}</p></article>`)
  .join('')}</div>`;

export const pages = [
  {
    path: '/',
    title: 'GMVGANG – TikTok Shop Growth für Brands',
    description: 'GMVGANG baut TikTok Shop für DTC- und E-Commerce-Brands als messbaren Vertriebskanal auf – creator-getrieben, transparent und wirtschaftlich.',
    eyebrow: 'TikTok Shop Growth System',
    heading: 'TikTok Shop skalieren. Profitabel, transparent, creator-getrieben.',
    lead: 'Wir bauen TikTok Shop für DTC- und E-Commerce-Brands als messbaren Vertriebskanal auf: mit passenden Creatorn, verkaufsfähigem Content, Affiliate und LIVE. Paid Media kommt erst dazu, wenn Produkt, Content und Wirtschaftlichkeit tragen.',
    actions: [
      ['/potenzialanalyse/', 'TikTok Shop Potenzial prüfen', 'primary'],
      ['/brands/', 'So arbeiten wir', 'secondary'],
    ],
    microcopy: '2–3 Min · Ergebnis direkt erhalten',
    body: `
      <section class="section">
        <p class="kicker">System statt Einzelmaßnahme</p>
        <h2>Creator · Content · Affiliate · LIVE · Paid Media · Aligned Growth</h2>
        ${cards([
          ['Creator', 'Passende Creator werden nicht nur nach Reichweite, sondern nach Produktfit, Zuverlässigkeit und Verkaufspotenzial ausgewählt.'],
          ['Content', 'Briefings, Hooks und Content werden auf TikTok-Shop-Conversion statt auf reine Views ausgerichtet.'],
          ['Economics', 'Skalierung folgt klaren Profitabilitätsgrenzen. Mehr Budget ist kein Ziel an sich.'],
        ])}
      </section>
      <section class="section section-dark">
        <p class="kicker">Aligned Growth</p>
        <h2>Erst validieren. Dann verstärken. Dann skalieren.</h2>
        <p>Wir priorisieren Produktfit, Creator-Match, Content-Performance und Unit Economics. Paid Media wird erst verstärkt, wenn die Grundlage trägt.</p>
      </section>
      <section class="section">
        <p class="kicker">Nächster Schritt</p>
        <h2>Wie viel TikTok-Shop-Potenzial steckt in Ihrer Brand?</h2>
        <p>Die Potenzialanalyse strukturiert Produkt, Creator-Fit, Economics und operative Voraussetzungen.</p>
        <a class="button button-primary" href="/potenzialanalyse/">Potenzial prüfen</a>
      </section>
    `,
  },
  {
    path: '/brands/',
    title: 'Für Brands | GMVGANG',
    description: 'TikTok Shop als Wachstumskanal: Strategie, Creator, Affiliate, Content, LIVE, Paid Media und Profitabilität in einem System.',
    eyebrow: 'Für Brands',
    heading: 'TikTok Shop als Wachstumskanal – nicht als Einzelmaßnahme.',
    lead: 'GMVGANG verbindet Strategie, Shop-Setup, Creator, Affiliate, Content, LIVE und Paid Media zu einem nachvollziehbaren Commerce-System.',
    actions: [['/potenzialanalyse/', 'TikTok Shop Potenzial prüfen', 'primary']],
    body: `
      <section class="section">
        <h2>Unser Arbeitsmodell</h2>
        ${cards([
          ['Strategie & Setup', 'Zielbild, Produktpriorisierung, Economics und operative Voraussetzungen klären.'],
          ['Creator & Affiliate', 'Creator identifizieren, aktivieren und entlang klarer Kriterien steuern.'],
          ['Videos & Briefings', 'Content systematisch auf Hooks, Produktargumente und Conversion ausrichten.'],
          ['LIVE', 'LIVE als Commerce-Format ergänzen, wenn Produkt und Creator dafür geeignet sind.'],
          ['Paid Media', 'Gewinner verstärken, statt ungeprüfte Creatives mit Budget zu überdecken.'],
          ['Evaluation', 'Performance, Profitabilität und nächste Maßnahmen regelmäßig bewerten.'],
        ])}
      </section>
      <section class="section section-dark">
        <h2>Erst validieren. Dann verstärken. Dann skalieren.</h2>
        <p>Budgeterhöhungen folgen vorher definierten Scaling Gates. Wenn Economics oder Creative nicht tragen, wird zuerst optimiert.</p>
      </section>
    `,
  },
  {
    path: '/creator/',
    title: 'Für Creator | GMVGANG',
    description: 'Passende Brands, passende Produkte und klare Zusammenarbeit für TikTok Shop Creator.',
    eyebrow: 'Für Creator',
    heading: 'Passende Brands. Passende Produkte. Klare Zusammenarbeit.',
    lead: 'Wir bringen Creator mit Produkten zusammen, die zum Content, zur Community und zur Arbeitsweise passen.',
    actions: [['https://tally.so/r/68BbAO', 'Als Creator bewerben', 'primary']],
    body: `
      <section class="section">
        <h2>So läuft es ab</h2>
        ${cards([
          ['1 · Schnellbewerbung', 'Du gibst uns die wichtigsten Angaben zu deinem TikTok-Profil.'],
          ['2 · Profil & Screening', 'Wir prüfen Fit, Aktivität und mögliche Produktkategorien.'],
          ['3 · Gespräch', 'Wenn es passt, klären wir Zusammenarbeit und Erwartungen.'],
          ['4 · Vertrag & Match', 'Nach der Aktivierung matchen wir dich mit passenden Brands und Produkten.'],
          ['5 · Sample & Briefing', 'Du erhältst Produkt und klare Vorgaben für die Zusammenarbeit.'],
          ['6 · Content & Performance', 'Content geht live und die Performance wird nachvollziehbar erfasst.'],
        ])}
      </section>
      <section class="section section-dark">
        <h2>Grundvoraussetzungen</h2>
        <p>Du bist mindestens 18 Jahre alt, auf TikTok aktiv und arbeitest zuverlässig. Entscheidend ist nicht nur Reichweite, sondern auch Produktfit und Umsetzungsqualität.</p>
      </section>
    `,
  },
  {
    path: '/ueber-gmvgang/',
    title: 'Über GMVGANG',
    description: 'GMVGANG entwickelt ein TikTok-Commerce-System für Brands und Creator mit Fokus auf Transparenz, Economics und skalierbare Prozesse.',
    eyebrow: 'Über GMVGANG',
    heading: 'TikTok Commerce als System aufbauen.',
    lead: 'GMVGANG verbindet operative TikTok-Shop-Umsetzung mit einer zunehmend softwaregestützten Plattform für Brands, Creator und das interne Team.',
    body: `
      <section class="section">
        <h2>Wofür wir stehen</h2>
        ${cards([
          ['Creator-getrieben', 'Creator sind ein zentraler Vertriebskanal und werden systematisch gematcht und entwickelt.'],
          ['Wirtschaftlich', 'GMV allein reicht nicht. Economics und Profitabilität gehören zur Steuerung.'],
          ['Transparent', 'Entscheidungen, Performance und nächste Schritte sollen nachvollziehbar sein.'],
        ])}
      </section>
      <section class="section section-dark">
        <h2>Die Plattform wächst mit dem operativen Geschäft.</h2>
        <p>GMVGANG entwickelt die eigenen Prozesse und Tools schrittweise aus realen Creator-, Brand- und Kampagnen-Workflows heraus.</p>
      </section>
    `,
  },
  {
    path: '/potenzialanalyse/',
    title: 'TikTok Shop Potenzialanalyse | GMVGANG',
    description: 'Prüfen Sie Produktfit, Creator-Potenzial, Economics und operative Voraussetzungen für TikTok Shop.',
    eyebrow: 'TikTok Shop Potenzialanalyse',
    heading: 'Wie viel TikTok-Shop-Potenzial steckt in Ihrer Brand?',
    lead: 'Die produktive Formularlogik wird im nächsten Migrationsschritt 1:1 aus dem bestehenden sicheren Webflow → Make → Website-Intake-Flow übernommen. Bis zum bestandenen E2E-Test bleibt dieser Branch nicht produktiv.',
    body: `
      <section class="section">
        <h2>Migrations-Gate</h2>
        <p>Kein öffentlicher Formular-Write wird auf die neue Website umgeschaltet, bevor Payload, Scoring, Fehlerfälle, Make-Response und CRM-Guardrails kontrolliert getestet wurden.</p>
        <p><a class="button button-secondary" href="https://gmvgang.webflow.io/potenzialanalyse">Aktuelle Live-Potenzialanalyse öffnen</a></p>
      </section>
    `,
    index: false,
  },
  {
    path: '/analyse-erhalten/',
    title: 'TikTok Shop Potenzial – nächster Schritt | GMVGANG',
    description: 'Ihre TikTok-Shop-Potenzialanalyse wurde übermittelt. Hier finden Sie die nächsten Schritte mit GMVGANG.',
    eyebrow: 'Ihre Ersteinschätzung',
    heading: 'Ihre Analyse ist angekommen.',
    lead: 'Wir prüfen Produktfit, Creator-Potenzial, Economics und operative Voraussetzungen und priorisieren daraus den nächsten sinnvollen Schritt.',
    body: `
      <section class="section">
        <div class="score-panel"><span>Potenzial-Score</span><strong id="result-score">–</strong><span>/100</span><p id="result-band">Analyse übermittelt</p></div>
        <h2>Was jetzt passiert.</h2>
        ${cards([
          ['01 · Angaben prüfen', 'Produktfit, Creator-Eignung, Marge und operative Risiken werden eingeordnet.'],
          ['02 · Hebel priorisieren', 'Wir priorisieren Creator, Content, Shop-Setup, LIVE oder Economics – je nach Ausgangslage.'],
          ['03 · Nächsten Schritt festlegen', 'Ziel ist ein klarer nächster Schritt statt unnötiger Budgeterhöhungen.'],
        ])}
        <div class="action-row"><a class="button button-primary" href="mailto:tiktokagentur@gmail.com?subject=GMVGANG%20TikTok-Shop-Potenzialanalyse">Persönliche Einordnung anfragen</a><a class="button button-secondary" href="/brands/">Mehr über GMVGANG für Brands</a></div>
      </section>
    `,
    index: false,
  },
  {
    path: '/impressum/',
    title: 'Impressum | GMVGANG',
    description: 'Impressum von GMVGANG.',
    eyebrow: 'Rechtliches',
    heading: 'Impressum',
    lead: 'Der rechtliche Inhalt wird vor dem Domain-Cutover aus der aktuell geprüften Webflow-Version übernommen und erneut gegen den dann aktuellen Gesellschaftsstatus geprüft.',
    body: '<section class="section"><p>Migration ausstehend. Die Webflow-Version bleibt bis zum finalen Rechts-/QA-Gate die Referenz.</p></section>',
    index: false,
  },
  {
    path: '/datenschutz/',
    title: 'Datenschutz | GMVGANG',
    description: 'Datenschutzerklärung von GMVGANG.',
    eyebrow: 'Rechtliches',
    heading: 'Datenschutz',
    lead: 'Die Datenschutzerklärung wird für den finalen Hosting-Stack angepasst, bevor gmvgang.de auf die neue Website umgeschaltet wird.',
    body: '<section class="section"><p>Migration ausstehend. Tracking bleibt bis zur geklärten Consent-/Datenschutzgrundlage deaktiviert.</p></section>',
    index: false,
  },
];

const actionMarkup = (actions = []) => actions.length
  ? `<div class="action-row">${actions.map(([href, label, kind]) => `<a class="button button-${kind}" href="${href}">${label}</a>`).join('')}</div>`
  : '';

export function renderPage(page) {
  const canonical = `https://gmvgang.de${page.path}`;
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${page.title}</title>
  <meta name="description" content="${page.description}">
  <meta name="robots" content="${page.index === false ? 'noindex,nofollow' : 'index,follow'}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${page.title}">
  <meta property="og:description" content="${page.description}">
  <meta property="og:url" content="${canonical}">
  <link rel="stylesheet" href="/styles.css">
  <script src="/client.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main">Zum Inhalt springen</a>
  <header class="site-header">
    <div class="shell nav-shell">
      <a class="brand" href="/" aria-label="GMVGANG Startseite">GMVGANG</a>
      <button class="menu-button" type="button" aria-expanded="false" aria-controls="main-nav">Menü</button>
      <nav id="main-nav" class="main-nav" aria-label="Hauptnavigation">
        ${nav.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
        <a class="nav-cta" href="/potenzialanalyse/">TikTok Shop Potenzial prüfen</a>
      </nav>
    </div>
  </header>
  <main id="main">
    <section class="hero">
      <div class="shell hero-grid">
        <div>
          <p class="eyebrow">${page.eyebrow}</p>
          <h1>${page.heading}</h1>
          <p class="hero-lead">${page.lead}</p>
          ${actionMarkup(page.actions)}
          ${page.microcopy ? `<p class="microcopy">${page.microcopy}</p>` : ''}
        </div>
        <div class="hero-panel" aria-label="GMVGANG System">
          <span>Shop</span><b>→</b><span>Creator</span><b>→</b><span>Content</span><b>→</b><span>Scale</span>
        </div>
      </div>
    </section>
    <div class="shell">${page.body}</div>
  </main>
  <footer class="site-footer">
    <div class="shell footer-grid">
      <div><strong>GMVGANG</strong><p>TikTok Shop Growth System</p></div>
      <div><a href="/brands/">Für Brands</a><a href="/creator/">Creator</a><a href="/ueber-gmvgang/">Über GMVGANG</a></div>
      <div><a href="/impressum/">Impressum</a><a href="/datenschutz/">Datenschutz</a></div>
    </div>
  </footer>
</body>
</html>`;
}
