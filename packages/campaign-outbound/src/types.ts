import type { CampaignLedger } from "@gmvgang/campaign-operations";

export type OutreachApproval = {
  approvalId: string;
  approvedAt: string;
  approverId: string;
};

export type OutreachTemplateRef = {
  templateId: string;
  version: string;
};

export type InitialOutreachDispatchRequest = {
  campaignId: string;
  brandId: string;
  productId: string;
  creatorId: string;
  actionKind: "send-outreach";
  approval: OutreachApproval;
  template: OutreachTemplateRef;
  idempotencyKey: string;
  fingerprint: string;
  requestedAt: string;
};

export type OutreachTransportReceipt = {
  provider: string;
  providerMessageId: string;
  sentAt: string;
};

export type OutreachIdempotencyState = "in_flight" | "sent" | "uncertain";

export type OutreachIdempotencyRecord = {
  key: string;
  fingerprint: string;
  state: OutreachIdempotencyState;
  campaignId: string;
  creatorId: string;
  approvalId: string;
  claimedAt: string;
  updatedAt: string;
  receipt: OutreachTransportReceipt | null;
  failureCode: string | null;
};

export type OutreachClaimInput = Omit<OutreachIdempotencyRecord, "state" | "updatedAt" | "receipt" | "failureCode">;

export type OutreachClaimResult =
  | { status: "claimed"; record: OutreachIdempotencyRecord }
  | { status: "sent"; record: OutreachIdempotencyRecord }
  | { status: "in_flight"; record: OutreachIdempotencyRecord }
  | { status: "uncertain"; record: OutreachIdempotencyRecord }
  | { status: "conflict"; record: OutreachIdempotencyRecord };

export interface OutreachIdempotencyStore {
  claim(input: OutreachClaimInput): Promise<OutreachClaimResult>;
  complete(key: string, receipt: OutreachTransportReceipt, at: string): Promise<void>;
  markUncertain(key: string, failureCode: string, at: string): Promise<void>;
  get(key: string): Promise<OutreachIdempotencyRecord | null>;
}

export interface InitialOutreachTransport {
  send(request: InitialOutreachDispatchRequest): Promise<OutreachTransportReceipt>;
}

export type DispatchInitialOutreachInput = {
  ledger: CampaignLedger;
  creatorId: string;
  approval: OutreachApproval;
  template: OutreachTemplateRef;
  requestedAt: string;
  store: OutreachIdempotencyStore;
  transport: InitialOutreachTransport;
};

export type DispatchInitialOutreachResult =
  | {
      status: "sent";
      ledger: CampaignLedger;
      request: InitialOutreachDispatchRequest;
      receipt: OutreachTransportReceipt;
    }
  | {
      status: "duplicate";
      ledger: CampaignLedger;
      request: InitialOutreachDispatchRequest;
      receipt: OutreachTransportReceipt;
    }
  | {
      status: "blocked";
      ledger: CampaignLedger;
      request: InitialOutreachDispatchRequest;
      reason: "in_flight" | "uncertain";
    }
  | {
      status: "uncertain";
      ledger: CampaignLedger;
      request: InitialOutreachDispatchRequest;
      failureCode: string;
    };
