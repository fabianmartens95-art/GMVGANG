import type {
  CreatorRegistrationResult,
  PublicCreatorRegistrationInput,
  TrustedCreatorRegistrationContext,
} from "@gmvgang/creator-registration";
import type { PlatformSessionContext } from "@gmvgang/platform-foundation";

export interface PlatformAccessTokenPort {
  getAccessToken(request: Request): Promise<string | null>;
}

export interface PlatformApiClock {
  now(): string;
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
}

export type PlatformApiDependencies = {
  accessTokens: PlatformAccessTokenPort;
  services: PlatformApiServices;
  clock: PlatformApiClock;
  privacyNoticeVersion: string;
};
