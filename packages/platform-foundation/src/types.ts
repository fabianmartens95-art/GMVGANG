export type PlatformUserRole =
  | "founder"
  | "admin"
  | "creator_manager"
  | "brand_manager"
  | "closer"
  | "creator"
  | "brand_member";

export type AccountStatus = "pending" | "active" | "suspended" | "disabled";

export type CreatorNetworkStatus =
  | "registered"
  | "profile_complete"
  | "qualified"
  | "invited"
  | "contracted"
  | "active"
  | "performing"
  | "rejected"
  | "paused";

export type BrandStatus = "lead" | "qualified" | "onboarding" | "active" | "paused" | "churned";

export type OrganizationType = "gmvgang" | "brand";

export type ConnectionProvider = "tiktok_creator" | "tiktok_shop_seller" | "tiktok_shop_creator";
export type ConnectionStatus = "not_connected" | "pending" | "connected" | "expired" | "revoked" | "error";

export type ReferralStatus =
  | "attributed"
  | "profile_complete"
  | "qualified"
  | "contracted"
  | "active"
  | "performing"
  | "rejected"
  | "fraud_review";

export type ReferralRewardEvent =
  | "qualified"
  | "contracted"
  | "first_qualified_performance"
  | "manual_bonus";

export type RewardStatus = "pending" | "approved" | "paid" | "rejected" | "void";

export interface PlatformUser {
  id: string;
  email: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  type: OrganizationType;
  name: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  id: string;
  userId: string;
  organizationId: string;
  role: PlatformUserRole;
  status: "invited" | "active" | "revoked";
  createdAt: string;
  updatedAt: string;
}

export interface CreatorProfile {
  id: string;
  userId: string;
  creatorMasterId?: string;
  tiktokHandle: string;
  displayName?: string;
  market?: string;
  language?: string;
  niche?: string[];
  networkStatus: CreatorNetworkStatus;
  profileCompletionPercent: number;
  referralCode: string;
  referredByCreatorProfileId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandProfile {
  id: string;
  organizationId: string;
  brandMasterId?: string;
  legalName?: string;
  website?: string;
  status: BrandStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalConnection {
  id: string;
  ownerType: "creator_profile" | "organization";
  ownerId: string;
  provider: ConnectionProvider;
  status: ConnectionStatus;
  market?: string;
  externalAccountId?: string;
  externalShopIds?: string[];
  grantedScopes: string[];
  accessTokenSecretRef?: string;
  refreshTokenSecretRef?: string;
  tokenExpiresAt?: string;
  lastSyncAt?: string;
  lastErrorCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralAttribution {
  id: string;
  referrerCreatorProfileId: string;
  referredCreatorProfileId: string;
  referralCode: string;
  status: ReferralStatus;
  attributedAt: string;
  qualifiedAt?: string;
  contractedAt?: string;
  activatedAt?: string;
  performingAt?: string;
  fraudFlags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ReferralReward {
  id: string;
  referralAttributionId: string;
  event: ReferralRewardEvent;
  amountCents: number;
  currency: "EUR";
  status: RewardStatus;
  approvedAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}
