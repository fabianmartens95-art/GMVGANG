import { describe, expect, it, vi } from "vitest";

import {
  auditInsertRow,
  recordAuditBestEffort,
  type PlatformAuditLogger,
} from "../src/audit.js";

describe("platform audit logger", () => {
  it("maps audit events without adding sensitive fields", () => {
    expect(auditInsertRow({
      event: "auth.password.signed_in",
      userId: "11111111-1111-1111-1111-111111111111",
      occurredAt: "2026-09-17T21:30:00.000Z",
      requestId: "req-123",
      metadata: { authMethod: "password" },
    })).toEqual({
      event: "auth.password.signed_in",
      user_id: "11111111-1111-1111-1111-111111111111",
      creator_profile_id: null,
      organization_id: null,
      occurred_at: "2026-09-17T21:30:00.000Z",
      metadata: {
        authMethod: "password",
        requestId: "req-123",
      },
    });
  });

  it("does not break authentication when audit persistence fails", async () => {
    const logger: PlatformAuditLogger = {
      record: vi.fn().mockRejectedValue(new Error("AUDIT_INSERT_FAILED:500")),
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(recordAuditBestEffort(logger, {
      event: "auth.signed_out",
      occurredAt: "2026-09-17T21:30:00.000Z",
      requestId: "req-456",
    })).resolves.toBeUndefined();

    expect(logger.record).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledWith("GMVGANG_AUDIT_WRITE_FAILED", {
      event: "auth.signed_out",
      requestId: "req-456",
      code: "AUDIT_INSERT_FAILED",
    });
    errorSpy.mockRestore();
  });
});
