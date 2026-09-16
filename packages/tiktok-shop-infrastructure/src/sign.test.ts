import { describe, expect, it } from "vitest";
import { signTikTokShopRequest } from "./sign.js";

describe("TikTok Shop request signing", () => {
  it("matches a fixed HMAC-SHA256 vector and excludes access_token/sign", () => {
    const signature = signTikTokShopRequest({
      path: "/analytics/202605/shop_products/performance",
      query: {
        timestamp: "1700000000",
        app_key: "app123",
        page_size: "100",
        access_token: "must-not-affect-signature",
        sign: "must-not-affect-signature"
      },
      appSecret: "test-secret"
    });

    expect(signature).toBe("9ac86d22ebc01d50bf23f2d47931ef72db5a52d7d5f85f897628872a991fadd3");
  });

  it("is independent of query insertion order", () => {
    const a = signTikTokShopRequest({
      path: "/authorization/202309/shops",
      query: { timestamp: "1700000000", app_key: "app123" },
      appSecret: "secret"
    });
    const b = signTikTokShopRequest({
      path: "/authorization/202309/shops",
      query: { app_key: "app123", timestamp: "1700000000" },
      appSecret: "secret"
    });

    expect(a).toBe(b);
  });

  it("includes ordinary request bodies but excludes multipart bodies", () => {
    const json = signTikTokShopRequest({
      path: "/example",
      query: { app_key: "key", timestamp: "1" },
      body: "{\"a\":1}",
      contentType: "application/json",
      appSecret: "secret"
    });
    const multipartWithBody = signTikTokShopRequest({
      path: "/example",
      query: { app_key: "key", timestamp: "1" },
      body: "ignored multipart body",
      contentType: "multipart/form-data; boundary=x",
      appSecret: "secret"
    });
    const multipartWithoutBody = signTikTokShopRequest({
      path: "/example",
      query: { app_key: "key", timestamp: "1" },
      contentType: "multipart/form-data",
      appSecret: "secret"
    });

    expect(json).not.toBe(multipartWithBody);
    expect(multipartWithBody).toBe(multipartWithoutBody);
  });

  it("fails closed on an invalid path or missing secret", () => {
    expect(() => signTikTokShopRequest({ path: "invalid", query: {}, appSecret: "secret" })).toThrow(
      "TIKTOK_SIGN_PATH_INVALID"
    );
    expect(() => signTikTokShopRequest({ path: "/valid", query: {}, appSecret: "" })).toThrow(
      "TIKTOK_APP_SECRET_MISSING"
    );
  });
});
