import { describe, expect, it } from "vitest";

import { HttpWorkspaceAdapter, parsePortalWorkspaces } from "../src/workspaces.js";

describe("parsePortalWorkspaces", () => {
  it("accepts tenant-scoped workspace access and deduplicates roles", () => {
    expect(
      parsePortalWorkspaces([
        {
          organizationId: "org_gmvgang",
          organizationType: "gmvgang",
          name: "GMVGANG",
          roles: ["founder", "founder", "admin"],
        },
        {
          organizationId: "org_brand",
          organizationType: "brand",
          name: "Brand GmbH",
          roles: ["brand_member"],
        },
      ]),
    ).toEqual([
      {
        organizationId: "org_gmvgang",
        organizationType: "gmvgang",
        name: "GMVGANG",
        roles: ["founder", "admin"],
      },
      {
        organizationId: "org_brand",
        organizationType: "brand",
        name: "Brand GmbH",
        roles: ["brand_member"],
      },
    ]);
  });

  it("rejects malformed workspace identities and unknown roles", () => {
    expect(() =>
      parsePortalWorkspaces([
        {
          organizationId: "",
          organizationType: "brand",
          name: "Brand",
          roles: ["brand_member"],
        },
      ]),
    ).toThrow("WORKSPACE_INVALID");

    expect(() =>
      parsePortalWorkspaces([
        {
          organizationId: "org_brand",
          organizationType: "brand",
          name: "Brand",
          roles: ["owner"],
        },
      ]),
    ).toThrow("WORKSPACE_INVALID");
  });
});

describe("HttpWorkspaceAdapter", () => {
  it("loads workspace discovery from the same-origin authenticated boundary", async () => {
    let capturedInput = "";
    let capturedInit: unknown;
    const adapter = new HttpWorkspaceAdapter("/api/workspaces", async (input, init) => {
      capturedInput = input;
      capturedInit = init;
      return {
        ok: true,
        async json() {
          return [
            {
              organizationId: "org_brand",
              organizationType: "brand",
              name: "Brand GmbH",
              roles: ["brand_member"],
            },
          ];
        },
      };
    });

    await expect(adapter.getWorkspaces()).resolves.toHaveLength(1);
    expect(capturedInput).toBe("/api/workspaces");
    expect(capturedInit).toEqual({
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  });

  it("fails closed to an empty workspace list on transport and payload errors", async () => {
    const transportFailure = new HttpWorkspaceAdapter("/api/workspaces", async () => {
      throw new Error("network");
    });
    await expect(transportFailure.getWorkspaces()).resolves.toEqual([]);

    const malformed = new HttpWorkspaceAdapter("/api/workspaces", async () => ({
      ok: true,
      async json() {
        return [{ organizationId: "org_brand", organizationType: "brand", name: "Brand", roles: [] }];
      },
    }));
    await expect(malformed.getWorkspaces()).resolves.toEqual([]);
  });
});
