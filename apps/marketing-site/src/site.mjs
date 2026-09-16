const nav = [
  ['/brands/', 'Für Brands'],
  ['/creator/', 'Creator'],
  ['/ueber-gmvgang/', 'Über GMVGANG'],
];

const cards = (items) => `<div class="card-grid">${items
  .map(([title, text]) => `<article class="card"><h3>${title}</h3><p>${text}</p></article>`)
  .join('')}</div>`;

export const SITE_INDEXABLE = process.env.SITE_INDEXABLE === 'true';

export const pages = [
  {
    path: '/',
    title: 'GMVGANG – TikTok Shop Growth für Brands',
    description: 'GMVGANG baut TikTok Shop für DTC- und E-Commerce-Brands als messbaren Vertriebskanal auf – creator-getrieben, transparent und wirtschaftlich.',
    eyebrow: 'TikTok Shop Growth System',
    heading: 'TikTok Shop skalieren. Profitabel, transparent, creator‑getrieben.',
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
    title: 'TikTok Shop Potenzial prüfen | GMVGANG',
    description: 'Kurzer GMVGANG Potenzial-Check für DTC- und E-Commerce-Brands: Produktfit, Creator-Potenzial und TikTok-Shop-Readiness einschätzen.',
    eyebrow: 'TikTok Shop Potenzial Check',
    heading: 'Wie viel TikTok-Shop-Potenzial steckt in Ihrer Brand?',
    lead: 'Prüfen Sie, ob Ihr Produkt, passende Creator und Ihre Abläufe eine gute Grundlage für TikTok Shop bieten.',
    body: `
      <section class="section potential-intro">
        <p class="form-note">Keine Umsatzprognose. Der Score ist eine indikative Ersteinschätzung und ersetzt keine individuelle Analyse.</p>
        <div class="method-grid" aria-label="Prüfkriterien">
          ${cards([
            ['01 · Produkt & Demo-Fit', 'Wie schnell und verständlich lässt sich der Produktnutzen in Video und LIVE zeigen?'],
            ['02 · Creator & Content-Fit', 'Gibt es glaubwürdige Creator und wiederholbare Content-Ansätze?'],
            ['03 · Wirtschaftlichkeit', 'Besteht ausreichend Spielraum für Creator, Samples und profitables Wachstum?'],
            ['04 · Shop & Operations', 'Sind Shop, Lager und Fulfillment für zusätzliche Nachfrage vorbereitet?'],
          ])}
        </div>
      </section>
      <section class="section potential-form-section">
        <p class="kicker">2–3 Minuten</p>
        <h2>Potenzial prüfen.</h2>
        <p><a href="mailto:tiktokagentur@gmail.com?subject=TikTok-Shop-Anfrage">Lieber direkt anfragen? Schreiben Sie uns eine E-Mail.</a></p>
        <div class="form-progress" aria-live="polite">
          <span>Schritt <strong id="pc-step-now">1</strong> von 4</span>
          <div class="progress-track" aria-hidden="true"><span id="pc-progress-fill"></span></div>
        </div>
        <div id="pc-error" class="form-message form-error" role="alert" tabindex="-1" hidden>Bitte prüfen Sie das markierte Pflichtfeld.</div>
        <form id="pc-form" class="potential-form" action="https://hook.eu1.make.com/pxnd9dc4dd9egwjsjerlxwbo2jpfam9t" method="post" novalidate>
          <section class="pc-step pc-step-active" data-step="1" aria-hidden="false">
            <p class="step-label">01 · Brand</p>
            <h3 tabindex="-1">Die Basis.</h3>
            <p>Wir starten mit Produkt und aktuellem TikTok-Shop-Status.</p>
            <label class="field"><span>Brand / Unternehmen *</span><input id="brand" name="brand" type="text" autocomplete="organization" required></label>
            <label class="field"><span>Website / Shop-URL *</span><input id="website" name="website" type="url" inputmode="url" autocomplete="url" placeholder="https://" required></label>
            <label class="field"><span>Produktkategorie *</span><select id="category" name="category" required><option value="">Bitte wählen</option><option value="Beauty">Beauty & Pflege</option><option value="Food">Lebensmittel & Getränke</option><option value="Home & Living">Wohnen & Haushalt</option><option value="Fashion">Mode & Accessoires</option><option value="Electronics">Elektronik & Gadgets</option><option value="Health & Wellness">Gesundheit & Wellness</option><option value="Pet">Haustierbedarf</option><option value="Sonstiges">Sonstiges</option></select></label>
            <label class="field"><span>TikTok-Shop-Status *</span><select id="shop-status" name="shop_status" required><option value="">Bitte wählen</option><option value="0">Noch nicht gestartet</option><option value="5">In Vorbereitung</option><option value="8">Shop live, kaum Aktivität</option><option value="10">Shop live</option></select></label>
            <div class="form-actions"><button class="button button-primary" type="button" data-next>Weiter</button></div>
          </section>

          <section class="pc-step" data-step="2" aria-hidden="true">
            <p class="step-label">02 · Produkt & Creator</p>
            <h3 tabindex="-1">Kann man es zeigen?</h3>
            <p>TikTok Shop funktioniert besonders gut, wenn Nutzen und Produkt visuell schnell verständlich werden.</p>
            <label class="field"><span>Produkt lässt sich in Video/LIVE klar demonstrieren *</span><select id="demo-fit" name="demo_fit" required><option value="">Bitte wählen</option><option value="25">Sehr gut</option><option value="18">Gut</option><option value="10">Teilweise</option><option value="3">Schwer</option></select></label>
            <label class="field"><span>Creator können glaubwürdig darüber sprechen *</span><select id="creator-fit" name="creator_fit" required><option value="">Bitte wählen</option><option value="25">Sehr gut</option><option value="18">Gut</option><option value="10">Teilweise</option><option value="3">Schwer</option></select></label>
            <label class="field"><span>Wiederholbarer Content-Ansatz *</span><select id="content-depth" name="content_depth" required><option value="">Bitte wählen</option><option value="15">Viele Hooks/Use Cases möglich</option><option value="10">Mehrere Ansätze möglich</option><option value="5">Wenige Ansätze</option><option value="0">Unklar</option></select></label>
            <label class="field"><span>Bestehende Creator-/UGC-Erfahrung *</span><select id="creator-history" name="creator_history" required><option value="">Bitte wählen</option><option value="10">Ja, regelmäßig</option><option value="7">Erste Tests</option><option value="3">Noch nicht</option></select></label>
            <div class="form-actions"><button class="button button-secondary" type="button" data-back>Zurück</button><button class="button button-primary" type="button" data-next>Weiter</button></div>
          </section>

          <section class="pc-step" data-step="3" aria-hidden="true">
            <p class="step-label">03 · Wirtschaftlichkeit & Versand</p>
            <h3 tabindex="-1">Kann es skalieren?</h3>
            <p>Wir bewerten grob, ob genug Spielraum für Creator, Samples und profitables Wachstum vorhanden sein könnte.</p>
            <label class="field"><span>Bruttomarge nach Wareneinsatz *</span><select id="margin" name="margin" aria-describedby="pc-margin-help" required><option value="">Bitte wählen</option><option value="15">Über 60 %</option><option value="12">45–60 %</option><option value="7">30 bis unter 45 %</option><option value="2">Unter 30 %</option><option value="unknown">Noch nicht bekannt</option></select></label>
            <p id="pc-margin-help" class="field-help">Gemeint ist der Anteil am Nettoumsatz nach Wareneinsatz: (Nettoumsatz − Wareneinsatz) ÷ Nettoumsatz. Versand, Retouren, Provisionen und Werbung prüfen wir später zusätzlich.</p>
            <label class="field"><span>Sample-/Produktversand an Creator *</span><select id="samples" name="samples" required><option value="">Bitte wählen</option><option value="10">Problemlos skalierbar</option><option value="7">Begrenzt möglich</option><option value="2">Schwierig</option></select></label>
            <label class="field"><span>Fulfillment & Lager *</span><select id="ops" name="ops" required><option value="">Bitte wählen</option><option value="10">Skalierbar aufgesetzt</option><option value="7">Solide, aber begrenzt</option><option value="3">Noch im Aufbau</option></select></label>
            <label class="field"><span>Primäres Ziel *</span><select id="goal" name="goal" required><option value="">Bitte wählen</option><option value="Shop aufbauen">TikTok Shop aufbauen</option><option value="Creator gewinnen">Passende Creator gewinnen</option><option value="Content testen">Produkte und Content testen</option><option value="Shop verbessern">Bestehenden Shop verbessern</option><option value="LIVE testen">LIVE-Verkäufe testen</option><option value="Potenzial klären">Zunächst Potenzial klären</option></select></label>
            <div class="form-actions"><button class="button button-secondary" type="button" data-back>Zurück</button><button class="button button-primary" type="button" data-score>Ergebnis berechnen</button></div>
          </section>

          <section class="pc-step" data-step="4" aria-hidden="true">
            <p class="step-label">04 · Ergebnis</p>
            <div class="score-panel form-score"><span>Potenzial-Score</span><strong id="pc-score">–</strong><span>/100</span><p id="pc-band">Potenzial wird berechnet.</p></div>
            <p id="pc-result-copy" class="result-copy">Ihre Angaben werden zunächst strukturiert eingeordnet.</p>
            <div class="result-list"><p id="pc-reco-1"></p><p id="pc-reco-2"></p><p id="pc-reco-3"></p></div>
            <h3 tabindex="-1">Nächsten Schritt anfordern.</h3>
            <p>Hinterlassen Sie Ihre Kontaktdaten. GMVGANG kann die Angaben anschließend individuell prüfen und den sinnvollsten nächsten Schritt einordnen.</p>
            <label class="field"><span>Ansprechpartner *</span><input id="contact-name" name="contact_name" type="text" autocomplete="name" required></label>
            <label class="field"><span>Business-E-Mail *</span><input id="business-email" name="email" type="email" autocomplete="email" required></label>
            <label class="field"><span>Optional: kurze Notiz</span><textarea id="note" name="note" rows="4" maxlength="5000" placeholder="Was sollten wir über Ihre Brand wissen?"></textarea></label>
            <input id="pc-score-input" name="potential_score" type="hidden">
            <input id="pc-band-input" name="potential_band" type="hidden">
            <input id="pc-potential-crm" name="potential_crm" type="hidden">
            <input id="pc-tiktok-crm" name="tiktok_shop_crm" type="hidden">
            <input id="pc-branche-crm" name="branche_crm" type="hidden">
            <input id="pc-summary-input" name="assessment_summary" type="hidden">
            <input id="pc-source-url" name="source_url" type="hidden">
            <div class="form-actions"><button class="button button-secondary" type="button" data-back>Zurück</button><button class="button button-primary" type="submit">Anfrage senden</button></div>
            <p class="form-note">Mit dem Absenden werden Ihre Angaben zur Bearbeitung Ihrer Anfrage und zur Prüfung einer möglichen Zusammenarbeit verarbeitet. Weitere Informationen finden Sie in unserer <a href="/datenschutz/">Datenschutzerklärung</a>.</p>
          </section>
        </form>
        <div id="pc-success" class="form-message form-success" role="status" tabindex="-1" hidden>Danke – Ihre Anfrage ist angekommen. Wir prüfen Ihre Angaben und melden uns zum nächsten sinnvollen Schritt.</div>
        <div id="pc-failure" class="form-message form-error" role="alert" tabindex="-1" hidden>Wir konnten den Eingang noch nicht bestätigen. Ihre Eingaben bleiben erhalten. Bitte versuchen Sie es später erneut oder schreiben Sie an tiktokagentur@gmail.com.</div>
      </section>
    `,
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
    description: 'Anbieterkennzeichnung von GMVGANG.',
    eyebrow: 'Rechtliche Angaben',
    heading: 'Impressum',
    lead: 'Angaben gemäß § 5 DDG.',
    body: `
      <section class="section legal-copy">
        <h2>Angaben gemäß § 5 DDG</h2>
        <p><strong>Fabian Martens</strong><br>Geschäftsbezeichnung: <strong>GMVGANG</strong><br>Böckenholt 17<br>48324 Sendenhorst<br>Deutschland</p>
        <h2>Kontakt</h2>
        <p>E-Mail: <a href="mailto:Tiktokagentur@gmail.com">Tiktokagentur@gmail.com</a><br>Telefon: <a href="tel:+491639822438">0163 9822438</a></p>
        <h2>Unternehmensstatus</h2>
        <p>GMVGANG wird derzeit als Geschäftsbezeichnung von Fabian Martens geführt. Eine Gesellschaft wird in dieser Fassung nicht als Anbieter ausgewiesen, solange die Gründung nicht abgeschlossen ist.</p>
        <p class="legal-note">Stand: 16. September 2026 · vor Domain-Cutover erneut gegen den aktuellen Gesellschaftsstatus zu prüfen.</p>
      </section>
    `,
    index: false,
  },
  {
    path: '/datenschutz/',
    title: 'Datenschutz | GMVGANG',
    description: 'Datenschutzhinweise für die GMVGANG Website und Potenzialanalyse.',
    eyebrow: 'Datenschutzhinweise',
    heading: 'Datenschutz',
    lead: 'Diese Hinweise erläutern, wie personenbezogene Daten beim Besuch dieser Website und bei Nutzung der TikTok-Shop-Potenzialanalyse verarbeitet werden.',
    body: `
      <section class="section legal-copy">
        <h2>1. Verantwortlicher</h2>
        <p><strong>Fabian Martens</strong><br>Geschäftsbezeichnung: <strong>GMVGANG</strong><br>Böckenholt 17<br>48324 Sendenhorst<br>Deutschland<br>E-Mail: <a href="mailto:Tiktokagentur@gmail.com">Tiktokagentur@gmail.com</a></p>

        <h2>2. Bereitstellung und Hosting der Website</h2>
        <p>Die Website wird über Cloudflare Pages bereitgestellt. Beim Aufruf können technisch erforderliche Verbindungsdaten verarbeitet werden, insbesondere IP-Adresse, Zeitpunkt des Abrufs, aufgerufene Seite sowie Browser- und Geräteinformationen. Die Verarbeitung dient der sicheren, stabilen und technisch funktionsfähigen Bereitstellung der Website. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse liegt im sicheren und zuverlässigen Betrieb unseres Webauftritts.</p>

        <h2>3. TikTok-Shop-Potenzialanalyse und Kontaktanfragen</h2>
        <p>Wenn Sie die Potenzialanalyse ausfüllen, verarbeiten wir die von Ihnen eingegebenen Angaben, insbesondere Brand- und Website-Daten, Produkt- und TikTok-Shop-Angaben, Informationen zur wirtschaftlichen und operativen Ausgangslage sowie Name, geschäftliche E-Mail-Adresse und freiwillige Notizen. Die Daten werden verwendet, um das TikTok-Shop-Potenzial Ihrer Brand einzuschätzen, Ihre Anfrage zu bearbeiten und einen sinnvollen nächsten Schritt für eine mögliche Zusammenarbeit zu bestimmen. Soweit die Anfrage auf die Anbahnung eines Vertrags gerichtet ist, erfolgt die Verarbeitung auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO; im Übrigen auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO zur Bearbeitung geschäftlicher Anfragen.</p>

        <h2>4. Potenzial-Score</h2>
        <p>Die Potenzialanalyse berechnet aus Ihren Antworten einen internen Score und eine Potenzialstufe. Diese Bewertung dient der strukturierten Ersteinschätzung und Priorisierung. Sie führt nicht automatisch zu einem Vertrag, einer Annahme oder Ablehnung und stellt keine ausschließlich automatisierte Entscheidung mit rechtlicher oder vergleichbar erheblicher Wirkung dar.</p>

        <h2>5. Eingesetzte Dienstleister</h2>
        <p>Zur technischen Verarbeitung setzen wir insbesondere Cloudflare für Hosting und Auslieferung der Website, Make für die automatisierte Übermittlung und Verarbeitung von Anfragen sowie Notion für unser internes Brand- und Lead-Management ein. Diese Anbieter verarbeiten Daten im Rahmen der jeweils vereinbarten datenschutzrechtlichen Regelungen und nur soweit dies für die genannten Zwecke erforderlich ist.</p>

        <h2>6. Übermittlungen in Drittländer</h2>
        <p>Bei einzelnen Dienstleistern kann eine Verarbeitung personenbezogener Daten außerhalb des Europäischen Wirtschaftsraums stattfinden. Soweit erforderlich, stützen sich solche Übermittlungen auf einen anwendbaren Angemessenheitsbeschluss oder geeignete Garantien, insbesondere die Standardvertragsklauseln der Europäischen Kommission.</p>

        <h2>7. Speicherdauer</h2>
        <p>Wir speichern personenbezogene Daten nur so lange, wie sie für die Bearbeitung Ihrer Anfrage, die Bewertung einer möglichen Zusammenarbeit und berechtigte geschäftliche Follow-ups erforderlich sind. Anschließend werden die Daten gelöscht oder eingeschränkt, soweit keine gesetzlichen Aufbewahrungspflichten oder sonstigen berechtigten Gründe für eine weitere Speicherung bestehen.</p>

        <h2>8. Keine Marketing-Analyse in V1</h2>
        <p>Zum aktuellen Stand setzen wir auf dieser Website keine eigenen Marketing- oder Reichweitenanalyse-Tools wie Google Analytics oder Werbe-Pixel ein. Sollte sich der eingesetzte Tracking- oder Cookie-Stack ändern, werden diese Datenschutzhinweise vor Aktivierung entsprechend angepasst.</p>

        <h2>9. Ihre Rechte</h2>
        <p>Sie haben nach Maßgabe der DSGVO insbesondere das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und – soweit die Verarbeitung auf Art. 6 Abs. 1 lit. f DSGVO beruht – Widerspruch. Zur Ausübung Ihrer Rechte können Sie sich an die oben genannte Kontaktadresse wenden.</p>

        <h2>10. Beschwerderecht</h2>
        <p>Sie haben das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren. Für Verantwortliche mit Sitz in Nordrhein-Westfalen ist insbesondere die Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen (LDI NRW) zuständig.</p>

        <h2>11. Externe Links</h2>
        <p>Die Creator-Bewerbung kann über einen externen Link zu Tally geöffnet werden. Beim Aufruf verlassen Sie diese Website. Für die Creator-Bewerbung gelten ergänzend die dort bereitgestellten gesonderten Datenschutzhinweise.</p>

        <p class="legal-note">Stand: 16. September 2026 · Hosting-Stack auf Cloudflare Pages angepasst; vor Domain-Cutover erneut rechtlich/operativ prüfen.</p>
      </section>
    `,
    index: false,
  },
];

const actionMarkup = (actions = []) => actions.length
  ? `<div class="action-row">${actions.map(([href, label, kind]) => `<a class="button button-${kind}" href="${href}">${label}</a>`).join('')}</div>`
  : '';

export function renderPage(page) {
  const canonical = `https://gmvgang.de${page.path}`;
  const robots = SITE_INDEXABLE && page.index !== false ? 'index,follow' : 'noindex,nofollow';
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${page.title}</title>
  <meta name="description" content="${page.description}">
  <meta name="robots" content="${robots}">
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
