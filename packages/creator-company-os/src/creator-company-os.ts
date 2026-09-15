import {
  normalizeReferralCode,
  normalizeTikTokHandle,
} from "@gmvgang/creator-growth";

export const CREATOR_COMPANY_OS_FIELDS = {
  creatorId: "Creator-ID",
  tiktokHandle: "TikTok Handle",
  tiktokName: "TikTok Name",
  email: "E-Mail",
  fullName: "Vollständiger Name",
  status: "Status",
  intakeStage: "Intake-Stage",
  source: "Bewerbung Quelle",
  ageConfirmed: "Mindestens 18 Jahre",
  privacyAccepted: "Datenschutz bestätigt",
} as const;

export type CompanyOsCreatorRegistration = {
  fullName: string;
  normalizedHandle: string;
  normalizedEmail: string;
  referralCode?: string;
};

export type CompanyOsPropertyValue = string | number | boolean;
export type CompanyOsProperties = Record<string, CompanyOsPropertyValue>;

export type ExistingCreatorIdentity = {
  pageId: string;
  creatorId?: string | number;
  tiktokHandle?: string;
  email?: string;
};

export type CreatorUpsertDecision =
  | { action: "create" }
  | { action: "update"; pageId: string }
  | {
      action: "conflict";
      reason: "multiple_handle_matches" | "multiple_email_matches" | "identity_split";
      pageIds: string[];
    };

export function buildPortalRegistrationProperties(
  input: CompanyOsCreatorRegistration,
): CompanyOsProperties {
  const handle = normalizeTikTokHandle(input.normalizedHandle);
  if (!handle) throw new Error("invalid normalized TikTok handle");

  const referralCode = normalizeReferralCode(input.referralCode);
  const tiktokName = handle.replace(/^@/, "");

  return {
    [CREATOR_COMPANY_OS_FIELDS.tiktokName]: tiktokName,
    [CREATOR_COMPANY_OS_FIELDS.tiktokHandle]: handle,
    [CREATOR_COMPANY_OS_FIELDS.email]: input.normalizedEmail.trim().toLowerCase(),
    [CREATOR_COMPANY_OS_FIELDS.fullName]: input.fullName.trim(),
    [CREATOR_COMPANY_OS_FIELDS.status]: "Screening",
    [CREATOR_COMPANY_OS_FIELDS.source]: referralCode ? "Empfehlung" : "Website",
    [CREATOR_COMPANY_OS_FIELDS.ageConfirmed]: true,
    [CREATOR_COMPANY_OS_FIELDS.privacyAccepted]: true,
  };
}

export function decideCreatorUpsert(input: {
  handleMatches: ExistingCreatorIdentity[];
  emailMatches: ExistingCreatorIdentity[];
}): CreatorUpsertDecision {
  const uniqueHandlePages = uniquePageIds(input.handleMatches);
  const uniqueEmailPages = uniquePageIds(input.emailMatches);

  if (uniqueHandlePages.length > 1) {
    return {
      action: "conflict",
      reason: "multiple_handle_matches",
      pageIds: uniqueHandlePages,
    };
  }
  if (uniqueEmailPages.length > 1) {
    return {
      action: "conflict",
      reason: "multiple_email_matches",
      pageIds: uniqueEmailPages,
    };
  }

  const handlePage = uniqueHandlePages[0];
  const emailPage = uniqueEmailPages[0];
  if (handlePage && emailPage && handlePage !== emailPage) {
    return {
      action: "conflict",
      reason: "identity_split",
      pageIds: [handlePage, emailPage],
    };
  }

  const pageId = handlePage ?? emailPage;
  return pageId ? { action: "update", pageId } : { action: "create" };
}

function uniquePageIds(matches: ExistingCreatorIdentity[]): string[] {
  return [...new Set(matches.map((match) => match.pageId))].sort();
}
