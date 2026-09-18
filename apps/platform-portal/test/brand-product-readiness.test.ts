import { describe, expect, it } from "vitest";
import {
  HttpBrandProductReadinessAdapter,
  parseBrandProductReadiness,
  renderBrandProductReadiness,
} from "../src/brand-product-readiness.js";

const READY_PRODUCT = {
  id: "product-1",
  name: "Creator Bundle",
  sku: "CB-001",
  status: "draft",
  readiness: {
    canActivate: true,
    blockers: [],
    warnings: ["tiktok_shop_url_missing"],
  },
};

describe("Brand Product Readiness surface", () => {
  it("parses canonical readiness and keeps blockers separate from warnings", () => {
    const response = parseBrandProductReadiness({
      products: [
        READY_PRODUCT,
        {
          id: "product-2",
          name: "",
          sku: "",
          status: "draft",
          readiness: {
            canActivate: false,
            blockers: ["name_required", "sku_required", "sale_price_required"],
            warnings: ["inventory_zero"],
          },
        },
      ],
    });

    const html = renderBrandProductReadiness(response);
    expect(html).toContain("Aktivierungsblocker");
    expect(html).toContain("Produktname fehlt");
    expect(html).toContain("Hinweise");
    expect(html).toContain("Bestand ist 0");
    expect(html).toContain("Unbenanntes Produkt");
    expect(html).not.toContain('data-action="activate"');
  });

  it("fails closed on unknown statuses, blockers, or warnings", () => {
    expect(() => parseBrandProductReadiness({
      products: [{ ...READY_PRODUCT, status: "deleted" }],
    })).toThrow("BRAND_PRODUCT_READINESS_ROW_INVALID");

    expect(() => parseBrandProductReadiness({
      products: [{
        ...READY_PRODUCT,
        readiness: { canActivate: false, blockers: ["browser_override"], warnings: [] },
      }],
    })).toThrow("BRAND_PRODUCT_READINESS_ROW_INVALID");

    expect(() => parseBrandProductReadiness({
      products: [{
        ...READY_PRODUCT,
        readiness: { canActivate: true, blockers: [], warnings: ["profit_ready"] },
      }],
    })).toThrow("BRAND_PRODUCT_READINESS_ROW_INVALID");
  });

  it("rejects duplicate product ids and inconsistent activation flags", () => {
    expect(() => parseBrandProductReadiness({
      products: [READY_PRODUCT, { ...READY_PRODUCT }],
    })).toThrow("BRAND_PRODUCT_READINESS_ROW_INVALID");

    expect(() => parseBrandProductReadiness({
      products: [{
        ...READY_PRODUCT,
        readiness: { canActivate: true, blockers: ["sale_price_required"], warnings: [] },
      }],
    })).toThrow("BRAND_PRODUCT_READINESS_INCONSISTENT");

    expect(() => parseBrandProductReadiness({
      products: [{
        ...READY_PRODUCT,
        readiness: { canActivate: false, blockers: [], warnings: [] },
      }],
    })).toThrow("BRAND_PRODUCT_READINESS_INCONSISTENT");
  });

  it("keeps organization selection in the authenticated header boundary", async () => {
    const calls: unknown[] = [];
    const adapter = new HttpBrandProductReadinessAdapter(
      "org-1",
      "/api/brand/products/readiness",
      async (input, init) => {
        calls.push({ input, init });
        return {
          ok: true,
          async json() {
            return { products: [READY_PRODUCT] };
          },
        };
      },
    );

    await expect(adapter.getReadiness()).resolves.toEqual({
      products: [READY_PRODUCT],
    });
    expect(calls).toEqual([{
      input: "/api/brand/products/readiness",
      init: {
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "X-GMVGANG-Organization-Id": "org-1",
        },
      },
    }]);
  });

  it("does not issue a request without an organization context", async () => {
    let called = false;
    const adapter = new HttpBrandProductReadinessAdapter(
      " ",
      "/api/brand/products/readiness",
      async () => {
        called = true;
        return { ok: true, async json() { return { products: [] }; } };
      },
    );

    await expect(adapter.getReadiness()).resolves.toBeNull();
    expect(called).toBe(false);
  });

  it("escapes server-derived product identity strings", () => {
    const html = renderBrandProductReadiness(parseBrandProductReadiness({
      products: [{
        ...READY_PRODUCT,
        name: '<img src=x onerror="alert(1)">',
        sku: "<script>alert(1)</script>",
      }],
    }));

    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders explicit unavailable and empty states without inventing readiness", () => {
    expect(renderBrandProductReadiness(null)).toContain("Readiness nicht verfügbar");
    const empty = renderBrandProductReadiness({ products: [] });
    expect(empty).toContain("Noch keine Produkte");
    expect(empty).not.toContain("Aktivierbar");
  });
});
