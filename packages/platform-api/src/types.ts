import type {
  CreatorProfileCompletionCommand,
  CreatorRegistrationResult,
  PublicCreatorRegistrationInput,
  TrustedCreatorRegistrationContext,
} from "@gmvgang/creator-registration";
import type { BrandPortalReadModel } from "@gmvgang/brand-intelligence/portal";
import type {
  CreatorProfile,
  PlatformSessionContext,
  ReferralStatus,
} from "@gmvgang/platform-foundation";

export interface PlatformAccessTokenPort {
  getAccessToken(request: Request): Promise<string | null>;
}

export interface PlatformApiClock {
  now(): string;
}

export type PlatformRateLimitAction = "creator_registration" | "creator_profile_completion";

export interface PlatformRateLimitPort {
  consume(input: {
    action: PlatformRateLimitAction;
    subject: string;
    now: string;
  }): boolean | Promise<boolean>;
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

export interface PlatformApiServices {
  resolveSessionContext(input: {
    accessToken: string;
    requestedOrganizationId?: string;
    now: string;
  }): Promise<PlatformSessionContext>;
  getBrandOverview?(input: {
    organizationId: string;
    userId: string;
    now: string;
  }): Promise<BrandPortalReadModel>;
  getCreatorProfile(input: {
    userId: string;
    now: string;
  }): Promise<CreatorProfile | null>;
  getCreatorReferralHub?(input: {
    userId: string;
    now: string;
  }): Promise<CreatorReferralHubReadModel | null>;
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
};
