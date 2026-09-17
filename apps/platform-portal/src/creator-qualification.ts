import {
  parseCreatorQualificationInput,
  type CreatorQualification,
  type CreatorQualificationInput,
} from "@gmvgang/creator-qualification";
import type { CreatorProfile } from "@gmvgang/platform-foundation";

export interface CreatorQualificationPort {
  getQualification(): Promise<CreatorQualification | null>;
  saveQualification(input: CreatorQualificationInput): Promise<CreatorQualification>;
}

export class HttpCreatorQualificationAdapter implements CreatorQualificationPort {
  async getQualification(): Promise<CreatorQualification | null> {
    const response = await fetch("/api/creator/qualification", {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (response.status === 404) return null;
    const payload = await response.json() as { ok?: boolean; qualification?: CreatorQualification };
    if (!response.ok || payload.ok !== true || !payload.qualification) throw new Error("CREATOR_QUALIFICATION_LOAD_FAILED");
    return payload.qualification;
  }

  async saveQualification(input: CreatorQualificationInput): Promise<CreatorQualification> {
    const response = await fetch("/api/creator/qualification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      credentials: "same-origin",
      body: JSON.stringify(input),
    });
    const payload = await response.json() as { ok?: boolean; qualification?: CreatorQualification; errors?: string[] };
    if (!response.ok || payload.ok !== true || !payload.qualification) {
      const code = payload.errors?.[0] ?? "creator_qualification_save_failed";
      throw new Error(code);
    }
    return payload.qualification;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function selected(current: string | undefined, value: string): string {
  return current === value ? " selected" : "";
}

function checked(values: readonly string[] | undefined, value: string): string {
  return values?.includes(value) ? " checked" : "";
}

function readonlySummary(qualification: CreatorQualification): string {
  const formats = qualification.contentFormats.map((value) => value.replaceAll("_", " ")).join(", ");
  const categories = qualification.contentCategories.map((value) => value.replaceAll("_", " ")).join(", ");
  return `
    <section class="qualification-summary">
      <div><span>TikTok Shop</span><strong>${escapeHtml(qualification.shopEnabled)}</strong></div>
      <div><span>Content</span><strong>${escapeHtml(formats)}</strong></div>
      <div><span>Kategorien</span><strong>${escapeHtml(categories)}</strong></div>
      <div><span>Videos/Woche</span><strong>${escapeHtml(qualification.videosPerWeekBand.replaceAll("_", " "))}</strong></div>
      <div><span>Sample → Video</span><strong>${escapeHtml(qualification.sampleTurnaroundBand.replaceAll("_", " "))}</strong></div>
      <div><span>Letzte Aktualisierung</span><strong>${escapeHtml(new Date(qualification.updatedAt).toLocaleDateString("de-DE"))}</strong></div>
    </section>`;
}

export function renderCreatorQualification(profile: CreatorProfile, qualification: CreatorQualification | null): string {
  if (profile.networkStatus === "registered") {
    return `
      <section class="qualification-shell">
        <div class="qualification-state qualification-state--blocked">
          <span>R2 · NOCH GESPERRT</span>
          <h2>Profil zuerst vervollständigen.</h2>
          <p>Runde 2 wird freigeschaltet, sobald Markt, Sprache und Content-Kategorien im Creator-Profil vollständig hinterlegt sind.</p>
          <a class="button" href="/creator/profile" data-nav>Profil vervollständigen</a>
        </div>
      </section>`;
  }

  if (profile.networkStatus !== "profile_complete") {
    return `
      <section class="qualification-shell">
        <div class="qualification-state">
          <span>R2 · EINGEREICHT</span>
          <h2>Qualifizierung ist gesperrt.</h2>
          <p>Dein Netzwerkstatus wurde bereits intern weitergeführt. Deine R2-Selbstauskunft bleibt als Snapshot erhalten und kann nicht mehr überschrieben werden.</p>
          ${qualification ? readonlySummary(qualification) : "<p>Für diesen Account liegt kein editierbarer R2-Snapshot vor.</p>"}
        </div>
      </section>`;
  }

  const q = qualification;
  return `
    <section class="qualification-shell">
      <div class="qualification-head">
        <div>
          <span class="qualification-kicker">R2 · CREATOR QUALIFIZIERUNG</span>
          <h2>Shop, Content und Umsetzung.</h2>
          <p>Diese Angaben ersetzen schrittweise das bisherige Runde-2-Formular. Noch keine Adresse, Bank-, Steuer- oder Ausweisdaten.</p>
        </div>
        <span class="qualification-version">r2-v3.0</span>
      </div>

      <div id="qualification-message" class="qualification-message" hidden></div>

      <form id="creator-qualification-form" class="qualification-form" novalidate>
        <fieldset>
          <legend>01 · TikTok Shop</legend>
          <label>TikTok Shop für Creator freigeschaltet?
            <select name="shopEnabled" required>
              <option value="">Bitte wählen</option>
              <option value="yes"${selected(q?.shopEnabled, "yes")}>Ja</option>
              <option value="no"${selected(q?.shopEnabled, "no")}>Nein</option>
              <option value="unknown"${selected(q?.shopEnabled, "unknown")}>Weiß ich nicht</option>
            </select>
          </label>
          <label data-shop-gmv>Ungefährer TikTok-Shop-GMV der letzten 30 Tage
            <select name="shopGmv30dBand">
              <option value="">Bitte wählen</option>
              <option value="none"${selected(q?.shopGmv30dBand, "none")}>Noch kein GMV</option>
              <option value="lt_500"${selected(q?.shopGmv30dBand, "lt_500")}>Unter 500 €</option>
              <option value="500_2500"${selected(q?.shopGmv30dBand, "500_2500")}>500–2.500 €</option>
              <option value="2500_10000"${selected(q?.shopGmv30dBand, "2500_10000")}>2.500–10.000 €</option>
              <option value="10000_plus"${selected(q?.shopGmv30dBand, "10000_plus")}>10.000 €+</option>
            </select>
          </label>
        </fieldset>

        <fieldset>
          <legend>02 · Content & LIVE</legend>
          <div class="qualification-checks">
            <span>Welche Formate möchtest du umsetzen?</span>
            <label><input type="checkbox" name="contentFormats" value="shoppable_video"${checked(q?.contentFormats, "shoppable_video")}> Shoppable Videos</label>
            <label><input type="checkbox" name="contentFormats" value="live_shopping"${checked(q?.contentFormats, "live_shopping")}> LIVE Shopping</label>
            <label><input type="checkbox" name="contentFormats" value="ugc"${checked(q?.contentFormats, "ugc")}> UGC</label>
            <label><input type="checkbox" name="contentFormats" value="entertainment_community"${checked(q?.contentFormats, "entertainment_community")}> Entertainment / Community</label>
          </div>
          <div class="qualification-live-grid" data-live-fields>
            <label>LIVE-Erfahrung
              <select name="liveExperience">
                <option value="">Bitte wählen</option>
                <option value="none"${selected(q?.liveExperience, "none")}>Keine</option>
                <option value="basic"${selected(q?.liveExperience, "basic")}>Basis</option>
                <option value="experienced"${selected(q?.liveExperience, "experienced")}>Erfahren</option>
                <option value="pro"${selected(q?.liveExperience, "pro")}>Pro</option>
              </select>
            </label>
            <label>Realistische LIVE-Frequenz
              <select name="liveFrequency">
                <option value="">Bitte wählen</option>
                <option value="none"${selected(q?.liveFrequency, "none")}>Keine</option>
                <option value="weekly_1"${selected(q?.liveFrequency, "weekly_1")}>1× pro Woche</option>
                <option value="weekly_2_3"${selected(q?.liveFrequency, "weekly_2_3")}>2–3× pro Woche</option>
                <option value="weekly_4_plus"${selected(q?.liveFrequency, "weekly_4_plus")}>4×+ pro Woche</option>
              </select>
            </label>
            <label>Typische gleichzeitige Zuschauer
              <select name="liveConcurrentViewers">
                <option value="">Bitte wählen</option>
                <option value="not_live"${selected(q?.liveConcurrentViewers, "not_live")}>Noch nicht live</option>
                <option value="lt_25"${selected(q?.liveConcurrentViewers, "lt_25")}>Unter 25</option>
                <option value="25_100"${selected(q?.liveConcurrentViewers, "25_100")}>25–100</option>
                <option value="100_500"${selected(q?.liveConcurrentViewers, "100_500")}>100–500</option>
                <option value="500_plus"${selected(q?.liveConcurrentViewers, "500_plus")}>500+</option>
              </select>
            </label>
          </div>
          <label>Produktionsstil
            <select name="productionStyle" required>
              <option value="">Bitte wählen</option>
              <option value="faceless"${selected(q?.productionStyle, "faceless")}>Faceless</option>
              <option value="face"${selected(q?.productionStyle, "face")}>Mit Gesicht</option>
              <option value="mixed"${selected(q?.productionStyle, "mixed")}>Gemischt</option>
            </select>
          </label>
          <label>Content-Sprache
            <select name="contentLanguage" required>
              <option value="">Bitte wählen</option>
              <option value="de"${selected(q?.contentLanguage, "de")}>Deutsch</option>
              <option value="en"${selected(q?.contentLanguage, "en")}>Englisch</option>
              <option value="de_en"${selected(q?.contentLanguage, "de_en")}>Deutsch & Englisch</option>
              <option value="other"${selected(q?.contentLanguage, "other")}>Andere</option>
            </select>
          </label>
          <div class="qualification-checks qualification-checks--categories">
            <span>Beste Produktkategorien · 1–3</span>
            ${[
              ["beauty", "Beauty"], ["fashion", "Fashion"], ["lifestyle", "Lifestyle"], ["food", "Food"],
              ["tech", "Technik"], ["fitness", "Fitness"], ["gaming", "Gaming"], ["family", "Familie"],
              ["entertainment", "Entertainment"], ["home_living", "Home & Living"], ["health_wellness", "Health & Wellness"],
              ["pet", "Pet"], ["other", "Sonstiges"],
            ].map(([value, label]) => `<label><input type="checkbox" name="contentCategories" value="${value}"${checked(q?.contentCategories, value)}> ${label}</label>`).join("")}
          </div>
          <label>Optional: repräsentatives TikTok-Video
            <input name="representativeVideoUrl" type="url" inputmode="url" placeholder="https://www.tiktok.com/..." value="${escapeHtml(q?.representativeVideoUrl ?? "")}">
          </label>
        </fieldset>

        <fieldset>
          <legend>03 · Verfügbarkeit & Risiko</legend>
          <label>Aktuell an andere TikTok-Shop-Agentur / Management gebunden?
            <select name="agencyBinding" required>
              <option value="">Bitte wählen</option>
              <option value="none"${selected(q?.agencyBinding, "none")}>Nein</option>
              <option value="non_exclusive"${selected(q?.agencyBinding, "non_exclusive")}>Ja, nicht exklusiv</option>
              <option value="exclusive"${selected(q?.agencyBinding, "exclusive")}>Ja, exklusiv</option>
              <option value="unsure"${selected(q?.agencyBinding, "unsure")}>Unsicher</option>
            </select>
          </label>
          <label>Videos pro Woche
            <select name="videosPerWeekBand" required>
              <option value="">Bitte wählen</option>
              <option value="weekly_1_2"${selected(q?.videosPerWeekBand, "weekly_1_2")}>1–2</option>
              <option value="weekly_3_5"${selected(q?.videosPerWeekBand, "weekly_3_5")}>3–5</option>
              <option value="weekly_6_plus"${selected(q?.videosPerWeekBand, "weekly_6_plus")}>6+</option>
              <option value="open"${selected(q?.videosPerWeekBand, "open")}>Offen / flexibel</option>
            </select>
          </label>
          <label>Sample bis erstes Video
            <select name="sampleTurnaroundBand" required>
              <option value="">Bitte wählen</option>
              <option value="days_3_5"${selected(q?.sampleTurnaroundBand, "days_3_5")}>3–5 Tage</option>
              <option value="days_6_7"${selected(q?.sampleTurnaroundBand, "days_6_7")}>6–7 Tage</option>
              <option value="days_8_14"${selected(q?.sampleTurnaroundBand, "days_8_14")}>8–14 Tage</option>
              <option value="gt_14"${selected(q?.sampleTurnaroundBand, "gt_14")}>Mehr als 14 Tage</option>
            </select>
          </label>
          <label>Relevante TikTok/TikTok-Shop-Warnungen oder Einschränkungen in den letzten 90 Tagen?
            <select name="violationStatus" required>
              <option value="">Bitte wählen</option>
              <option value="none"${selected(q?.violationStatus, "none")}>Nein</option>
              <option value="resolved"${selected(q?.violationStatus, "resolved")}>Ja, erledigt</option>
              <option value="active"${selected(q?.violationStatus, "active")}>Ja, aktiv</option>
              <option value="unsure"${selected(q?.violationStatus, "unsure")}>Unsicher</option>
            </select>
          </label>
          <label data-violation-reason>Kurze Einordnung
            <textarea name="violationReason" maxlength="500" rows="4">${escapeHtml(q?.violationReason ?? "")}</textarea>
          </label>
        </fieldset>

        <div class="qualification-actions">
          <button class="button" type="submit">${q ? "R2 aktualisieren" : "R2 einreichen"}</button>
          <span>Interne Freigabe erfolgt separat. Diese Selbstauskunft qualifiziert dich nicht automatisch.</span>
        </div>
      </form>
    </section>`;
}

function values(form: HTMLFormElement): CreatorQualificationInput | null {
  const data = new FormData(form);
  const candidate = {
    shopEnabled: data.get("shopEnabled"),
    shopGmv30dBand: data.get("shopGmv30dBand") || undefined,
    contentFormats: data.getAll("contentFormats"),
    liveExperience: data.get("liveExperience") || undefined,
    liveFrequency: data.get("liveFrequency") || undefined,
    liveConcurrentViewers: data.get("liveConcurrentViewers") || undefined,
    productionStyle: data.get("productionStyle"),
    contentLanguage: data.get("contentLanguage"),
    contentCategories: data.getAll("contentCategories"),
    representativeVideoUrl: data.get("representativeVideoUrl") || undefined,
    agencyBinding: data.get("agencyBinding"),
    videosPerWeekBand: data.get("videosPerWeekBand"),
    sampleTurnaroundBand: data.get("sampleTurnaroundBand"),
    violationStatus: data.get("violationStatus"),
    violationReason: data.get("violationReason") || undefined,
  };
  return parseCreatorQualificationInput(candidate);
}

export function wireCreatorQualification(port: CreatorQualificationPort): void {
  const form = document.querySelector<HTMLFormElement>("#creator-qualification-form");
  if (!form) return;
  const shop = form.elements.namedItem("shopEnabled") as HTMLSelectElement | null;
  const live = [...form.querySelectorAll<HTMLInputElement>('input[name="contentFormats"]')];
  const violation = form.elements.namedItem("violationStatus") as HTMLSelectElement | null;
  const message = document.querySelector<HTMLElement>("#qualification-message");

  const refreshConditional = () => {
    const shopGmv = form.querySelector<HTMLElement>("[data-shop-gmv]");
    if (shopGmv) shopGmv.hidden = shop?.value !== "yes";
    const liveFields = form.querySelector<HTMLElement>("[data-live-fields]");
    if (liveFields) liveFields.hidden = !live.some((input) => input.value === "live_shopping" && input.checked);
    const violationReason = form.querySelector<HTMLElement>("[data-violation-reason]");
    if (violationReason) violationReason.hidden = !violation?.value || violation.value === "none";
  };

  shop?.addEventListener("change", refreshConditional);
  live.forEach((input) => input.addEventListener("change", refreshConditional));
  violation?.addEventListener("change", refreshConditional);
  refreshConditional();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = values(form);
    if (!input) {
      if (message) {
        message.hidden = false;
        message.dataset.tone = "error";
        message.textContent = "Bitte prüfe die Pflichtfelder, LIVE-Angaben, Kategorien und mögliche Warnhinweise.";
      }
      return;
    }

    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      await port.saveQualification(input);
      if (message) {
        message.hidden = false;
        message.dataset.tone = "success";
        message.textContent = "Runde 2 wurde gespeichert. GMVGANG prüft die Angaben intern; dein Netzwerkstatus ändert sich dadurch noch nicht automatisch.";
      }
    } catch (error) {
      if (message) {
        message.hidden = false;
        message.dataset.tone = "error";
        message.textContent = error instanceof Error && error.message === "creator_qualification_not_ready"
          ? "Runde 2 ist für deinen aktuellen Netzwerkstatus nicht mehr editierbar."
          : "Runde 2 konnte nicht gespeichert werden. Bitte versuche es erneut.";
      }
    } finally {
      if (submit) submit.disabled = false;
    }
  });
}
