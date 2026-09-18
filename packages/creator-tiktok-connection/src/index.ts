import type { ExternalConnection } from "@gmvgang/platform-foundation";

export type CreatorTikTokConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "refresh_required"
  | "reconnect_required";

export type CreatorTikTokNextAction =
  | "connect_tiktok"
  | "finish_tiktok_connection"
  | "refresh_tiktok_connection"
  | "reconnect_tiktok"
  | "none";

export type CreatorTikTokConnectionReadModel = {
  state: CreatorTikTokConnectionState;
  nextAction: CreatorTikTokNextAction;
  market: string | null;
  externalAccountId: string | null;
  externalShopIds: string[];
  grantedScopes: string[];
  lastSyncAt: string | null;
  lastErrorCode: string | null;
};

export type CreatorTikTokConnectionTransition = {
  from: ExternalConnection["status"] | "none";
  to: ExternalConnection["status"];
};

const ALLOWED_TRANSITIONS: Record<
  CreatorTikTokConnectionTransition["from"],
  readonly ExternalConnection["status"][]
> = {
  none: ["pending"],
  not_connected: ["pending"],
  pending: ["connected", "error", "revoked"],
  connected: ["connected", "expired", "revoked", "error"],
  expired: ["pending"],
  revoked: ["pending"],
  error: ["pending"],
};

function parseTimestamp(value: string, code: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
}

export function authorizeCreatorTikTokConnectionTransition(
  input: CreatorTikTokConnectionTransition,
): { ok: true } | { ok: false; error: "CREATOR_TIKTOK_CONNECTION_TRANSITION_DENIED" } {
  return ALLOWED_TRANSITIONS[input.from].includes(input.to)
    ? { ok: true }
    : { ok: false, error: "CREATOR_TIKTOK_CONNECTION_TRANSITION_DENIED" };
}

export function buildCreatorTikTokConnectionReadModel(
  connection: ExternalConnection | null,
  input: { now: string; refreshWithinMinutes?: number },
): CreatorTikTokConnectionReadModel {
  const nowMs = parseTimestamp(input.now, "CREATOR_TIKTOK_CONNECTION_NOW_INVALID");
  const refreshWithinMinutes = input.refreshWithinMinutes ?? 30;
  if (!Number.isInteger(refreshWithinMinutes) || refreshWithinMinutes < 0 || refreshWithinMinutes > 24 * 60) {
    throw new Error("CREATOR_TIKTOK_REFRESH_WINDOW_INVALID");
  }

  if (!connection) {
    return {
      state: "disconnected",
      nextAction: "connect_tiktok",
      market: null,
      externalAccountId: null,
      externalShopIds: [],
      grantedScopes: [],
      lastSyncAt: null,
      lastErrorCode: null,
    };
  }

  if (connection.provider !== "tiktok_shop_creator" || connection.ownerType !== "creator_profile") {
    throw new Error("CREATOR_TIKTOK_CONNECTION_IDENTITY_INVALID");
  }

  const base = {
    market: connection.market ?? null,
    externalAccountId: connection.externalAccountId ?? null,
    externalShopIds: [...(connection.externalShopIds ?? [])],
    grantedScopes: [...connection.grantedScopes],
    lastSyncAt: connection.lastSyncAt ?? null,
    lastErrorCode: connection.lastErrorCode ?? null,
  };

  if (connection.status === "pending") {
    return {
      state: "connecting",
      nextAction: "finish_tiktok_connection",
      ...base,
    };
  }

  if (connection.status === "expired" || connection.status === "revoked" || connection.status === "error") {
    return {
      state: "reconnect_required",
      nextAction: "reconnect_tiktok",
      ...base,
    };
  }

  if (connection.status !== "connected") {
    return {
      state: "disconnected",
      nextAction: "connect_tiktok",
      ...base,
    };
  }

  if (connection.tokenExpiresAt) {
    const expiresMs = parseTimestamp(
      connection.tokenExpiresAt,
      "CREATOR_TIKTOK_TOKEN_EXPIRY_INVALID",
    );
    if (expiresMs <= nowMs) {
      return {
        state: "reconnect_required",
        nextAction: "reconnect_tiktok",
        ...base,
      };
    }

    if (
      connection.refreshTokenSecretRef &&
      expiresMs <= nowMs + refreshWithinMinutes * 60_000
    ) {
      return {
        state: "refresh_required",
        nextAction: "refresh_tiktok_connection",
        ...base,
      };
    }
  }

  return {
    state: "connected",
    nextAction: "none",
    ...base,
  };
}
