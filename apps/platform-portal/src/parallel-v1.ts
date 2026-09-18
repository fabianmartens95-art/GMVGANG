type ActivityItem = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  occurred_at: string;
};

type CreatorOnboarding = {
  creator_profile_id: string;
  follower_count: number | null;
  follower_count_source?: "manual" | "tiktok";
  follower_count_verified_at?: string | null;
  content_formats: string[];
  live_status: string;
  onboarding_status: string;
  onboarding_completion_percent: number;
  next_best_action: string;
};

type TikTokConnection = {
  status: "connected" | "reauthorization_required" | "revoked" | "error";
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
  granted_scopes: string[];
  follower_count: number | null;
  following_count: number | null;
  likes_count: number | null;
  video_count: number | null;
  connected_at: string;
  last_synced_at: string | null;
};

type BrandProfile = {
  id: string;
  legal_name: string | null;
  website_url: string | null;
  status: string;
  tiktok_shop_status: string;
  primary_goal: string;
  contact_name: string | null;
  contact_email: string | null;
  onboarding_completion_percent: number;
  next_best_action: string;
};

type BrandProduct = {
  id: string;
  name: string;
  sku: string;
  status: string;
  sale_price_cents: number;
  cogs_cents: number;
  affiliate_commission_bps: number;
  sample_cost_cents: number;
  inventory_units: number;
};

type Campaign = {
  id: string;
  organization_id: string;
  name: string;
  product_id: string | null;
  status: string;
  client_approved: boolean;
  launched_at: string | null;
  completed_at: string | null;
};

type Assignment = {
  id: string;
  campaign_id: string;
  creator_profile_id: string;
  creator_ready: boolean;
  outreach_status: string;
  outreach_reply: string | null;
  sample_status: string;
  content_status: string;
  brief_text: string | null;
  posted_at: string | null;
  gmv_cents: number;
  orders: number;
  commission_cents: number;
};

export type ParallelV1Snapshot = {
  ok: true;
  generatedAt: string;
  brand: null | {
    organizationId: string;
    profile: BrandProfile | null;
    products: BrandProduct[];
    campaigns: Campaign[];
    assignments: Assignment[];
  };
  creator: null | {
    creatorProfileId: string;
    onboarding: CreatorOnboarding | null;
    tiktok: {
      available: boolean;
      connection: TikTokConnection | null;
    };
    assignments: Assignment[];
    campaigns: Campaign[];
  };
  activity: ActivityItem[];
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function option(value: string, label: string, selected: string | null | undefined): string {
  return `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
}

function money(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function percentBps(bps: number): string {
  return new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 2 }).format(bps / 10000);
}

function dateTime(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(parsed);
}

export async function loadParallelV1(organizationId?: string): Promise<ParallelV1Snapshot | null> {
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (organizationId) headers["X-GMVGANG-Organization-Id"] = organizationId;
    const response = await fetch("/api/v1/workspace", {
      credentials: "include",
      cache: "no-store",
      headers,
    });
    if (!response.ok) return null;
    return await response.json() as ParallelV1Snapshot;
  } catch {
    return null;
  }
}

async function mutate(
  action: string,
  payload: Record<string, unknown>,
  organizationId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "Idempotency-Key": `portal:${crypto.randomUUID()}`,
  };
  if (organizationId) headers["X-GMVGANG-Organization-Id"] = organizationId;

  try {
    const response = await fetch("/api/v1/mutate", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers,
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await response.json().catch(() => null) as { error?: unknown } | null;
    return response.ok
      ? { ok: true }
      : { ok: false, error: typeof data?.error === "string" ? data.error : "mutation_failed" };
  } catch {
    return { ok: false, error: "mutation_unavailable" };
  }
}

function panelHeader(kicker: string, title: string, badge?: string): string {
  return `<div class="gmv-panel__header"><div><span class="gmv-kicker">${escapeHtml(kicker)}</span><h2>${escapeHtml(title)}</h2></div>${badge ? `<span class="status status--ready">${escapeHtml(badge)}</span>` : ""}</div>`;
}

export function renderCreatorOnboarding(snapshot: ParallelV1Snapshot | null): string {
  const onboarding = snapshot?.creator?.onboarding ?? null;
  const tiktok = snapshot?.creator?.tiktok ?? { available: false, connection: null };
  const connection = tiktok.connection;
  const completion = onboarding?.onboarding_completion_percent ?? 0;
  const formats = new Set(onboarding?.content_formats ?? []);
  const verifiedFollowerCount = connection?.status === "connected" && typeof connection.follower_count === "number"
    ? connection.follower_count
    : null;
  const followerValue = verifiedFollowerCount ?? onboarding?.follower_count ?? "";
  const checkbox = (value: string, label: string) =>
    `<label class="gmv-field"><span><input type="checkbox" name="contentFormats" value="${value}"${formats.has(value) ? " checked" : ""} /> ${label}</span></label>`;

  let tiktokBlock = "";
  if (connection?.status === "connected") {
    const accountLabel = connection.username
      ? `@${escapeHtml(connection.username)}`
      : escapeHtml(connection.display_name ?? "TikTok verbunden");
    const metrics = [
      typeof connection.follower_count === "number" ? `${connection.follower_count.toLocaleString("de-DE")} Follower` : null,
      typeof connection.video_count === "number" ? `${connection.video_count.toLocaleString("de-DE")} Videos` : null,
      connection.last_synced_at ? `Sync ${dateTime(connection.last_synced_at)}` : null,
    ].filter(Boolean).join(" · ");
    tiktokBlock = `
      <aside class="gmv-tiktok gmv-tiktok--connected">
        <div>
          <span class="gmv-kicker">TIKTOK VERBUNDEN</span>
          <h3>${accountLabel}${connection.is_verified ? " · ✓ verifiziert" : ""}</h3>
          <p class="gmv-help">${escapeHtml(metrics || "Account erfolgreich verbunden.")}</p>
        </div>
        <div class="gmv-actions">
          <button class="gmv-button gmv-button--secondary" type="button" data-tiktok-action="sync">Jetzt synchronisieren</button>
          <button class="gmv-button gmv-button--secondary" type="button" data-tiktok-action="disconnect">Verbindung trennen</button>
        </div>
        <div class="gmv-result" data-tiktok-result aria-live="polite"></div>
      </aside>`;
  } else if (tiktok.available) {
    const reconnect = connection?.status === "reauthorization_required" || connection?.status === "revoked";
    tiktokBlock = `
      <aside class="gmv-tiktok">
        <div>
          <span class="gmv-kicker">TIKTOK ACCOUNT</span>
          <h3>${reconnect ? "TikTok erneut verbinden" : "TikTok-Konto verbinden"}</h3>
          <p class="gmv-help">Verbinde deinen Account, damit Profil- und Followerwerte direkt über TikTok synchronisiert und als verifiziert markiert werden können.</p>
        </div>
        <a class="gmv-button" href="/api/integrations/tiktok/connect">${reconnect ? "Erneut verbinden" : "TikTok verbinden"}</a>
      </aside>`;
  }

  return `
    <section class="gmv-panel">
      ${panelHeader("CREATOR ONBOARDING", "Dein Setup", `${completion}%`)}
      <div class="gmv-progress"><span style="width:${Math.max(0, Math.min(100, completion))}%"></span></div>
      <p class="gmv-help">Next Best Action: <strong>${escapeHtml(onboarding?.next_best_action ?? "complete_creator_onboarding")}</strong></p>
      ${tiktokBlock}
      <form class="gmv-form" data-parallel-action="creator_onboarding_upsert">
        <div class="gmv-grid">
          <label class="gmv-field">
            <span>Follower${verifiedFollowerCount !== null ? ' · <strong class="gmv-verified-source">TikTok synchronisiert</strong>' : ""}</span>
            <input class="gmv-input" name="followerCount" type="number" min="0" step="1" value="${followerValue}" placeholder="z. B. 25000"${verifiedFollowerCount !== null ? " disabled" : ""} />
            ${verifiedFollowerCount !== null ? `<input type="hidden" name="followerCount" value="${verifiedFollowerCount}" />` : ""}
          </label>
          <label class="gmv-field">
            <span>LIVE Status</span>
            <select class="gmv-select" name="liveStatus">
              ${option("unknown", "Noch nicht angegeben", onboarding?.live_status)}
              ${option("not_live", "Kein LIVE", onboarding?.live_status)}
              ${option("occasional", "Gelegentlich LIVE", onboarding?.live_status)}
              ${option("regular", "Regelmäßig LIVE", onboarding?.live_status)}
            </select>
          </label>
        </div>
        <div>
          <span class="gmv-help">Content-Formate</span>
          <div class="gmv-grid gmv-grid--3">
            ${checkbox("shoppable_video", "Shoppable Video")}
            ${checkbox("live_shopping", "LIVE Shopping")}
            ${checkbox("ugc", "UGC")}
            ${checkbox("reviews", "Reviews")}
            ${checkbox("tutorials", "Tutorials")}
            ${checkbox("lifestyle", "Lifestyle")}
          </div>
        </div>
        <div class="gmv-actions">
          <button class="gmv-button" type="submit">Onboarding speichern</button>
        </div>
        <div class="gmv-result" aria-live="polite"></div>
      </form>
    </section>`;
}

export function renderBrandSetup(snapshot: ParallelV1Snapshot | null): string {
  const profile = snapshot?.brand?.profile ?? null;
  const completion = profile?.onboarding_completion_percent ?? 0;
  return `
    <section class="gmv-panel">
      ${panelHeader("BRAND ONBOARDING", "Workspace einrichten", `${completion}%`)}
      <div class="gmv-progress"><span style="width:${Math.max(0, Math.min(100, completion))}%"></span></div>
      <p class="gmv-help">Next Best Action: <strong>${escapeHtml(profile?.next_best_action ?? "complete_brand_profile")}</strong></p>
      <form class="gmv-form" data-parallel-action="brand_profile_upsert">
        <div class="gmv-grid">
          <label class="gmv-field"><span>Unternehmen / Legal Name</span><input class="gmv-input" name="legalName" value="${escapeHtml(profile?.legal_name ?? "")}" required maxlength="200" /></label>
          <label class="gmv-field"><span>Website</span><input class="gmv-input" name="websiteUrl" type="url" value="${escapeHtml(profile?.website_url ?? "")}" placeholder="https://…" /></label>
          <label class="gmv-field"><span>Ansprechpartner</span><input class="gmv-input" name="contactName" value="${escapeHtml(profile?.contact_name ?? "")}" /></label>
          <label class="gmv-field"><span>Business E-Mail</span><input class="gmv-input" name="contactEmail" type="email" value="${escapeHtml(profile?.contact_email ?? "")}" /></label>
          <label class="gmv-field"><span>TikTok Shop</span><select class="gmv-select" name="tiktokShopStatus">
            ${option("not_connected", "Noch nicht verbunden", profile?.tiktok_shop_status)}
            ${option("setup", "Im Setup", profile?.tiktok_shop_status)}
            ${option("active", "Aktiv", profile?.tiktok_shop_status)}
            ${option("paused", "Pausiert", profile?.tiktok_shop_status)}
          </select></label>
          <label class="gmv-field"><span>Primäres Ziel</span><select class="gmv-select" name="primaryGoal">
            ${option("creator_growth", "Creator Growth", profile?.primary_goal)}
            ${option("content_testing", "Content Testing", profile?.primary_goal)}
            ${option("shop_growth", "Shop Growth", profile?.primary_goal)}
            ${option("live_growth", "LIVE Growth", profile?.primary_goal)}
            ${option("profitability", "Profitabilität", profile?.primary_goal)}
          </select></label>
        </div>
        <input type="hidden" name="status" value="${escapeHtml(profile?.status ?? "onboarding")}" />
        <button class="gmv-button" type="submit">Brand-Profil speichern</button>
        <div class="gmv-result" aria-live="polite"></div>
      </form>
    </section>`;
}

export function renderBrandProducts(snapshot: ParallelV1Snapshot | null): string {
  const products = snapshot?.brand?.products ?? [];
  const rows = products.length
    ? products.map((product) => `<tr>
        <td><strong>${escapeHtml(product.name)}</strong><br><span class="gmv-help">${escapeHtml(product.sku)}</span></td>
        <td>${escapeHtml(product.status)}</td>
        <td>${money(product.sale_price_cents)}</td>
        <td>${money(product.cogs_cents)}</td>
        <td>${percentBps(product.affiliate_commission_bps)}</td>
        <td>${product.inventory_units}</td>
      </tr>`).join("")
    : '<tr><td colspan="6"><div class="gmv-empty">Noch keine Produkte angelegt.</div></td></tr>';

  return `
    <section class="gmv-panel">
      ${panelHeader("PRODUCT CATALOG", "Produkte & SKUs", `${products.length} Produkte`)}
      <div class="gmv-table-wrap"><table class="gmv-table"><thead><tr><th>Produkt</th><th>Status</th><th>Preis</th><th>COGS</th><th>Provision</th><th>Bestand</th></tr></thead><tbody>${rows}</tbody></table></div>
    </section>
    <section class="gmv-panel">
      ${panelHeader("NEW SKU", "Produkt anlegen")}
      <form class="gmv-form" data-parallel-action="brand_product_upsert">
        <div class="gmv-grid gmv-grid--3">
          <label class="gmv-field"><span>Produktname</span><input class="gmv-input" name="name" required maxlength="200" /></label>
          <label class="gmv-field"><span>SKU</span><input class="gmv-input" name="sku" required maxlength="128" /></label>
          <label class="gmv-field"><span>Status</span><select class="gmv-select" name="status"><option value="draft">Draft</option><option value="active">Aktiv</option></select></label>
          <label class="gmv-field"><span>Verkaufspreis (€)</span><input class="gmv-input" name="salePrice" type="number" min="0" step="0.01" value="0" /></label>
          <label class="gmv-field"><span>COGS (€)</span><input class="gmv-input" name="cogs" type="number" min="0" step="0.01" value="0" /></label>
          <label class="gmv-field"><span>Affiliate Provision (%)</span><input class="gmv-input" name="affiliateCommission" type="number" min="0" max="100" step="0.01" value="0" /></label>
          <label class="gmv-field"><span>Sample-Kosten (€)</span><input class="gmv-input" name="sampleCost" type="number" min="0" step="0.01" value="0" /></label>
          <label class="gmv-field"><span>Bestand</span><input class="gmv-input" name="inventoryUnits" type="number" min="0" step="1" value="0" /></label>
          <label class="gmv-field"><span>TikTok Shop URL</span><input class="gmv-input" name="tiktokShopUrl" type="url" /></label>
        </div>
        <button class="gmv-button" type="submit">Produkt anlegen</button>
        <div class="gmv-result" aria-live="polite"></div>
      </form>
    </section>`;
}

export function renderBrandCampaigns(snapshot: ParallelV1Snapshot | null): string {
  const campaigns = snapshot?.brand?.campaigns ?? [];
  const products = snapshot?.brand?.products ?? [];
  const assignments = snapshot?.brand?.assignments ?? [];
  const rows = campaigns.length
    ? campaigns.map((campaign) => {
        const count = assignments.filter((item) => item.campaign_id === campaign.id).length;
        return `<tr><td><strong>${escapeHtml(campaign.name)}</strong><br><span class="gmv-help">${escapeHtml(campaign.id)}</span></td><td>${escapeHtml(campaign.status)}</td><td>${count}</td><td>${campaign.client_approved ? "Ja" : "Nein"}</td></tr>`;
      }).join("")
    : '<tr><td colspan="4"><div class="gmv-empty">Noch keine Campaign angelegt.</div></td></tr>';

  return `
    <section class="gmv-panel">
      ${panelHeader("CAMPAIGN CONTROL", "Campaigns", `${campaigns.length} aktiv/gespeichert`)}
      <div class="gmv-table-wrap"><table class="gmv-table"><thead><tr><th>Campaign</th><th>Status</th><th>Creator</th><th>Freigabe</th></tr></thead><tbody>${rows}</tbody></table></div>
    </section>
    <section class="gmv-panel">
      ${panelHeader("CREATE", "Neue Campaign")}
      <form class="gmv-form" data-parallel-action="campaign_create">
        <div class="gmv-grid">
          <label class="gmv-field"><span>Name</span><input class="gmv-input" name="name" required maxlength="200" /></label>
          <label class="gmv-field"><span>Produkt</span><select class="gmv-select" name="productId"><option value="">Noch ohne Produkt</option>${products.map((product) => option(product.id, `${product.name} · ${product.sku}`, null)).join("")}</select></label>
        </div>
        <button class="gmv-button" type="submit">Campaign anlegen</button>
        <div class="gmv-result" aria-live="polite"></div>
      </form>
    </section>
    <section class="gmv-panel">
      ${panelHeader("CREATOR ASSIGNMENT", "Creator zuordnen")}
      <form class="gmv-form" data-parallel-action="campaign_assignment_upsert">
        <div class="gmv-grid">
          <label class="gmv-field"><span>Campaign</span><select class="gmv-select" name="campaignId" required><option value="">Campaign wählen</option>${campaigns.map((campaign) => option(campaign.id, campaign.name, null)).join("")}</select></label>
          <label class="gmv-field"><span>Creator Profile ID</span><input class="gmv-input" name="creatorProfileId" required placeholder="UUID" /></label>
        </div>
        <label class="gmv-field"><span>Briefing</span><textarea class="gmv-textarea" name="briefText" maxlength="10000"></textarea></label>
        <input type="hidden" name="outreachStatus" value="queued" />
        <input type="hidden" name="sampleStatus" value="not_requested" />
        <input type="hidden" name="contentStatus" value="not_started" />
        <button class="gmv-button" type="submit">Creator zuordnen</button>
        <div class="gmv-result" aria-live="polite"></div>
      </form>
    </section>`;
}

export function renderCreatorNativeCampaigns(snapshot: ParallelV1Snapshot | null, organizationId?: string): string {
  const creator = snapshot?.creator;
  if (!creator || creator.assignments.length === 0) {
    return `<section class="gmv-panel">${panelHeader("NATIVE CAMPAIGNS", "Opportunities")}<div class="gmv-empty">Noch keine native Campaign-Opportunity vorhanden.</div></section>`;
  }
  const campaigns = new Map(creator.campaigns.map((campaign) => [campaign.id, campaign]));
  return creator.assignments.map((assignment) => {
    const campaign = campaigns.get(assignment.campaign_id);
    const accepted = assignment.outreach_status === "accepted";
    return `
      <section class="gmv-panel">
        ${panelHeader("OPPORTUNITY", campaign?.name ?? "Campaign", assignment.outreach_status)}
        <div class="gmv-grid gmv-grid--3">
          <div class="gmv-metric"><span>Sample</span><strong>${escapeHtml(assignment.sample_status)}</strong></div>
          <div class="gmv-metric"><span>Content</span><strong>${escapeHtml(assignment.content_status)}</strong></div>
          <div class="gmv-metric"><span>GMV</span><strong>${money(assignment.gmv_cents)}</strong></div>
        </div>
        ${assignment.brief_text ? `<p>${escapeHtml(assignment.brief_text)}</p>` : ""}
        <div class="gmv-actions">
          <button class="gmv-button" type="button" data-assignment-decision="accepted" data-assignment-id="${assignment.id}" data-organization-id="${organizationId ?? campaign?.organization_id ?? ""}">Annehmen</button>
          <button class="gmv-button gmv-button--secondary" type="button" data-assignment-decision="declined" data-assignment-id="${assignment.id}" data-organization-id="${organizationId ?? campaign?.organization_id ?? ""}">Ablehnen</button>
        </div>
        ${accepted ? `
          <form class="gmv-form" data-parallel-action="content_submit" data-organization-id="${organizationId ?? campaign?.organization_id ?? ""}">
            <input type="hidden" name="assignmentId" value="${assignment.id}" />
            <label class="gmv-field"><span>Content URL</span><input class="gmv-input" name="contentUrl" type="url" required placeholder="https://www.tiktok.com/…" /></label>
            <button class="gmv-button" type="submit">Content einreichen</button>
            <div class="gmv-result" aria-live="polite"></div>
          </form>` : ""}
      </section>`;
  }).join("");
}

export function renderActivity(snapshot: ParallelV1Snapshot | null): string {
  const items = snapshot?.activity ?? [];
  if (!items.length) {
    return `<section class="gmv-panel">${panelHeader("ACTIVITY", "Aktivitätsverlauf")}<div class="gmv-empty">Noch keine Aktivität für diesen Workspace.</div></section>`;
  }
  return `
    <section class="gmv-panel">
      ${panelHeader("ACTIVITY", "Aktivitätsverlauf", `${items.length} Events`)}
      <div class="gmv-activity">
        ${items.map((item) => `<div class="gmv-activity__item"><span>${dateTime(item.occurred_at)}</span><strong>${escapeHtml(item.summary)}</strong><span>${escapeHtml(item.event_type)}</span></div>`).join("")}
      </div>
    </section>`;
}

function cents(value: FormDataEntryValue | null): number {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
}

function bps(value: FormDataEntryValue | null): number {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
}

function payloadFor(action: string, data: FormData): Record<string, unknown> {
  if (action === "creator_onboarding_upsert") {
    return {
      followerCount: data.get("followerCount") === "" ? null : Number(data.get("followerCount")),
      liveStatus: String(data.get("liveStatus") ?? "unknown"),
      contentFormats: data.getAll("contentFormats").map(String),
    };
  }
  if (action === "brand_profile_upsert") {
    return {
      legalName: String(data.get("legalName") ?? ""),
      websiteUrl: String(data.get("websiteUrl") ?? ""),
      contactName: String(data.get("contactName") ?? ""),
      contactEmail: String(data.get("contactEmail") ?? ""),
      status: String(data.get("status") ?? "onboarding"),
      tiktokShopStatus: String(data.get("tiktokShopStatus") ?? "not_connected"),
      primaryGoal: String(data.get("primaryGoal") ?? "creator_growth"),
    };
  }
  if (action === "brand_product_upsert") {
    return {
      name: String(data.get("name") ?? ""),
      sku: String(data.get("sku") ?? ""),
      status: String(data.get("status") ?? "draft"),
      salePriceCents: cents(data.get("salePrice")),
      cogsCents: cents(data.get("cogs")),
      affiliateCommissionBps: bps(data.get("affiliateCommission")),
      sampleCostCents: cents(data.get("sampleCost")),
      inventoryUnits: Number(data.get("inventoryUnits") ?? 0),
      tiktokShopUrl: String(data.get("tiktokShopUrl") ?? ""),
    };
  }
  if (action === "campaign_create") {
    return {
      name: String(data.get("name") ?? ""),
      productId: String(data.get("productId") ?? "") || null,
    };
  }
  if (action === "campaign_assignment_upsert") {
    return {
      campaignId: String(data.get("campaignId") ?? ""),
      creatorProfileId: String(data.get("creatorProfileId") ?? ""),
      creatorReady: false,
      outreachStatus: String(data.get("outreachStatus") ?? "queued"),
      sampleStatus: String(data.get("sampleStatus") ?? "not_requested"),
      contentStatus: String(data.get("contentStatus") ?? "not_started"),
      briefText: String(data.get("briefText") ?? ""),
    };
  }
  if (action === "content_submit") {
    return {
      assignmentId: String(data.get("assignmentId") ?? ""),
      contentUrl: String(data.get("contentUrl") ?? ""),
    };
  }
  return {};
}

export function wireParallelV1(organizationId?: string): void {
  document.querySelectorAll<HTMLFormElement>("form[data-parallel-action]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const action = form.dataset.parallelAction;
      if (!action) return;
      const result = form.querySelector<HTMLDivElement>(".gmv-result");
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      const formOrganizationId = form.dataset.organizationId || organizationId;
      if (button) button.disabled = true;
      if (result) {
        result.dataset.tone = "";
        result.textContent = "Wird gespeichert …";
      }
      const response = await mutate(action, payloadFor(action, new FormData(form)), formOrganizationId);
      if (!response.ok) {
        if (result) {
          result.dataset.tone = "error";
          result.textContent = `Fehler: ${response.error ?? "mutation_failed"}`;
        }
        if (button) button.disabled = false;
        return;
      }
      if (result) {
        result.dataset.tone = "success";
        result.textContent = "Gespeichert.";
      }
      window.location.reload();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("button[data-tiktok-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.tiktokAction;
      if (action !== "sync" && action !== "disconnect") return;
      const container = button.closest<HTMLElement>(".gmv-tiktok");
      const result = container?.querySelector<HTMLElement>("[data-tiktok-result]");
      button.disabled = true;
      if (result) {
        result.dataset.tone = "";
        result.textContent = action === "sync" ? "TikTok wird synchronisiert …" : "Verbindung wird getrennt …";
      }

      try {
        const response = await fetch(`/api/integrations/tiktok/${action}`, {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        const payload = await response.json().catch(() => null) as { error?: unknown } | null;
        if (!response.ok) {
          if (result) {
            result.dataset.tone = "error";
            result.textContent = typeof payload?.error === "string" ? `Fehler: ${payload.error}` : "TikTok-Aktion fehlgeschlagen.";
          }
          button.disabled = false;
          return;
        }
        window.location.reload();
      } catch {
        if (result) {
          result.dataset.tone = "error";
          result.textContent = "TikTok-Aktion aktuell nicht erreichbar.";
        }
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>("button[data-assignment-decision]").forEach((button) => {
    button.addEventListener("click", async () => {
      const assignmentId = button.dataset.assignmentId;
      const decision = button.dataset.assignmentDecision;
      const targetOrganizationId = button.dataset.organizationId || organizationId;
      if (!assignmentId || !decision || !targetOrganizationId) return;
      button.disabled = true;
      const response = await mutate("creator_assignment_response", { assignmentId, decision }, targetOrganizationId);
      if (!response.ok) {
        button.disabled = false;
        return;
      }
      window.location.reload();
    });
  });
}
