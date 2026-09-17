export type BrandOnboardingField =
  | "legal_name"
  | "country_code"
  | "contact_name"
  | "contact_email"
  | "primary_goal";

export type BrandOnboardingInput = {
  legalName?: string | null;
  countryCode?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  primaryGoal?: string | null;
  websiteUrl?: string | null;
};

export type BrandOnboardingReadiness = {
  completionPercent: number;
  complete: boolean;
  missingFields: BrandOnboardingField[];
  nextBestAction:
    | "add_legal_name"
    | "add_country"
    | "add_contact"
    | "add_contact_email"
    | "choose_primary_goal"
    | "onboarding_complete";
};

const REQUIRED_FIELDS: readonly BrandOnboardingField[] = [
  "legal_name",
  "country_code",
  "contact_name",
  "contact_email",
  "primary_goal",
];

function clean(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function validCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value);
}

function validEmail(value: string): boolean {
  if (value.length < 5 || value.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function evaluateBrandOnboarding(
  input: BrandOnboardingInput,
): BrandOnboardingReadiness {
  const legalName = clean(input.legalName);
  const countryCode = clean(input.countryCode).toUpperCase();
  const contactName = clean(input.contactName);
  const contactEmail = clean(input.contactEmail).toLowerCase();
  const primaryGoal = clean(input.primaryGoal);

  const missingFields: BrandOnboardingField[] = [];
  if (!legalName) missingFields.push("legal_name");
  if (!validCountryCode(countryCode)) missingFields.push("country_code");
  if (!contactName) missingFields.push("contact_name");
  if (!validEmail(contactEmail)) missingFields.push("contact_email");
  if (!primaryGoal) missingFields.push("primary_goal");

  const completed = REQUIRED_FIELDS.length - missingFields.length;
  const completionPercent = Math.round((completed / REQUIRED_FIELDS.length) * 100);

  const nextBestAction: BrandOnboardingReadiness["nextBestAction"] =
    missingFields.includes("legal_name") ? "add_legal_name"
      : missingFields.includes("country_code") ? "add_country"
        : missingFields.includes("contact_name") ? "add_contact"
          : missingFields.includes("contact_email") ? "add_contact_email"
            : missingFields.includes("primary_goal") ? "choose_primary_goal"
              : "onboarding_complete";

  return {
    completionPercent,
    complete: missingFields.length === 0,
    missingFields,
    nextBestAction,
  };
}
