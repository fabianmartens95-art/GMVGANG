import { describe, expect, it } from "vitest";
import {
  HttpBrandCommerceNextActionAdapter,
  parseBrandCommerceNextAction,
  renderBrandCommerceNextAction,
} from "../src/brand-commerce-next-action.js";

describe("Brand Commerce Next Best Action surface", () => {
  it("parses one server-derived action and maps it to an existing Brand route", () => {
    const response = parseBrandCommerceNextAction({
      action: {
        id: "add_first_product",
        priority: "high",
        reason: "Mindestens ein aktives Produkt wird benötigt.",
      },
    });
    const html = renderBrandCommerceNextAction(response);
    expect(html).toContain("Produkt hinzufügen");
    expect(html).toContain('href="/brand/products"');
  });

  it("rejects unknown browser-invented actions", () => {
    expect(() => parseBrandCommerceNextAction({
      action: { id: "send_money", priority: "critical", reason: "Nope" },
    })).toThrow("BRAND_COMMERCE_NBA_ACTION_INVALID");
  });

  it("escapes server reason copy", () => {
    const html = renderBrandCommerceNextAction(parseBrandCommerceNextAction({
      action: {
        id: "monitor_active_campaigns",
        priority: "normal",
        reason: "<script>alert(1)</script>",
      },
    }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("keeps organization selection in the authenticated header boundary", async () => {
    const calls: unknown[] = [];
    const adapter = new HttpBrandCommerceNextActionAdapter("org-1", "/api/brand/next-action", async (input, init) => {
      calls.push({ input, init });
      return {
        ok: true,
        async json() {
          return { action: { id: "monitor_active_campaigns", priority: "normal", reason: "Alles bereit." } };
        },
      };
    });
    await expect(adapter.getNextAction()).resolves.not.toBeNull();
    expect(calls).toEqual([{
      input: "/api/brand/next-action",
      init: {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json", "X-GMVGANG-Organization-Id": "org-1" },
      },
    }]);
  });
});
