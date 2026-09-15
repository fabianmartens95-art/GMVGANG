import type { CampaignCockpitView, CreatorCockpitRow, PortfolioCockpitView } from "./model";
import type { CockpitRuntimeSnapshot } from "./runtime";
import { escapeHtml, euro, integer, label, percentage, pill } from "./format";

export type CreatorFilter = "all" | "action" | "sample" | "content";

function stat(title: string, value: string, detail: string, accent = false): string {
  return `<article class="stat${accent ? " stat--accent" : ""}"><span>${escapeHtml(title)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`;
}

function campaignCard(campaign: CampaignCockpitView, selected: boolean): string {
  return `<button class="campaign-card${selected ? " is-selected" : ""}" data-campaign-id="${escapeHtml(campaign.id)}">
    <div class="campaign-card__top"><span>${escapeHtml(campaign.brandId)}</span>${pill(campaign.health)}</div>
    <h3>${escapeHtml(campaign.name)}</h3>
    <div class="campaign-card__meta">${pill(campaign.status)}<span>${campaign.summary.totalCreators} Creator</span><span>${campaign.actions.length} Aktionen</span></div>
    <div class="campaign-card__revenue"><strong>${euro.format(campaign.summary.gmV)}</strong><small>${campaign.summary.orders} Orders</small></div>
  </button>`;
}

function filteredRows(campaign: CampaignCockpitView, filter: CreatorFilter): CreatorCockpitRow[] {
  if (filter === "action") return campaign.creators.filter((row) => row.nextAction !== null || row.blocker !== null);
  if (filter === "sample") return campaign.creators.filter((row) => row.sampleStatus !== "not_requested");
  if (filter === "content") return campaign.creators.filter((row) => row.contentStatus !== "not_started");
  return campaign.creators;
}

function nextStep(row: CreatorCockpitRow): string {
  if (row.nextAction) return label(row.nextAction.kind);
  if (row.blocker) return row.blocker;
  if (row.contentStatus === "posted") return "Performance beobachten";
  return "Kein offener Schritt";
}

function creatorTable(campaign: CampaignCockpitView, filter: CreatorFilter): string {
  const rows = filteredRows(campaign, filter);
  if (rows.length === 0) return `<div class="empty">Keine Creator entsprechen diesem Filter.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Creator</th><th>Outreach</th><th>Sample</th><th>Content</th><th>GMV</th><th>Nächster Schritt</th></tr></thead><tbody>${rows.map((row) => `<tr>
    <td><div class="creator"><span class="avatar">${escapeHtml(row.creatorId.slice(-2).toUpperCase())}</span><div><strong>${escapeHtml(row.creatorId)}</strong><small>${row.orders} Orders · ${euro.format(row.commission)} Commission</small></div></div></td>
    <td>${pill(row.outreachStatus)}</td><td>${pill(row.sampleStatus)}</td><td>${pill(row.contentStatus)}</td><td><strong>${euro.format(row.gmV)}</strong></td>
    <td><div class="next${row.blocker ? " next--blocked" : ""}"><span>${escapeHtml(nextStep(row))}</span>${row.nextAction?.requiresApproval ? `<small>Freigabe erforderlich</small>` : row.blocker ? `<small>Blocker</small>` : ""}</div></td>
  </tr>`).join("")}</tbody></table></div>`;
}

function approvalQueue(campaign: CampaignCockpitView): string {
  const actions = campaign.actions.filter((action) => action.requiresApproval);
  if (actions.length === 0) return `<div class="empty compact"><strong>Keine Freigaben offen</strong><span>Keine externe Aktion wartet.</span></div>`;
  return actions.slice(0, 6).map((action) => `<article class="queue"><div><span class="queue__icon">↗</span><div><strong>${escapeHtml(label(action.kind))}</strong><small>${escapeHtml(action.creatorId)}</small></div></div><span class="approval">Approval</span></article>`).join("");
}

function filters(current: CreatorFilter): string {
  const values: CreatorFilter[] = ["all", "action", "sample", "content"];
  return values.map((value) => `<button class="filter${current === value ? " is-active" : ""}" data-filter="${value}">${label(value)}</button>`).join("");
}

function sourceBadge(runtime: CockpitRuntimeSnapshot | null): string {
  if (!runtime) return `<span class="sync sync--warn">● Runtime fallback</span>`;
  const live = runtime.creatorSource === "company-os";
  return `<span class="sync${live ? "" : " sync--warn"}">● ${live ? "Company OS synced" : "Company OS pending"}</span>`;
}

function sourcePanel(runtime: CockpitRuntimeSnapshot | null): string {
  if (!runtime?.creatorPool) {
    return `<section class="source-panel source-panel--pending"><div><span class="source-dot"></span><div><strong>Company OS Creator Sync</strong><small>Noch kein sanitizierter Runtime-Snapshot empfangen.</small></div></div><span>Pending</span></section>`;
  }
  const pool = runtime.creatorPool;
  const campaignLabel = runtime.campaignSource === "company-os" ? "Live Campaigns" : "Campaign Demo bis erste Live-Campaign synchronisiert ist";
  return `<section class="source-panel"><div><span class="source-dot"></span><div><strong>Company OS Live</strong><small>${escapeHtml(campaignLabel)}</small></div></div><div class="source-metrics"><span><strong>${pool.total}</strong> Creator</span><span><strong>${pool.active}</strong> aktiv</span><span><strong>${pool.onboarding}</strong> Onboarding</span><span><strong>${pool.screening}</strong> Screening</span><span class="${pool.blockers > 0 ? "danger-text" : ""}"><strong>${pool.blockers}</strong> Blocker</span></div></section>`;
}

export function renderCockpit(
  portfolio: PortfolioCockpitView,
  campaign: CampaignCockpitView,
  filter: CreatorFilter,
  runtime: CockpitRuntimeSnapshot | null = null
): string {
  const campaignSourceLabel = runtime?.campaignSource === "company-os" ? "Company OS Campaigns" : "Core-backed Campaign Demo";
  return `<div class="layout">
    <aside class="sidebar">
      <div class="brand"><span class="brand__mark">G</span><div><strong>GMVGANG</strong><small>OPERATIONS OS</small></div></div>
      <nav><button class="nav is-active">◫ Campaign Cockpit</button><button class="nav">◎ Creator Intelligence</button><button class="nav">↗ Economics</button><button class="nav">◌ Automation</button></nav>
      <div class="mode"><span></span><div><strong>${escapeHtml(campaignSourceLabel)}</strong><small>Externe Aktionen approval-gated.</small></div></div>
    </aside>

    <main class="main">
      <header class="topbar"><div><p class="eyebrow">INTERNAL OPERATIONS</p><h1>Campaign Cockpit</h1></div><div class="topbar__actions">${sourceBadge(runtime)}<button class="button button--ghost">Export</button><button class="button" disabled>Neue Campaign</button></div></header>

      ${sourcePanel(runtime)}

      <section class="stats">
        ${stat("Portfolio GMV", euro.format(portfolio.gmV), `${integer.format(portfolio.orders)} Orders`, true)}
        ${stat("Aktive Campaigns", `${portfolio.activeCampaigns}`, `${portfolio.totalCampaigns} insgesamt`)}
        ${stat("Campaign Creator", `${portfolio.totalCreators}`, `${portfolio.creatorsPosted} Content live`)}
        ${stat("Pending Actions", `${portfolio.pendingActions}`, `${portfolio.approvalActions} Freigaben`)}
        ${stat("Samples delivered", `${portfolio.samplesDelivered}`, `${portfolio.campaignsNeedingAttention} brauchen Attention`)}
      </section>

      <section class="section"><div class="section-head"><div><p class="eyebrow">CAMPAIGNS</p><h2>Execution Overview</h2></div><span>${portfolio.totalCampaigns} Campaigns</span></div><div class="campaigns">${portfolio.campaigns.map((item) => campaignCard(item, item.id === campaign.id)).join("")}</div></section>

      <section class="workspace">
        <div class="panel primary-panel">
          <div class="campaign-head"><div><p class="eyebrow">SELECTED CAMPAIGN</p><h2>${escapeHtml(campaign.name)}</h2><div class="inline-meta">${pill(campaign.status)}${pill(campaign.health)}<span>${escapeHtml(campaign.productId)}</span></div></div><div class="campaign-total"><span>Campaign GMV</span><strong>${euro.format(campaign.summary.gmV)}</strong><small>${campaign.summary.orders} Orders · ${euro.format(campaign.summary.commission)} Commission</small></div></div>

          <div class="funnel">
            <div><span>Outreach sent</span><strong>${campaign.summary.outreachSent}/${campaign.summary.totalCreators}</strong><small>${percentage.format(campaign.summary.replyRate)}% Reply Rate</small></div>
            <div><span>Accepted</span><strong>${campaign.summary.accepted}</strong><small>${percentage.format(campaign.summary.acceptanceRate)}% Acceptance</small></div>
            <div><span>Samples delivered</span><strong>${campaign.summary.samplesDelivered}</strong><small>${campaign.summary.samplesRequested} requested</small></div>
            <div><span>Content live</span><strong>${campaign.summary.creatorsPosted}</strong><small>${percentage.format(campaign.summary.sampleToPostRate)}% Sample → Post</small></div>
          </div>

          <div class="table-head"><div><strong>Creator Execution</strong><span>${campaign.creators.length} Creator</span></div><div class="filters">${filters(filter)}</div></div>
          ${creatorTable(campaign, filter)}
        </div>

        <aside class="rail">
          <section class="panel compact-panel"><div class="section-head"><div><p class="eyebrow">APPROVAL QUEUE</p><h3>${campaign.approvalActions} Freigaben</h3></div><span class="counter">${campaign.actions.length}</span></div><div class="queue-list">${approvalQueue(campaign)}</div></section>
          <section class="panel compact-panel"><div class="section-head"><div><p class="eyebrow">BLOCKERS</p><h3>Needs attention</h3></div><span class="counter counter--danger">${campaign.blockers.length}</span></div>${campaign.blockers.length === 0 ? `<div class="empty compact"><strong>Keine Blocker</strong><span>Campaign kann normal weiterlaufen.</span></div>` : `<div class="blockers">${campaign.blockers.map((blocker) => `<div class="blocker"><span>!</span><p>${escapeHtml(blocker)}</p></div>`).join("")}</div>`}</section>
          <section class="panel compact-panel audit"><p class="eyebrow">AUDIT TRAIL</p><div>${campaign.auditEvents}</div><strong>sequenzierte Events</strong><small>Letztes Event: ${campaign.lastAuditAt ? new Date(campaign.lastAuditAt).toLocaleString("de-DE") : "–"}</small></section>
        </aside>
      </section>
    </main>
  </div>`;
}
