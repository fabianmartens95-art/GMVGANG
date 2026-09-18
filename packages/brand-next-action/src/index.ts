export type BrandTikTokState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "refresh_required"
  | "reconnect_required";

export type BrandWorkspaceMode = "full_access" | "read_only";

export type BrandNextBestActionId =
  | "complete_brand_onboarding"
  | "restore_brand_access"
  | "connect_tiktok_shop"
  | "finish_tiktok_shop_connection"
  | "refresh_tiktok_shop_connection"
  | "reconnect_tiktok_shop"
  | "add_first_product"
  | "launch_first_campaign"
  | "review_creator_matches"
  | "resolve_campaign_action"
  | "monitor_active_campaigns";

export type BrandNextBestActionInput = {
  onboardingComplete: boolean;
  workspaceMode: BrandWorkspaceMode;
  tiktokState: BrandTikTokState;
  activeProducts: number;
  activeCampaigns: number;
  pendingCreatorMatches: number;
  campaignActionsRequired: number;
};

export type BrandNextBestAction = {
  id: BrandNextBestActionId;
  priority: "critical" | "high" | "normal";
  reason: string;
};

function assertCount(value: number, code: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(code);
}

export function recommendBrandNextBestAction(
  input: BrandNextBestActionInput,
): BrandNextBestAction {
  assertCount(input.activeProducts, "BRAND_NBA_PRODUCT_COUNT_INVALID");
  assertCount(input.activeCampaigns, "BRAND_NBA_CAMPAIGN_COUNT_INVALID");
  assertCount(input.pendingCreatorMatches, "BRAND_NBA_CREATOR_MATCH_COUNT_INVALID");
  assertCount(input.campaignActionsRequired, "BRAND_NBA_CAMPAIGN_ACTION_COUNT_INVALID");

  if (!input.onboardingComplete) {
    return {
      id: "complete_brand_onboarding",
      priority: "critical",
      reason: "Schließe das Brand-Onboarding ab, damit Trial und Workspace-Funktionen freigeschaltet werden können.",
    };
  }

  if (input.workspaceMode === "read_only") {
    return {
      id: "restore_brand_access",
      priority: "critical",
      reason: "Der Workspace ist aktuell schreibgeschützt. Stelle einen aktiven Zugriff wieder her, um Änderungen vorzunehmen.",
    };
  }

  if (input.tiktokState === "disconnected") {
    return {
      id: "connect_tiktok_shop",
      priority: "high",
      reason: "Verbinde den TikTok Shop, damit Commerce-Daten und spätere Synchronisationen sicher zugeordnet werden können.",
    };
  }

  if (input.tiktokState === "connecting") {
    return {
      id: "finish_tiktok_shop_connection",
      priority: "high",
      reason: "Die TikTok-Shop-Verbindung wurde begonnen und muss abgeschlossen werden.",
    };
  }

  if (input.tiktokState === "refresh_required") {
    return {
      id: "refresh_tiktok_shop_connection",
      priority: "high",
      reason: "Die TikTok-Shop-Verbindung läuft bald ab und sollte erneuert werden.",
    };
  }

  if (input.tiktokState === "reconnect_required") {
    return {
      id: "reconnect_tiktok_shop",
      priority: "high",
      reason: "Die TikTok-Shop-Verbindung ist nicht mehr nutzbar und muss erneut hergestellt werden.",
    };
  }

  if (input.activeProducts === 0) {
    return {
      id: "add_first_product",
      priority: "high",
      reason: "Lege mindestens ein aktives Produkt an, bevor eine Commerce-Kampagne sinnvoll gestartet werden kann.",
    };
  }

  if (input.activeCampaigns === 0) {
    return {
      id: "launch_first_campaign",
      priority: "high",
      reason: "Erstelle die erste aktive Kampagne, um Creator-Matching und Performance-Tracking zu starten.",
    };
  }

  if (input.campaignActionsRequired > 0) {
    return {
      id: "resolve_campaign_action",
      priority: "high",
      reason: `${input.campaignActionsRequired} Kampagnenaktion${input.campaignActionsRequired === 1 ? "" : "en"} benötigt Aufmerksamkeit.`,
    };
  }

  if (input.pendingCreatorMatches > 0) {
    return {
      id: "review_creator_matches",
      priority: "normal",
      reason: `${input.pendingCreatorMatches} Creator-Match${input.pendingCreatorMatches === 1 ? "" : "es"} wartet auf Prüfung.`,
    };
  }

  return {
    id: "monitor_active_campaigns",
    priority: "normal",
    reason: "Die Kernkonfiguration steht. Prüfe laufende Kampagnen, Creator-Performance und nächste Optimierungen.",
  };
}
