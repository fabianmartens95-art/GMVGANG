import { createHmac } from "node:crypto";

export interface TikTokRequestSignatureInput {
  path: string;
  query: Readonly<Record<string, string>>;
  appSecret: string;
  body?: string;
  contentType?: string;
}

function isMultipart(contentType: string | undefined): boolean {
  return contentType?.split(";", 1)[0]?.trim().toLowerCase() === "multipart/form-data";
}

/**
 * TikTok Shop signing algorithm for 202309+ API paths.
 *
 * 1. Remove `sign` and `access_token` from the signing parameter set.
 * 2. Sort remaining query parameter names lexicographically.
 * 3. Concatenate exact API path + key/value pairs.
 * 4. Append the request body unless content type is multipart/form-data.
 * 5. Wrap with the app secret and HMAC-SHA256 using the same app secret.
 */
export function signTikTokShopRequest(input: TikTokRequestSignatureInput): string {
  const path = input.path.trim();
  const appSecret = input.appSecret;
  if (!path.startsWith("/")) throw new Error("TIKTOK_SIGN_PATH_INVALID");
  if (!appSecret) throw new Error("TIKTOK_APP_SECRET_MISSING");

  const keys = Object.keys(input.query)
    .filter((key) => key !== "sign" && key !== "access_token")
    .sort();

  let payload = path;
  for (const key of keys) payload += `${key}${input.query[key] ?? ""}`;
  if (!isMultipart(input.contentType)) payload += input.body ?? "";

  const wrapped = `${appSecret}${payload}${appSecret}`;
  return createHmac("sha256", appSecret).update(wrapped, "utf8").digest("hex");
}
