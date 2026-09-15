import { describe, expect, it, vi } from "vitest";
import {
  approveCampaign,
  createCampaignDraft,
  evaluateCampaignReadiness,
  launchCampaign,
  type CampaignLedger
} from "@gmvgang/campaign-operations";
import { dispatchApprovedInitialOutreach, prepareInitialOutreachDispatch } from "./dispatch";
import type {
  InitialOutreachDispatchRequest,
  InitialOutreachTransport,
  OutreachClaimInput,
  OutreachClaimResult,
  OutreachIdempotencyRecord,
  OutreachIdempotencyStore,
  OutreachTransportReceipt
} from "./types";

const founder = { kind: "human" as const, id: "founder" };

function readyLedger(): CampaignLedger {
  let ledger = createCampaignDraft({
    id: "campaign-1",
    name: "Validation Sprint",
    brandId: "brand-1",
    productId: "product-1",
    creatorList: {
      id: "list-1",
      name: "Shortlist",
      sourceSegmentId: "segment-1",
      creatorIds: ["creator-1"],
      generatedAt: "2026-09-15T18:00:00.000Z"
    },
    createdAt: "2026-09-15T18:00:00.000Z",
    actor: founder
  });
  ledger = evaluateCampaignReadiness(
    ledger,
    {
      clientApproved: true,
      creators: [{ creatorId: "creator-1", contractReady: true, complianceReady: true, eligible: true }]
    },
    founder,
    "2026-09-15T18:05:00.000Z"
  );
  ledger = approveCampaign(ledger, founder, "2026-09-15T18:06:00.000Z");
  return launchCampaign(ledger, founder, "2026-09-15T18:07:00.000Z");
}

class MemoryStore implements OutreachIdempotencyStore {
  private readonly records = new Map<string, OutreachIdempotencyRecord>();

  async claim(input: OutreachClaimInput): Promise<OutreachClaimResult> {
    const existing = this.records.get(input.key);
    if (existing) {
      if (existing.fingerprint !== input.fingerprint) return { status: "conflict", record: existing };
      return { status: existing.state, record: existing };
    }
    const record: OutreachIdempotencyRecord = {
      ...input,
      state: "in_flight",
      updatedAt: input.claimedAt,
      receipt: null,
      failureCode: null
    };
    this.records.set(input.key, record);
    return { status: "claimed", record };
  }

  async complete(key: string, receipt: OutreachTransportReceipt, at: string): Promise<void> {
    const current = this.records.get(key);
    if (!current) throw new Error("missing claim");
    this.records.set(key, { ...current, state: "sent", receipt, updatedAt: at, failureCode: null });
  }

  async markUncertain(key: string, failureCode: string, at: string): Promise<void> {
    const current = this.records.get(key);
    if (!current) throw new Error("missing claim");
    this.records.set(key, { ...current, state: "uncertain", failureCode, updatedAt: at });
  }

  async get(key: string): Promise<OutreachIdempotencyRecord | null> {
    return this.records.get(key) ?? null;
  }
}

function baseInput(ledger: CampaignLedger, store: OutreachIdempotencyStore, transport: InitialOutreachTransport) {
  return {
    ledger,
    creatorId: "creator-1",
    approval: {
      approvalId: "approval-1",
      approvedAt: "2026-09-15T18:08:00.000Z",
      approverId: "founder"
    },
    template: { templateId: "creator-outreach", version: "v1" },
    requestedAt: "2026-09-15T18:09:00.000Z",
    store,
    transport
  };
}

describe("approval-gated initial outreach dispatch", () => {
  it("refuses dispatch preparation without explicit approval identity", () => {
    const ledger = readyLedger();
    expect(() => prepareInitialOutreachDispatch({
      ...baseInput(ledger, new MemoryStore(), { send: vi.fn() }),
      approval: { approvalId: "", approvedAt: "2026-09-15T18:08:00.000Z", approverId: "founder" }
    })).toThrow("approval.approvalId must not be empty");
  });

  it("refuses a manually active campaign whose readiness is not green", () => {
    const ledger = readyLedger();
    const unsafe: CampaignLedger = {
      ...ledger,
      campaign: {
        ...ledger.campaign,
        readiness: { ...ledger.campaign.readiness, ready: false, blockers: ["Client approval missing"] }
      }
    };
    expect(() => prepareInitialOutreachDispatch(baseInput(unsafe, new MemoryStore(), { send: vi.fn() })))
      .toThrow("campaign readiness is not green");
  });

  it("sends once and reconciles the campaign ledger", async () => {
    const ledger = readyLedger();
    const store = new MemoryStore();
    const send = vi.fn(async (_request: InitialOutreachDispatchRequest): Promise<OutreachTransportReceipt> => ({
      provider: "test-provider",
      providerMessageId: "message-1",
      sentAt: "2026-09-15T18:10:00.000Z"
    }));

    const result = await dispatchApprovedInitialOutreach(baseInput(ledger, store, { send }));

    expect(result.status).toBe("sent");
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.ledger.campaign.assignments[0]?.outreach.status).toBe("sent");
    expect(result.request.idempotencyKey).toBe("gmvgang:campaign:campaign-1:creator:creator-1:outreach:initial:v1");
  });

  it("deduplicates retries even when a new approval id is supplied", async () => {
    const ledger = readyLedger();
    const store = new MemoryStore();
    const send = vi.fn(async (): Promise<OutreachTransportReceipt> => ({
      provider: "test-provider",
      providerMessageId: "message-1",
      sentAt: "2026-09-15T18:10:00.000Z"
    }));

    const first = await dispatchApprovedInitialOutreach(baseInput(ledger, store, { send }));
    expect(first.status).toBe("sent");

    const second = await dispatchApprovedInitialOutreach({
      ...baseInput(ledger, store, { send }),
      approval: {
        approvalId: "approval-2",
        approvedAt: "2026-09-15T18:11:00.000Z",
        approverId: "founder"
      },
      requestedAt: "2026-09-15T18:12:00.000Z"
    });

    expect(second.status).toBe("duplicate");
    expect(send).toHaveBeenCalledTimes(1);
    expect(second.ledger.campaign.assignments[0]?.outreach.status).toBe("sent");
  });

  it("blocks a changed template behind the same logical action key", async () => {
    const ledger = readyLedger();
    const store = new MemoryStore();
    const send = vi.fn(async (): Promise<OutreachTransportReceipt> => ({
      provider: "test-provider",
      providerMessageId: "message-1",
      sentAt: "2026-09-15T18:10:00.000Z"
    }));

    await dispatchApprovedInitialOutreach(baseInput(ledger, store, { send }));

    await expect(dispatchApprovedInitialOutreach({
      ...baseInput(ledger, store, { send }),
      template: { templateId: "creator-outreach", version: "v2" },
      requestedAt: "2026-09-15T18:12:00.000Z"
    })).rejects.toThrow("idempotency conflict");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("marks ambiguous transport failures uncertain and prevents automatic retry", async () => {
    const ledger = readyLedger();
    const store = new MemoryStore();
    const send = vi.fn(async () => {
      const error = new Error("provider timeout") as Error & { code: string };
      error.code = "provider_timeout";
      throw error;
    });

    const first = await dispatchApprovedInitialOutreach(baseInput(ledger, store, { send }));
    const second = await dispatchApprovedInitialOutreach({
      ...baseInput(ledger, store, { send }),
      requestedAt: "2026-09-15T18:12:00.000Z"
    });

    expect(first.status).toBe("uncertain");
    expect(first.status === "uncertain" ? first.failureCode : null).toBe("provider_timeout");
    expect(second.status).toBe("blocked");
    expect(second.status === "blocked" ? second.reason : null).toBe("uncertain");
    expect(send).toHaveBeenCalledTimes(1);
  });
});
