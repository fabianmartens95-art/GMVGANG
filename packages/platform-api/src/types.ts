import type { BrandPortalReadModel } from "@gmvgang/brand-intelligence/portal";
import type {
  CampaignStatus,
  ContentStatus,
  OutreachStatus,
  SampleStatus,
} from "@gmvgang/campaign-operations";
import type { CreatorActivation, CreatorActivationInput } from "@gmvgang/creator-activation";
import type {
  CreatorQualification,
  CreatorQualificationInput,
} from "@gmvgang/creator-qualification";
import type {
  CreatorProfileCompletionCommand,
  CreatorRegistrationResult,
  PublicCreatorRegistrationInput,
  TrustedCreatorRegistrationContext,
} from "@gmvgang/creator-registration";
import type {
  CreatorProfile,
  Membership,
  PlatformSessionContext,
  PlatformUserRole,
  ReferralStatus,
} from "@gmvgang/platform-foundation";

export interface PlatformAccessTokenPort {
  getAccessToken(request: Request): Promise<string | null>;
}

export interface PlatformApiClock {
  now(): string;
}

export type PlatformRateLimitAction =
  | "creator_registration"
  | "creator_profile_completion"
  | "creator_qualification"
  | "creator_activation";

export interface PlatformRateLimitPort {
  consume(input: {
    action: PlatformRateLimitAction;
    subject: string;
    now: string;
  }): boolean | Promise<boolean>;
}

export type PlatformIdempotencyBeginResult =
  | { status: "started" }
  | { status: "in_progress" }
  | { status: "conflict" }
  | { status: "replay"; responseStatus: number; responseBody: unknown };

export interface PlatformIdempotencyPort {
  begin(input: {
    scope: PlatformRateLimitAction;
    subject: string;
    key: string;
    requestHash: string;
    now: string;
  }): Promise<PlatformIdempotencyBeginResult>;
  complete(input: {
    scope: PlatformRateLimitAction;
    subject: string;
    key: string;
    requestHash: string;
    responseStatus: number;
    responseBody: unknown;
    now: string;
  }): Promise<void>;
}

export interface CreatorOperationsSyncPort {
  syncCreatorProfile(profile: CreatorProfile): Promise<{ creatorMasterId?: string }>;
}

export interface BrandOverviewReadPort {
  getOverview(input: {
    organizationId: string;
    userId: string;
    now: string;
  }): Promise<BrandPortalReadModel>;
}

export type PlatformMembershipMutationInput = {
  actorUserId: string;
  targetUserId: string;
  organizationId: string;
  role: PlatformUserRole;
  status: Membership["status"];
  now: string;
};

export type CreatorReferralHubItem = {
  status: ReferralStatus;
  attributedAt: string;
  qualifiedAt?: string;
  contractedAt?: string;
  activatedAt?: string;
  performingAt?: string;
};

export type CreatorReferralHubReadModel = {
  referralCode: string;
  totalReferrals: number;
  statusCounts: Record<ReferralStatus, number>;
  recentReferrals: CreatorReferralHubItem[];
};

export type CreatorWorkspaceSourceAssignment = {
  campaign: {
    id: string;
    name: string;
    status: CampaignStatus;
    clientApproved: boolean;
    launchedAt: string | null;
    completedAt: string | null;
    updatedAt: string | null;
  };
  creatorReady: boolean;
  outreachStatus: OutreachStatus;
  sampleStatus: SampleStatus;
  contentStatus: ContentStatus;
  postedAt: string | null;
  operationalPerformance: {
    gmV: number;
    orders: number;
    commission: number;
    updatedAt: string | null;
  };
};

export type CreatorWorkspaceSourceSnapshot = {
  assignments: CreatorWorkspaceSourceAssignment[];
  syncedAt: string | null;
};

export interface CreatorWorkspaceSourcePort {
  readForCreator(input: {
    creatorMasterId: string;
    now: string;
  }): Promise<CreatorWorkspaceSourceSnapshot>;
}

export type CreatorWorkspaceMatch = {
  campaignId: string;
  campaignName: string;
  status: "new" | "contacted" | "awaiting_response";
};

export type CreatorWorkspaceCampaign = {
  campaignId: string;
  campaignName: string;
  status: CampaignStatus;
  sampleStatus: SampleStatus;
  contentStatus: ContentStatus;
  launchedAt: string | null;
  completedAt: string | null;
  postedAt: string | null;
};

export type CreatorWorkspacePerformance = {
  source: "company-os-operational";
  verification: "provisional";
  currency: null;
  totals: {
    gmV: number;
    orders: number;
    commission: number;
    postedContent: number;
  };
  campaigns: Array<{
    campaignId: string;
    campaignName: string;
    gmV: number;
    orders: number;
    commission: number;
    updatedAt: string | null;
  }>;
  updatedAt: string | null;
};

export type CreatorWorkspaceReadModel = {
  availability: "available" | "unavailable";
  generatedAt: string;
  syncedAt: string | null;
  unavailableReason?: "source_not_configured" | "creator_master_id_missing";
  matches: CreatorWorkspaceMatch[];
  campaigns: CreatorWorkspaceCampaign[];
  performance: CreatorWorkspacePerformance;
};

export interface PlatformApiServices {
  resolveSessionContext(input: {
    accessToken: string;
    requestedOrganizationId?: string;
    now: string;
  }): Promise<PlatformSessionContext>;
  manageMembership?(input: PlatformMembershipMutationInput): Promise<Membership>;
  getBrandOverview?(input: {
    organizationId: string;
    userId: string;
    now: string;
  }): Promise<BrandPortalReadModel>;
  getCreatorProfile(input: {
    userId: string;
    now: string;
  }): Promise<CreatorProfile | null>;
  getCreatorQualification?(input: {
    userId: string;
    now: string;
  }): Promise<CreatorQualification | null>;
  submitCreatorQualification?(
    input: CreatorQualificationInput,
    context: TrustedCreatorRegistrationContext,
  ): Promise<CreatorQualification>;
  getCreatorActivation?(input: {
    userId: string;
    now: string;
  }): Promise<CreatorActivation | null>;
  submitCreatorActivation?(
    input: CreatorActivationInput,
    context: TrustedCreatorRegistrationContext,
  ): Promise<CreatorActivation>;
  getCreatorReferralHub?(input: {
    userId: string;
    now: string;
  }): Promise<CreatorReferralHubReadModel | null>;
  getCreatorWorkspace?(input: {
    userId: string;
    now: string;
  }): Promise<CreatorWorkspaceReadModel | null>;
  registerCreator(
    input: PublicCreatorRegistrationInput,
    context: TrustedCreatorRegistrationContext,
  ): Promise<CreatorRegistrationResult>;
  completeCreatorProfile(
    input: CreatorProfileCompletionCommand,
    context: TrustedCreatorRegistrationContext,
  ): Promise<CreatorProfile>;
}

export type PlatformApiDependencies = {
  accessTokens: PlatformAccessTokenPort;
  services: PlatformApiServices;
  clock: PlatformApiClock;
  privacyNoticeVersion: string;
  rateLimits?: PlatformRateLimitPort;
  idempotency?: PlatformIdempotencyPort;
};
