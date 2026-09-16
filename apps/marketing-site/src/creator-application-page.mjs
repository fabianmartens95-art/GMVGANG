const TALLY_FALLBACK_URL = 'https://tally.so/r/68BbAO';

const applicationSection = `
      <section id="creator-bewerbung" class="section creator-application-section" aria-labelledby="creator-application-heading">
        <p class="kicker">Creator Netzwerk</p>
        <h2 id="creator-application-heading">Als Creator bewerben.</h2>
        <p>Die Schnellbewerbung dauert ungefähr zwei Minuten. Wir prüfen anschließend Profil, Produktfit und mögliche Kategorien.</p>

        <div id="creator-application-unavailable" class="creator-application-notice" hidden>
          <strong>Das Website-Formular ist gerade noch nicht freigeschaltet.</strong>
          <p>Nutze in der Zwischenzeit unsere bestehende Schnellbewerbung.</p>
          <a class="button button-secondary" href="${TALLY_FALLBACK_URL}" target="_blank" rel="noopener noreferrer">Schnellbewerbung öffnen</a>
        </div>

        <form
          id="creator-application-form"
          class="creator-application-form"
          data-api-origin="https://app.gmvgang.de"
          data-fallback-url="${TALLY_FALLBACK_URL}"
          novalidate
        >
          <div class="creator-form-grid">
            <label class="field">
              <span>Name *</span>
              <input name="displayName" type="text" autocomplete="name" minlength="2" maxlength="120" required>
            </label>

            <label class="field">
              <span>TikTok Handle *</span>
              <input name="tiktokHandle" type="text" autocomplete="off" placeholder="@deinhandle" minlength="2" maxlength="120" required>
            </label>

            <label class="field">
              <span>E-Mail *</span>
              <input name="email" type="email" autocomplete="email" maxlength="254" required>
            </label>

            <label class="field">
              <span>Telefon <small>(optional)</small></span>
              <input name="phone" type="tel" autocomplete="tel" maxlength="32">
            </label>

            <label class="field">
              <span>Followerzahl *</span>
              <select name="followerBand" required>
                <option value="">Bitte wählen</option>
                <option value="0-1k">Unter 1.000</option>
                <option value="1k-10k">1.000–10.000</option>
                <option value="10k-50k">10.000–50.000</option>
                <option value="50k-100k">50.000–100.000</option>
                <option value="100k+">Über 100.000</option>
              </select>
            </label>

            <label class="field">
              <span>TikTok-Shop-Erfahrung *</span>
              <select name="tiktokShopExperience" required>
                <option value="">Bitte wählen</option>
                <option value="none">Noch keine</option>
                <option value="affiliate">Affiliate / Shoppable Videos</option>
                <option value="live">TikTok Shop LIVE</option>
                <option value="affiliate_and_live">Affiliate und LIVE</option>
              </select>
            </label>
          </div>

          <fieldset class="creator-category-fieldset">
            <legend>Content-Kategorien * <small>1–5 auswählen</small></legend>
            <div class="creator-category-grid">
              <label><input type="checkbox" name="contentCategories" value="Beauty"> Beauty</label>
              <label><input type="checkbox" name="contentCategories" value="Fashion"> Fashion</label>
              <label><input type="checkbox" name="contentCategories" value="Lifestyle"> Lifestyle</label>
              <label><input type="checkbox" name="contentCategories" value="Food"> Food</label>
              <label><input type="checkbox" name="contentCategories" value="Home & Living"> Home & Living</label>
              <label><input type="checkbox" name="contentCategories" value="Health & Wellness"> Health & Wellness</label>
              <label><input type="checkbox" name="contentCategories" value="Fitness"> Fitness</label>
              <label><input type="checkbox" name="contentCategories" value="Gaming"> Gaming</label>
              <label><input type="checkbox" name="contentCategories" value="Familie"> Familie</label>
              <label><input type="checkbox" name="contentCategories" value="Entertainment"> Entertainment</label>
              <label><input type="checkbox" name="contentCategories" value="Tech"> Tech</label>
              <label><input type="checkbox" name="contentCategories" value="Sonstiges"> Sonstiges</label>
            </div>
            <p id="creator-category-help" class="field-help">Wähle mindestens eine und höchstens fünf Kategorien.</p>
          </fieldset>

          <label class="creator-consent-row">
            <input name="ageConfirmed" type="checkbox" required>
            <span>Ich bestätige, dass ich mindestens 18 Jahre alt bin. *</span>
          </label>

          <label class="creator-consent-row">
            <input name="privacyAccepted" type="checkbox" required>
            <span>Ich habe die <a href="/datenschutz/" target="_blank" rel="noopener noreferrer">Datenschutzerklärung</a> gelesen und stimme der Verarbeitung meiner Angaben für die Creator-Bewerbung zu. *</span>
          </label>

          <label class="creator-honeypot" aria-hidden="true" tabindex="-1">
            <span>Firma</span>
            <input name="company" type="text" autocomplete="off" tabindex="-1">
          </label>

          <input name="referralCode" type="hidden" value="">
          <input name="privacyNoticeVersion" type="hidden" value="">

          <div class="form-actions creator-submit-actions">
            <button class="button button-primary" type="submit">Bewerbung absenden</button>
          </div>
          <p id="creator-application-status" class="creator-application-status" role="status" aria-live="polite"></p>
          <p class="creator-fallback-copy">Technischer Fallback während der Umstellung: <a href="${TALLY_FALLBACK_URL}" target="_blank" rel="noopener noreferrer">Tally-Schnellbewerbung öffnen</a>.</p>
        </form>
      </section>`;

export function enhanceCreatorApplicationPage(html) {
  if (typeof html !== 'string' || !html.includes('</main>')) {
    throw new Error('CREATOR_PAGE_MARKUP_INVALID');
  }
  if (!html.includes(TALLY_FALLBACK_URL)) {
    throw new Error('CREATOR_TALLY_CTA_NOT_FOUND');
  }

  return html
    .replace(
      `href="${TALLY_FALLBACK_URL}"`,
      'href="#creator-bewerbung"',
    )
    .replace(
      '</head>',
      '  <link rel="stylesheet" href="/creator-application.css">\n  <script src="/creator-application.js" defer></script>\n</head>',
    )
    .replace('</main>', `${applicationSection}\n  </main>`);
}

export { TALLY_FALLBACK_URL };
