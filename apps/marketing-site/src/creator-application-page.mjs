const TALLY_FALLBACK_URL = 'https://tally.so/r/68BbAO';
const PORTAL_JOIN_URL = 'https://app.gmvgang.de/join';
const PORTAL_LOGIN_URL = 'https://app.gmvgang.de/login';

const portalSection = `
      <section id="creator-portal" class="section section-dark" aria-labelledby="creator-portal-heading">
        <p class="kicker">GMVGANG Creator Portal</p>
        <h2 id="creator-portal-heading">Dein Zugang zu GMVGANG.</h2>
        <p>Erstelle deinen Creator-Account im GMVGANG Portal. Dort baust du dein Profil auf, durchläufst die Qualifizierung und erhältst später Zugriff auf Matches, Kampagnen und Performance.</p>
        <div class="action-row">
          <a class="button button-primary" href="${PORTAL_JOIN_URL}">Kostenlos als Creator starten</a>
          <a class="button button-secondary" href="${PORTAL_LOGIN_URL}">Bereits registriert? Zum Portal</a>
        </div>
        <p class="form-note">Falls der Portal-Zugang technisch nicht funktioniert, kannst du vorübergehend die <a href="${TALLY_FALLBACK_URL}" target="_blank" rel="noopener noreferrer">Schnellbewerbung als Fallback öffnen</a>.</p>
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
      `href="${PORTAL_JOIN_URL}"`,
    )
    .replace(
      '>Als Creator bewerben</a>',
      '>Kostenlos als Creator starten</a>',
    )
    .replace('</main>', `${portalSection}\n  </main>`);
}

export { PORTAL_JOIN_URL, PORTAL_LOGIN_URL, TALLY_FALLBACK_URL };
