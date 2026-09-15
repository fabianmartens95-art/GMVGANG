import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./dist", import.meta.url));
const port = Number(process.env.PORT ?? 4173);
const basicUser = process.env.COCKPIT_BASIC_USER ?? "gmvgang";
const basicPassword = process.env.COCKPIT_BASIC_PASSWORD ?? "";
const syncSecret = process.env.COCKPIT_SYNC_SECRET ?? "";

const CREATOR_PROPERTY_WHITELIST = new Set([
  "TikTok Handle",
  "Status",
  "Legal Hold",
  "Creator nicht aufnehmen",
  "Raus",
  "Compliance-Risiko",
  "TikTok Verstöße 90 Tage",
  "Compliance Check bestanden",
  "Vertrag unterschrieben am"
]);

const rawStore = {
  creators: null,
  campaigns: null,
  assignments: null,
  syncedAt: { creators: null, campaigns: null, assignments: null }
};

const statusMap = {
  Draft: "draft",
  Approved: "approved",
  Active: "active",
  Paused: "paused",
  Completed: "completed",
  Cancelled: "cancelled"
};
const outreachMap = {
  Queued: "queued",
  Ready: "ready",
  Sent: "sent",
  Replied: "replied",
  Accepted: "accepted",
  Declined: "declined",
  Stopped: "stopped"
};
const replyMap = { Accepted: "accepted", Declined: "declined", Question: "question" };
const sampleMap = {
  "Not Requested": "not_requested",
  Requested: "requested",
  Approved: "approved",
  Rejected: "rejected",
  Ordered: "ordered",
  Shipped: "shipped",
  Delivered: "delivered",
  "Content Due": "content_due",
  Posted: "posted",
  Closed: "closed"
};
const contentMap = {
  "Not Started": "not_started",
  Briefed: "briefed",
  "In Progress": "in_progress",
  Posted: "posted",
  Cancelled: "cancelled"
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function unauthorized(res) {
  res.writeHead(401, { "www-authenticate": 'Basic realm="GMVGANG Campaign Cockpit"' });
  res.end("Authentication required");
}

function hasBasicAuth(req) {
  if (!basicPassword) return true;
  const header = req.headers.authorization;
  if (!header?.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    return decoded.slice(0, separator) === basicUser && decoded.slice(separator + 1) === basicPassword;
  } catch {
    return false;
  }
}

function hasSyncAuth(req) {
  return Boolean(syncSecret) && req.headers["x-cockpit-sync-secret"] === syncSecret;
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 5_000_000) throw new Error("payload too large");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return null;
  const parsed = JSON.parse(text);
  if (typeof parsed === "string") return JSON.parse(parsed);
  if (parsed && typeof parsed.body === "string") {
    try { return JSON.parse(parsed.body); } catch { /* keep wrapper */ }
  }
  return parsed;
}

function notionResults(raw) {
  if (!raw) return [];
  if (Array.isArray(raw.results)) return raw.results;
  if (raw.body && Array.isArray(raw.body.results)) return raw.body.results;
  if (raw.data && Array.isArray(raw.data.results)) return raw.data.results;
  return [];
}

function sanitizeCreatorPayload(raw) {
  const results = notionResults(raw).map((row) => {
    const safeProperties = {};
    for (const [name, value] of Object.entries(row?.properties ?? {})) {
      if (CREATOR_PROPERTY_WHITELIST.has(name)) safeProperties[name] = value;
    }
    return {
      id: row?.id ?? null,
      created_time: row?.created_time ?? null,
      last_edited_time: row?.last_edited_time ?? null,
      properties: safeProperties
    };
  });
  return { object: "list", results };
}

function prop(page, name) {
  return page?.properties?.[name] ?? null;
}
function title(page, name) {
  return prop(page, name)?.title?.map((item) => item?.plain_text ?? item?.text?.content ?? "").join("") ?? "";
}
function rich(page, name) {
  return prop(page, name)?.rich_text?.map((item) => item?.plain_text ?? item?.text?.content ?? "").join("") ?? "";
}
function selected(page, name) {
  return prop(page, name)?.select?.name ?? null;
}
function checked(page, name) {
  return prop(page, name)?.checkbox === true;
}
function number(page, name) {
  const value = prop(page, name)?.number;
  return Number.isFinite(value) ? value : 0;
}
function date(page, name) {
  return prop(page, name)?.date?.start ?? null;
}
function url(page, name) {
  return prop(page, name)?.url ?? null;
}
function relationId(page, name) {
  return prop(page, name)?.relation?.[0]?.id ?? null;
}

function creatorPoolSnapshot() {
  const rows = notionResults(rawStore.creators);
  const snapshot = { total: rows.length, active: 0, onboarding: 0, screening: 0, blockers: 0 };
  for (const row of rows) {
    const status = selected(row, "Status");
    if (status === "Aktiv") snapshot.active += 1;
    if (status === "Onboarding") snapshot.onboarding += 1;
    if (status === "Screening") snapshot.screening += 1;
    const blocker = checked(row, "Legal Hold") || checked(row, "Creator nicht aufnehmen") || checked(row, "Raus") || selected(row, "Compliance-Risiko") === "Blocker" || selected(row, "TikTok Verstöße 90 Tage") === "Ja – aktuell aktiv";
    if (blocker) snapshot.blockers += 1;
  }
  return snapshot;
}

function creatorNamesByPageId() {
  const result = new Map();
  for (const row of notionResults(rawStore.creators)) {
    const handle = rich(row, "TikTok Handle").replace(/^@/, "").trim();
    if (row?.id) result.set(row.id, handle ? `@${handle}` : row.id);
  }
  return result;
}

function creatorReadinessByPageId() {
  const result = new Map();
  for (const row of notionResults(rawStore.creators)) {
    if (!row?.id) continue;
    const status = selected(row, "Status");
    const legalHold = checked(row, "Legal Hold");
    const manualExclusion = checked(row, "Creator nicht aufnehmen") || checked(row, "Raus");
    const complianceRisk = selected(row, "Compliance-Risiko") === "Blocker";
    const activeViolation = selected(row, "TikTok Verstöße 90 Tage") === "Ja – aktuell aktiv";
    const contractReady = Boolean(date(row, "Vertrag unterschrieben am"));
    const complianceReady = checked(row, "Compliance Check bestanden") && !legalHold && !complianceRisk && !activeViolation;
    const eligible = ["Onboarding", "Aktiv"].includes(status) && !legalHold && !manualExclusion && !activeViolation;
    const blockers = [];
    if (!contractReady) blockers.push("Creator contract not ready");
    if (!checked(row, "Compliance Check bestanden")) blockers.push("Creator compliance check not passed");
    if (legalHold) blockers.push("Creator legal hold");
    if (complianceRisk) blockers.push("Creator compliance risk blocker");
    if (activeViolation) blockers.push("Creator has active TikTok violation");
    if (manualExclusion) blockers.push("Creator manually excluded");
    if (!["Onboarding", "Aktiv"].includes(status)) blockers.push(`Creator status ${status ?? "unset"} is not execution-eligible`);
    result.set(row.id, {
      contractReady,
      complianceReady,
      eligible,
      ready: contractReady && complianceReady && eligible,
      blockers
    });
  }
  return result;
}

function assignmentFromPage(row, creatorNames, creatorReadiness) {
  const creatorPageId = relationId(row, "Creator");
  const creatorKey = rich(row, "Creator Key").trim();
  const creatorId = creatorKey || creatorNames.get(creatorPageId) || creatorPageId || row.id;
  const outreach = outreachMap[selected(row, "Outreach Status")] ?? "queued";
  const reply = replyMap[selected(row, "Outreach Reply")] ?? null;
  const sample = sampleMap[selected(row, "Sample Status")] ?? "not_requested";
  const content = contentMap[selected(row, "Content Status")] ?? "not_started";
  const readiness = creatorReadiness.get(creatorPageId) ?? {
    contractReady: false,
    complianceReady: false,
    eligible: false,
    ready: false,
    blockers: ["Creator readiness source missing"]
  };
  return {
    creatorId,
    readiness,
    outreach: {
      status: outreach,
      reply,
      sentAt: date(row, "Outreach Sent At"),
      lastEventAt: null,
      nextFollowUpAt: date(row, "Next Follow-up"),
      followUpCount: number(row, "Follow-up Count")
    },
    sample: {
      status: sample,
      requestedAt: date(row, "Sample Requested At"),
      approvedAt: date(row, "Sample Approved At"),
      shippedAt: date(row, "Sample Shipped At"),
      deliveredAt: date(row, "Sample Delivered At"),
      lastEventAt: null,
      fulfillmentReference: null
    },
    content: {
      status: content,
      briefedAt: date(row, "Briefed At"),
      postedAt: date(row, "Posted At"),
      contentReference: url(row, "Content Reference")
    },
    performance: {
      gmV: number(row, "GMV"),
      orders: number(row, "Orders"),
      commission: number(row, "Commission"),
      updatedAt: row?.last_edited_time ?? null
    }
  };
}

function liveLedgers() {
  const campaigns = notionResults(rawStore.campaigns).filter((row) => checked(row, "Cockpit Sync"));
  const assignments = notionResults(rawStore.assignments).filter((row) => checked(row, "Cockpit Sync"));
  const creatorNames = creatorNamesByPageId();
  const creatorReadiness = creatorReadinessByPageId();
  const byCampaignPageId = new Map();
  for (const row of assignments) {
    const campaignPageId = relationId(row, "Campaign");
    if (!campaignPageId) continue;
    const list = byCampaignPageId.get(campaignPageId) ?? [];
    list.push(assignmentFromPage(row, creatorNames, creatorReadiness));
    byCampaignPageId.set(campaignPageId, list);
  }
  return campaigns.map((row) => {
    const campaignAssignments = byCampaignPageId.get(row.id) ?? [];
    const clientApproved = checked(row, "Client Approved");
    const blockers = [];
    if (!clientApproved) blockers.push("Client approval missing");
    if (campaignAssignments.length === 0) blockers.push("No creator assignments");
    const ready = blockers.length === 0 && campaignAssignments.every((assignment) => assignment.readiness.ready);
    return {
      campaign: {
        id: rich(row, "Campaign Key").trim() || row.id,
        name: title(row, "Campaign") || "Untitled Campaign",
        brandId: rich(row, "Brand Key").trim() || "brand-unset",
        productId: rich(row, "Product Key").trim() || "product-unset",
        creatorListId: rich(row, "Creator List Key").trim() || "notion-live",
        status: statusMap[selected(row, "Status")] ?? "draft",
        readiness: {
          clientApproved,
          ready,
          evaluatedAt: rawStore.syncedAt.assignments ?? rawStore.syncedAt.creators ?? rawStore.syncedAt.campaigns,
          blockers
        },
        createdAt: date(row, "Created At") ?? row.created_time ?? new Date().toISOString(),
        approvedAt: date(row, "Approved At"),
        launchedAt: date(row, "Launched At"),
        completedAt: date(row, "Completed At"),
        assignments: campaignAssignments
      },
      auditTrail: []
    };
  });
}

function snapshot() {
  const creatorsSynced = rawStore.creators !== null;
  const campaignsSynced = rawStore.campaigns !== null && rawStore.assignments !== null;
  const ledgers = campaignsSynced ? liveLedgers() : [];
  return {
    generatedAt: new Date().toISOString(),
    creatorSource: creatorsSynced ? "company-os" : "unavailable",
    campaignSource: campaignsSynced && ledgers.length > 0 ? "company-os" : "demo",
    creatorPool: creatorsSynced ? creatorPoolSnapshot() : null,
    ledgers,
    syncedAt: rawStore.syncedAt
  };
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

async function serveStatic(req, res) {
  const requestPath = new URL(req.url, "http://localhost").pathname;
  const safePath = normalize(requestPath).replace(/^([.][.][/\\])+/, "");
  let filePath = join(root, safePath === "/" ? "index.html" : safePath);
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, "index.html");
  } catch {
    filePath = join(root, "index.html");
  }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      "content-type": mime[extname(filePath)] ?? "application/octet-stream",
      "cache-control": filePath.endsWith("index.html") ? "no-store" : "public, max-age=3600"
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (pathname === "/health") return sendJson(res, 200, { ok: true, service: "gmvgang-campaign-cockpit" });

  if (pathname.startsWith("/api/sync/raw/")) {
    if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" });
    if (!hasSyncAuth(req)) return sendJson(res, 401, { error: "invalid_sync_secret" });
    const source = pathname.split("/").at(-1);
    if (!["creators", "campaigns", "assignments"].includes(source)) return sendJson(res, 404, { error: "unknown_source" });
    try {
      const payload = await readBody(req);
      const storedPayload = source === "creators" ? sanitizeCreatorPayload(payload) : payload;
      rawStore[source] = storedPayload;
      rawStore.syncedAt[source] = new Date().toISOString();
      return sendJson(res, 200, {
        ok: true,
        source,
        rows: notionResults(storedPayload).length,
        creatorPropertiesStored: source === "creators" ? [...CREATOR_PROPERTY_WHITELIST] : undefined,
        syncedAt: rawStore.syncedAt[source]
      });
    } catch (error) {
      return sendJson(res, 400, { error: "invalid_payload", message: error instanceof Error ? error.message : "unknown" });
    }
  }

  if (!hasBasicAuth(req)) return unauthorized(res);
  if (pathname === "/api/snapshot") return sendJson(res, 200, snapshot());
  if (pathname === "/api/source-status") return sendJson(res, 200, { syncedAt: rawStore.syncedAt, configured: { basicAuth: Boolean(basicPassword), sync: Boolean(syncSecret) } });
  return serveStatic(req, res);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`GMVGANG Campaign Cockpit listening on ${port}`);
});
