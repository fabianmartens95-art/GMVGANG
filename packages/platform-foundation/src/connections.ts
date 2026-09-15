import type { ConnectionProvider, ExternalConnection } from "./types.js";

export function expectedOwnerType(provider: ConnectionProvider): ExternalConnection["ownerType"] {
  return provider === "tiktok_shop_seller" ? "organization" : "creator_profile";
}

export function assertConnectionOwnership(connection: ExternalConnection): void {
  const expected = expectedOwnerType(connection.provider);
  if (connection.ownerType !== expected) {
    throw new Error("INVALID_CONNECTION_OWNER_TYPE");
  }
}

export function canSyncConnection(connection: ExternalConnection, now: string): boolean {
  if (connection.status !== "connected") return false;
  if (!connection.accessTokenSecretRef) return false;
  if (!connection.tokenExpiresAt) return true;
  return Date.parse(connection.tokenExpiresAt) > Date.parse(now);
}

export function connectionNeedsRefresh(connection: ExternalConnection, now: string, withinMinutes = 30): boolean {
  if (connection.status !== "connected" || !connection.tokenExpiresAt || !connection.refreshTokenSecretRef) return false;
  const expiresAt = Date.parse(connection.tokenExpiresAt);
  const threshold = Date.parse(now) + withinMinutes * 60_000;
  return expiresAt <= threshold;
}

export function publicConnectionView(connection: ExternalConnection) {
  return {
    id: connection.id,
    ownerType: connection.ownerType,
    ownerId: connection.ownerId,
    provider: connection.provider,
    status: connection.status,
    market: connection.market,
    externalAccountId: connection.externalAccountId,
    externalShopIds: connection.externalShopIds ?? [],
    grantedScopes: [...connection.grantedScopes],
    tokenExpiresAt: connection.tokenExpiresAt,
    lastSyncAt: connection.lastSyncAt,
    lastErrorCode: connection.lastErrorCode,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}
