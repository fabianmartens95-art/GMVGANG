const BRAND_LOGIN_URL = 'https://app.gmvgang.de/login';
const SHOWCASE_STYLESHEET = '<link rel="stylesheet" href="/brand-product-showcase.css">';

const HOME_OLD = {
  title: 'GMVGANG – TikTok Shop Growth für Brands',
  description: 'GMVGANG baut TikTok Shop für DTC- und E-Commerce-Brands als messbaren Vertriebskanal auf – creator-getrieben, transparent und wirtschaftlich.',
  eyebrow: 'TikTok Shop Growth System',
  heading: 'TikTok Shop skalieren. Profitabel, transparent, creator‑getrieben.',
  lead: 'Wir bauen TikTok Shop für DTC- und E-Commerce-Brands als messbaren Vertriebskanal auf: mit passenden Creatorn, verkaufsfähigem Content, Affiliate und LIVE. Paid Media kommt erst dazu, wenn Produkt, Content und Wirtschaftlichkeit tragen.',
};

const BRAND_OLD = {
  title: 'Für Brands | GMVGANG',
  description: 'TikTok Shop als Wachstumskanal: Strategie, Creator, Affiliate, Content, LIVE, Paid Media und Profitabilität in einem System.',
  eyebrow: 'Für Brands',
  heading: 'TikTok Shop als Wachstumskanal – nicht als Einzelmaßnahme.',
  lead: 'GMVGANG verbindet Strategie, Shop-Setup, Creator, Affiliate, Content, LIVE und Paid Media zu einem nachvollziehbaren Commerce-System.',
};

const shellPattern = /<\/section>\s*<div class="shell">[\s\S]*?<\/div>\s*<\/main>/;

function injectStylesheet(html) {
  if (html.includes('/brand-product-showcase.css')) return html;
  return html.replace('</head>', `  ${SHOWCASE_STYLESHEET}\n</head>`);
}

function replaceShellBody(html, body) {
  if (!shellPattern.test(html)) throw new Error('BRAND_MARKETING_SHELL_NOT_FOUND');
  return html.replace(shellPattern, `</section>\n    <div class="shell">${body}</div>\n  </main>`);
}

function replaceHero(html, oldCopy, nextCopy) {
  for (const marker of [oldCopy.title, oldCopy.description, oldCopy.eyebrow, oldCopy.heading, oldCopy.lead]) {
    if (!html.includes(marker)) throw new Error('BRAND_MARKETING_HERO_MARKER_NOT_FOUND');
  }

  return html
    .replaceAll(oldCopy.title, nextCopy.title)
    .replaceAll(oldCopy.description, nextCopy.description)
    .replace(`<p class="eyebrow">${oldCopy.eyebrow}</p>`, `<p class="eyebrow">${nextCopy.eyebrow}</p>`)
    .replace(`<h1>${oldCopy.heading}</h1>`, `<h1>${nextCopy.heading}</h1>`)
    .replace(`<p class="hero-lead">${oldCopy.lead}</p>`, `<p class="hero-lead">${nextCopy.lead}</p>`);
}

function replaceActionRow(html, oldMarkup, nextMarkup) {
  if (!html.includes(oldMarkup)) throw new Error('BRAND_MARKETING_ACTIONS_NOT_FOUND');
  return html.replace(oldMarkup, nextMarkup);
}

const brandOverviewPreview = `
        <article class="brand-product-preview brand-product-preview--wide">
          <div class="brand-product-preview__meta"><strong>Brand Overview</strong><span class="brand-product-badge">Produktvorschau</span></div>
          <div class="brand-product-window">
            <aside class="brand-product-window__nav" aria-hidden="true">
              <b>GMVGANG</b><span data-active="true">Übersicht</span><span>Profitability</span><span>Actions</span><span>Campaigns</span><span>Creators</span><span>Reporting</span>
            </aside>
            <div class="brand-product-window__main">
              <div class="brand-product-window__top"><div><small>BRAND WORKSPACE</small><h3>Executive Overview</h3></div><span>Tenant protected</span></div>
              <div class="brand-product-kpis" aria-label="Beispielhafte KPI-Struktur">
                <div><span>GMV</span><strong>—</strong></div><div><span>Net Revenue</span><strong>—</strong></div><div><span>Contribution</span><strong>—</strong></div><div><span>Contribution Margin</span><strong>—</strong></div>
              </div>
              <div class="brand-product-split">
                <div class="brand-product-ui"><span>Profitability Center</span><strong>Economics & variable Kosten</strong><small>COGS · Fulfillment · Creator Provision · Paid Media · Fees</small></div>
                <div class="brand-product-ui"><span>Next Best Action</span><strong>Priorisierte Maßnahmen</strong><small>Critical · High · Medium mit Begründung und nächstem Schritt</small></div>
              </div>
            </div>
          </div>
        </article>`;

const brandDetailPreviews = `
        <article class="brand-product-preview">
          <div class="brand-product-preview__meta"><strong>Profitability Center</strong><span class="brand-product-badge">Heute</span></div>
          <div class="brand-product-detail">
            <small>UNIT ECONOMICS</small><h3>Nicht nur GMV.</h3><p>Der Read Model Layer kann GMV, Net Revenue, Contribution und Contribution Margin gemeinsam mit variablen Kosten abbilden.</p>
            <div class="brand-product-costs"><span>COGS</span><span>Fulfillment</span><span>Creator Provision</span><span>Paid Media</span><span>Agency Fees</span><span>Platform Fees</span></div>
          </div>
        </article>
        <article class="brand-product-preview">
          <div class="brand-product-preview__meta"><strong>Next Best Actions</strong><span class="brand-product-badge">Heute</span></div>
          <div class="brand-product-detail">
            <small>ACTION LAYER</small><h3>Von Daten zur nächsten Maßnahme.</h3><p>Prioritäten können als Critical, High oder Medium mit Kategorie, Grund, Evidenz und empfohlenem nächsten Schritt ausgegeben werden.</p>
            <div class="brand-product-action-list"><span><b>HIGH</b> Creator Operations</span><span><b>MEDIUM</b> Inventory</span><span><b>MEDIUM</b> Rights</span></div>
          </div>
        </article>
        <article class="brand-product-preview">
          <div class="brand-product-preview__meta"><strong>Performance & Coverage</strong><span class="brand-product-badge">Heute</span></div>
          <div class="brand-product-detail">
            <small>DATA LAYER</small><h3>Messwerte mit Herkunft und Status.</h3><p>Performance wird in getrennten Slices geführt, statt überlappende Daten zu einer künstlichen Gesamtzahl zu addieren.</p>
            <div class="brand-product-chip-row"><span>shop</span><span>campaign</span><span>creator</span><span>product</span><span>content</span></div>
            <div class="brand-product-coverage"><span>READY</span><span>PARTIAL</span><span>UNAVAILABLE</span></div>
          </div>
        </article>`;

const brandShowcase = `
      <section class="section brand-product-showcase">
        <div class="brand-product-showcase__intro">
          <p class="kicker">GMVGANG Brand Workspace</p>
          <h2>So sieht die Steuerung im Portal aus.</h2>
          <p>Der Brand Workspace bündelt Economics, priorisierte Maßnahmen und Performance in einer rollen- und tenant-geschützten Oberfläche. Die Vorschauen zeigen die reale Informationsarchitektur; dargestellte Striche und Statusbeispiele sind keine Live-Kundendaten.</p>
        </div>
        <div class="brand-product-preview-grid">
          ${brandOverviewPreview}
          ${brandDetailPreviews}
        </div>
      </section>`;

const homeBody = `
      <section class="section brand-system-section">
        <p class="kicker">Eine Plattform. Zwei Workspaces.</p>
        <h2>Brands steuern. Creator arbeiten. GMVGANG verbindet beides.</h2>
        <p>Die Website erklärt das System. Im Portal findet die eigentliche Arbeit statt. Operative Services ergänzen die Software dort, wo Strategie, Creator Operations oder Skalierung Unterstützung brauchen.</p>
        <div class="brand-system-grid">
          <a class="brand-system-card" href="/brands/">
            <span>01 · BRAND WORKSPACE</span><h3>Economics und Entscheidungen</h3><p>Profitability Center, Next Best Actions, Performance und Datenabdeckung in einem geschützten Brand-Bereich.</p><strong>Brand Workspace ansehen →</strong>
          </a>
          <a class="brand-system-card" href="/creator/">
            <span>02 · CREATOR WORKSPACE</span><h3>Profil bis Performance</h3><p>Creator verwalten Profil, Qualifizierung, Matches, Campaigns, Performance und Referrals in ihrem eigenen Workspace.</p><strong>Creator Portal ansehen →</strong>
          </a>
          <article class="brand-system-card">
            <span>03 · SERVICE LAYER</span><h3>Software plus Umsetzung</h3><p>Strategie, Creator & Affiliate Operations, Content, LIVE und Paid Media werden dort ergänzt, wo operative Umsetzung Mehrwert schafft.</p><strong>Aligned Growth</strong>
          </article>
        </div>
      </section>

      <section class="section section-dark brand-home-command">
        <p class="kicker">Brand Command Layer</p>
        <h2>Von Performance zu Profitabilität und nächster Aktion.</h2>
        <p>Der Brand Workspace ist darauf ausgelegt, nicht nur Aktivität zu zeigen. Datenstatus, Economics und priorisierte Maßnahmen werden getrennt sichtbar gemacht, damit Entscheidungen nachvollziehbar bleiben.</p>
        <div class="brand-home-command__grid">
          <div><span>Profitability</span><strong>GMV → Net Revenue → Contribution</strong></div>
          <div><span>Performance</span><strong>Shop · Campaign · Creator · Product · Content</strong></div>
          <div><span>Action Layer</span><strong>Critical · High · Medium</strong></div>
          <div><span>Data Coverage</span><strong>Ready · Partial · Unavailable</strong></div>
        </div>
      </section>

      <section class="section">
        <p class="kicker">Software + Operations</p>
        <h2>Das Portal schafft Transparenz. GMVGANG unterstützt die Umsetzung.</h2>
        <div class="card-grid">
          <article class="card"><h3>Creator & Affiliate</h3><p>Creator-Auswahl, Aktivierung und operative Steuerung entlang klarer Kriterien.</p></article>
          <article class="card"><h3>Content & LIVE</h3><p>Briefings, Hooks, Formate und Commerce-Umsetzung auf Produktfit und Conversion ausrichten.</p></article>
          <article class="card"><h3>Economics & Paid</h3><p>Paid Media erst verstärken, wenn Creative, Produkt und Wirtschaftlichkeit eine belastbare Grundlage bilden.</p></article>
        </div>
      </section>

      <section class="section section-dark">
        <p class="kicker">Aligned Growth</p>
        <h2>Erst validieren. Dann verstärken. Dann skalieren.</h2>
        <p>GMV allein ist kein Steuerungsziel. Produktfit, Creator-Match, Content-Performance und Unit Economics bestimmen, wann Skalierung sinnvoll ist.</p>
      </section>

      <section class="section brand-final-cta">
        <p class="kicker">Nächster Schritt</p>
        <h2>Prüfen Sie zuerst, ob TikTok Shop zu Ihrer Brand passt.</h2>
        <p>Die Potenzialanalyse strukturiert Produkt, Creator-Fit, Economics und operative Voraussetzungen. Bestehende Portal-Nutzer können sich direkt anmelden.</p>
        <div class="action-row"><a class="button button-primary" href="/potenzialanalyse/">TikTok Shop Potenzial prüfen</a><a class="button button-secondary" href="${BRAND_LOGIN_URL}">Zum Portal-Login</a></div>
      </section>
    `;

const brandBody = `
      ${brandShowcase}

      <section class="section">
        <p class="kicker">Heute im Brand Workspace</p>
        <h2>Die Steuerung beginnt bei Datenqualität und Economics.</h2>
        <div class="card-grid">
          <article class="card"><h3>Tenant-geschütztes Overview</h3><p>Brand-Daten werden nur akzeptiert, wenn die serverseitige Organization-ID zur verifizierten Portal-Session passt.</p></article>
          <article class="card"><h3>Profitability Center</h3><p>GMV, Net Revenue, Contribution, Contribution Margin und variable Kosten werden als getrennte Economics-Schicht modelliert.</p></article>
          <article class="card"><h3>Next Best Actions</h3><p>Regelbasierte Maßnahmen können priorisiert, begründet und mit konkretem nächsten Schritt ausgegeben werden.</p></article>
          <article class="card"><h3>Performance & Data Coverage</h3><p>Performance-Slices und Datenstatus machen sichtbar, welche Bereiche belastbar, teilweise verfügbar oder noch nicht verbunden sind.</p></article>
        </div>
      </section>

      <section class="section section-dark brand-roadmap-section">
        <p class="kicker">Module im Ausbau</p>
        <h2>Der Workspace wächst entlang realer Brand-Workflows.</h2>
        <p>Diese Bereiche besitzen bereits geschützte Portalpfade. Die Fachlogik wird schrittweise ergänzt; sie werden hier deshalb bewusst nicht als vollständig fertig dargestellt.</p>
        <div class="brand-roadmap-grid">
          <article><span>ROUTE READY</span><h3>Campaigns</h3><p>Kampagnensteuerung innerhalb derselben Brand- und Tenant-Grenze.</p></article>
          <article><span>ROUTE READY</span><h3>Creator Intelligence</h3><p>Creator-Auswahl und -Steuerung als eigenes Brand-Modul.</p></article>
          <article><span>ROUTE READY</span><h3>Approvals</h3><p>Freigaben für operative Brand- und Campaign-Prozesse.</p></article>
          <article><span>ROUTE READY</span><h3>Reporting</h3><p>Zusammenführung relevanter Brand-, Campaign- und Performance-Sichten.</p></article>
        </div>
      </section>

      <section class="section">
        <p class="kicker">GMVGANG Service Layer</p>
        <h2>Wenn Software allein nicht reicht, unterstützen wir operativ.</h2>
        <div class="card-grid">
          <article class="card"><h3>Strategie & Setup</h3><p>Zielbild, Produktpriorisierung, Economics und operative Voraussetzungen klären.</p></article>
          <article class="card"><h3>Creator & Affiliate Operations</h3><p>Creator identifizieren, aktivieren und entlang klarer Kriterien steuern.</p></article>
          <article class="card"><h3>Content & LIVE</h3><p>Briefings, Hooks und Commerce-Formate auf Produktargumente und Conversion ausrichten.</p></article>
          <article class="card"><h3>Paid Media & Scaling</h3><p>Gewinner erst dann mit Budget verstärken, wenn Creative und Economics belastbar sind.</p></article>
        </div>
      </section>

      <section class="section section-dark">
        <p class="kicker">Zugang</p>
        <h2>Brand Portal aktuell zugangsgesteuert.</h2>
        <p>Neue Brands starten über die Potenzialanalyse und den anschließenden Qualifizierungsprozess. Bestehende Portal-Nutzer melden sich direkt mit ihrem GMVGANG Account an.</p>
        <div class="action-row"><a class="button button-primary" href="/potenzialanalyse/">TikTok Shop Potenzial prüfen</a><a class="button button-secondary" href="${BRAND_LOGIN_URL}">Zum Brand Portal</a></div>
      </section>
    `;

export function enhanceHomepageForPlatform(html) {
  let output = replaceHero(html, HOME_OLD, {
    title: 'GMVGANG – TikTok Shop Operating System für Brands & Creator',
    description: 'GMVGANG verbindet Brand Workspace, Creator Workspace und operative TikTok-Shop-Services zu einem transparenten Commerce-System.',
    eyebrow: 'TikTok Commerce Operating System',
    heading: 'TikTok Shop steuern. Creator aktivieren. Profitabilität verstehen.',
    lead: 'GMVGANG verbindet einen Brand Workspace, einen Creator Workspace und operative TikTok-Shop-Services. So werden Creator, Performance, Economics und nächste Maßnahmen schrittweise in einem System steuerbar.',
  });

  output = replaceActionRow(
    output,
    '<div class="action-row"><a class="button button-primary" href="/potenzialanalyse/">TikTok Shop Potenzial prüfen</a><a class="button button-secondary" href="/brands/">So arbeiten wir</a></div>',
    '<div class="action-row"><a class="button button-primary" href="/potenzialanalyse/">TikTok Shop Potenzial prüfen</a><a class="button button-secondary" href="/brands/">Brand Workspace ansehen</a></div>',
  );
  output = output.replace('2–3 Min · Ergebnis direkt erhalten', 'Potenzialanalyse 2–3 Min · Brand Portal aktuell zugangsgesteuert');
  output = injectStylesheet(output);
  return replaceShellBody(output, homeBody);
}

export function enhanceBrandPageForPlatform(html) {
  let output = replaceHero(html, BRAND_OLD, {
    title: 'Brand Portal | GMVGANG',
    description: 'GMVGANG Brand Workspace für TikTok Shop: Profitability Center, Next Best Actions, Performance, Datenabdeckung und operative Services in einem System.',
    eyebrow: 'GMVGANG Brand Workspace',
    heading: 'Steuern Sie TikTok Shop in einem System.',
    lead: 'Profitability, priorisierte Maßnahmen, Performance und Datenabdeckung in einem tenant-geschützten Brand Workspace. Operative GMVGANG-Services ergänzen die Software dort, wo Umsetzung gebraucht wird.',
  });

  output = replaceActionRow(
    output,
    '<div class="action-row"><a class="button button-primary" href="/potenzialanalyse/">TikTok Shop Potenzial prüfen</a></div>',
    `<div class="action-row"><a class="button button-primary" href="/potenzialanalyse/">TikTok Shop Potenzial prüfen</a><a class="button button-secondary" href="${BRAND_LOGIN_URL}">Zum Portal-Login</a></div>`,
  );
  output = injectStylesheet(output);
  return replaceShellBody(output, brandBody);
}

export { BRAND_LOGIN_URL };
