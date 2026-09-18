export type CreatorTikTokState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "refresh_required"
  | "reconnect_required";

export type CreatorNextBestActionId =
  | "complete_profile"
  | "complete_qualification"
  | "connect_tiktok"
  | "finish_tiktok_connection"
  | "refresh_tiktok_connection"
  | "reconnect_tiktok"
  | "review_campaign_opportunity"
  | "submit_campaign_content"
  | "review_sample_status"
  | "explore_matches";

export type CreatorNextBestActionInput = {
  profileComplete: boolean;
  qualificationComplete: boolean;
  tiktokState: CreatorTikTokState;
  pendingCampaignDecisions: number;
  pendingContentSubmissions: number;
  pendingSampleActions: number;
};

export type CreatorNextBestAction = {
  id: CreatorNextBestActionId;
  priority: "critical" | "high" | "normal";
  reason: string;
};

function assertCount(value: number, code: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(code);
}

export function recommendCreatorNextBestAction(
  input: CreatorNextBestActionInput,
): CreatorNextBestAction {
  assertCount(input.pendingCampaignDecisions, "CREATOR_NBA_CAMPAIGN_COUNT_INVALID");
  assertCount(input.pendingContentSubmissions, "CREATOR_NBA_CONTENT_COUNT_INVALID");
  assertCount(input.pendingSampleActions, "CREATOR_NBA_SAMPLE_COUNT_INVALID");

  if (!input.profileComplete) {
    return {
      id: "complete_profile",
      priority: "critical",
      reason: "Dein Profil muss vollständig sein, bevor weitere Creator-Funktionen freigeschaltet werden.",
    };
  }

  if (!input.qualificationComplete) {
    return {
      id: "complete_qualification",
      priority: "critical",
      reason: "Schließe die Qualifizierung ab, damit GMVGANG passende Opportunities zuordnen kann.",
    };
  }

  if (input.tiktokState === "disconnected") {
    return {
      id: "connect_tiktok",
      priority: "high",
      reason: "Verbinde dein TikTok-Konto, damit Account- und Commerce-Daten sicher zugeordnet werden können.",
    };
  }

  if (input.tiktokState === "connecting") {
    return {
      id: "finish_tiktok_connection",
      priority: "high",
      reason: "Die TikTok-Verbindung wurde begonnen und muss abgeschlossen werden.",
    };
  }

  if (input.tiktokState === "refresh_required") {
    return {
      id: "refresh_tiktok_connection",
      priority: "high",
      reason: "Die TikTok-Verbindung läuft bald ab und sollte erneuert werden.",
    };
  }

  if (input.tiktokState === "reconnect_required") {
    return {
      id: "reconnect_tiktok",
      priority: "high",
      reason: "Die TikTok-Verbindung ist nicht mehr nutzbar und muss erneut hergestellt werden.",
    };
  }

  if (input.pendingCampaignDecisions > 0) {
    return {
      id: "review_campaign_opportunity",
      priority: "high",
      reason: `${input.pendingCampaignDecisions} Campaign-Opportunit${input.pendingCampaignDecisions === 1 ? "ät" : "äten"} warten auf deine Entscheidung.`,
    };
  }

  if (input.pendingSampleActions > 0) {
    return {
      id: "review_sample_status",
      priority: "normal",
      reason: `${input.pendingSampleActions} Sample-Vorg${input.pendingSampleActions === 1 ? "ang" : "änge"} benötigen Aufmerksamkeit.`,
    };
  }

  if (input.pendingContentSubmissions > 0) {
    return {
      id: "submit_campaign_content",
      priority: "normal",
      reason: `${input.pendingContentSubmissions} Campaign${input.pendingContentSubmissions === 1 ? "" : "s"} warten auf Content.`,
    };
  }

  return {
    id: "explore_matches",
    priority: "normal",
    reason: "Dein Setup ist vollständig. Prüfe neue Matches und Campaign-Opportunities.",
  };
}
