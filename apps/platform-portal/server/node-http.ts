import type { IncomingMessage, ServerResponse } from "node:http";
import type { RuntimeCookie } from "./supabase-auth.js";
import { serializeRuntimeCookie } from "./supabase-auth.js";

const MAX_API_BODY_BYTES = 64 * 1024;

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function forwardedValue(value: string | undefined): string | undefined {
  return value?.split(",", 1)[0]?.trim() || undefined;
}

export function requestBaseUrl(request: IncomingMessage): string {
  const forwardedProto = forwardedValue(firstHeader(request.headers["x-forwarded-proto"]));
  const protocol = forwardedProto === "https" || forwardedProto === "http" ? forwardedProto : "http";
  const forwardedHost = forwardedValue(firstHeader(request.headers["x-forwarded-host"]));
  const host = forwardedHost ?? firstHeader(request.headers.host) ?? "localhost";
  return `${protocol}://${host}`;
}

async function readRequestBody(request: IncomingMessage): Promise<string | undefined> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_API_BODY_BYTES) throw new Error("API_BODY_TOO_LARGE");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return undefined;
  return Buffer.concat(chunks).toString("utf8");
}

export async function nodeRequestToWebRequest(request: IncomingMessage): Promise<Request> {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(name, item));
    } else {
      headers.set(name, value);
    }
  }

  const url = new URL(request.url ?? "/", requestBaseUrl(request));
  const body = await readRequestBody(request);
  const init: RequestInit = {
    method: request.method ?? "GET",
    headers,
  };
  if (body !== undefined) init.body = body;
  return new Request(url, init);
}

export async function writeWebResponse(
  target: ServerResponse,
  source: Response,
  cookies: readonly RuntimeCookie[] = [],
): Promise<void> {
  target.statusCode = source.status;
  source.headers.forEach((value, name) => {
    if (name.toLowerCase() !== "set-cookie") target.setHeader(name, value);
  });
  if (cookies.length > 0) {
    target.setHeader("Set-Cookie", cookies.map(serializeRuntimeCookie));
  }
  const body = Buffer.from(await source.arrayBuffer());
  if (!target.hasHeader("Content-Length")) target.setHeader("Content-Length", body.length);
  target.end(body);
}
