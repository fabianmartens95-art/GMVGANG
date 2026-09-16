import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPlatformApi } from "./server/api.js";

const here = dirname(fileURLToPath(import.meta.url));
const distRoot = resolve(here, "dist");
const port = Number(process.env.PORT ?? 4173);

const api = createPlatformApi({
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  privacyNoticeVersion: process.env.CREATOR_PRIVACY_NOTICE_VERSION ?? "",
});

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function secureHeaders(response: ServerResponse): void {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

function sendText(response: ServerResponse, statusCode: number, text: string): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  response.setHeader("Content-Length", Buffer.byteLength(text));
  response.end(text);
}

function fileForRequest(request: IncomingMessage): string | null {
  const url = new URL(request.url ?? "/", "http://platform.local");
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }

  const relative = normalize(pathname).replace(/^[/\\]+/, "");
  const candidate = resolve(join(distRoot, relative));
  if (candidate !== distRoot && !candidate.startsWith(`${distRoot}/`)) return null;

  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  if (!extname(pathname)) {
    const index = resolve(distRoot, "index.html");
    if (existsSync(index)) return index;
  }
  return null;
}

function serveFile(request: IncomingMessage, response: ServerResponse, filePath: string): void {
  const extension = extname(filePath).toLowerCase();
  response.statusCode = 200;
  response.setHeader("Content-Type", MIME[extension] ?? "application/octet-stream");
  response.setHeader(
    "Cache-Control",
    extension === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
  );

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  const stream = createReadStream(filePath);
  stream.on("error", (error) => {
    console.error("platform_static_read_failed", error);
    if (!response.headersSent) sendText(response, 500, "Internal Server Error");
    else response.destroy(error);
  });
  stream.pipe(response);
}

const server = createServer(async (request, response) => {
  secureHeaders(response);
  try {
    if (await api(request, response)) return;

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendText(response, 405, "Method Not Allowed");
      return;
    }

    const filePath = fileForRequest(request);
    if (!filePath) {
      sendText(response, 404, "Not Found");
      return;
    }
    serveFile(request, response, filePath);
  } catch (error) {
    console.error("platform_request_failed", error);
    if (!response.headersSent) sendText(response, 500, "Internal Server Error");
    else response.destroy(error instanceof Error ? error : undefined);
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`GMVGANG platform listening on :${port}`);
});
