import { createServer, request as httpRequest } from "node:http";
import { FileSnapshotStore } from "./snapshot-store.mjs";

const externalPort = Number(process.env.PORT ?? 4173);
const internalPort = Number(process.env.COCKPIT_INTERNAL_PORT ?? 4174);
const snapshotPath = process.env.COCKPIT_SNAPSHOT_PATH ?? "";
const syncSecret = process.env.COCKPIT_SYNC_SECRET ?? "";

if (externalPort === internalPort) throw new Error("COCKPIT_INTERNAL_PORT must differ from PORT");

const creatorPropertyWhitelist = new Set([
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

function notionResults(raw) {
  if (!raw) return [];
  if (Array.isArray(raw.results)) return raw.results;
  if (raw.body && Array.isArray(raw.body.results)) return raw.body.results;
  if (raw.data && Array.isArray(raw.data.results)) return raw.data.results;
  return [];
}

function parsePayload(buffer) {
  if (!buffer.length) return null;
  const parsed = JSON.parse(buffer.toString("utf8"));
  if (typeof parsed === "string") return JSON.parse(parsed);
  if (parsed && typeof parsed.body === "string") {
    try { return JSON.parse(parsed.body); } catch { return parsed; }
  }
  return parsed;
}

function sanitizeCreatorPayload(raw) {
  return {
    object: "list",
    results: notionResults(raw).map((row) => {
      const properties = {};
      for (const [name, value] of Object.entries(row?.properties ?? {})) {
        if (creatorPropertyWhitelist.has(name)) properties[name] = value;
      }
      return {
        id: row?.id ?? null,
        created_time: row?.created_time ?? null,
        last_edited_time: row?.last_edited_time ?? null,
        properties
      };
    })
  };
}

const snapshotStore = snapshotPath ? new FileSnapshotStore(snapshotPath) : null;
const persisted = snapshotStore ? await snapshotStore.ensure() : null;

process.env.PORT = String(internalPort);
await import("./server.mjs");
process.env.PORT = String(externalPort);

async function waitForInternalServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${internalPort}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("internal Campaign Cockpit failed to start");
}

async function replayPersistedSnapshots() {
  if (!persisted || !syncSecret) return;
  for (const source of ["creators", "campaigns", "assignments"]) {
    const payload = persisted.sources[source];
    if (payload === null) continue;
    const response = await fetch(`http://127.0.0.1:${internalPort}/api/sync/raw/${source}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-cockpit-sync-secret": syncSecret
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`failed to restore ${source} snapshot: HTTP ${response.status}`);
  }
}

await waitForInternalServer();
await replayPersistedSnapshots();

function proxyRequest(req, res, body = null) {
  return new Promise((resolve, reject) => {
    const headers = { ...req.headers, host: `127.0.0.1:${internalPort}` };
    if (body) headers["content-length"] = String(body.length);
    const upstream = httpRequest({
      hostname: "127.0.0.1",
      port: internalPort,
      path: req.url,
      method: req.method,
      headers
    }, (upstreamResponse) => {
      res.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(res);
      upstreamResponse.on("end", () => resolve(upstreamResponse.statusCode ?? 502));
    });
    upstream.on("error", reject);
    if (body) upstream.end(body);
    else req.pipe(upstream);
  });
}

async function readRequestBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 5_000_000) throw new Error("payload too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const proxy = createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const isSnapshotSync = req.method === "POST" && pathname.startsWith("/api/sync/raw/");

  if (!isSnapshotSync) {
    try {
      await proxyRequest(req, res);
    } catch {
      if (!res.headersSent) res.writeHead(502);
      res.end("Upstream unavailable");
    }
    return;
  }

  try {
    const body = await readRequestBody(req);
    const source = pathname.split("/").at(-1);
    const statusCode = await proxyRequest(req, res, body);
    if (statusCode >= 200 && statusCode < 300 && snapshotStore && ["creators", "campaigns", "assignments"].includes(source)) {
      const parsed = parsePayload(body);
      const stored = source === "creators" ? sanitizeCreatorPayload(parsed) : parsed;
      await snapshotStore.replaceSource(source, stored, new Date().toISOString());
    }
  } catch (error) {
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "snapshot_persistence_failed" }));
    }
    console.error("snapshot persistence error", error instanceof Error ? error.message : "unknown");
  }
});

proxy.listen(externalPort, "0.0.0.0", async () => {
  const status = snapshotStore ? await snapshotStore.status() : null;
  console.log(`GMVGANG persistent runtime listening on ${externalPort}; restored sources: ${status?.configuredSources.join(",") || "none"}`);
});
