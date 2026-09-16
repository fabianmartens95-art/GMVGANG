import type {
  CreatorProfileCompletionCommand,
  CreatorRegistrationResult,
  PublicCreatorRegistrationInput,
  TrustedCreatorRegistrationContext,
} from "@gmvgang/creator-registration";
import type { CreatorProfile, PlatformSessionContext } from "@gmvgang/platform-foundation";

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

export interface PlatformApiServices {
  resolveSessionContext(input: {
    accessToken: string;
    requestedOrganizationId?: string;
    now: string;
  }): Promise<PlatformSessionContext>;
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
