import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  TikTokVideoAttributionLookup,
  TikTokVideoAttributionResolution,
  TikTokVideoAttributionResolver
} from "@gmvgang/affiliate-performance";

export const TIKTOK_CREATOR_IDENTITY_TABLE = "tiktok_creator_identity_links";
export const TIKTOK_VIDEO_IDENTITY_TABLE = "tiktok_video_identity_links";

export type TikTokAttributionLinkStatus = "active" | "revoked";

export interface TikTokAttributionHasher {
  digest(kind: "creator_open_id" | "video_id", rawValue: string): string;
}

export interface TikTokCreatorIdentityLink {
  id: string;
  organizationId: string;
  connectionId: string;
  shopId: string;
  creatorOpenIdDigest: string;
  creatorId: string;
  status: TikTokAttributionLinkStatus;
  linkedAt: string;
  revokedAt?: string;
}

export interface TikTokVideoIdentityLink {
  id: string;
  organizationId: string;
  connectionId: string;
  shopId: string;
  videoIdDigest: string;
  creatorIdentityLinkId: string;
  contentId: string;
  campaignId?: string;
  productId?: string;
  status: TikTokAttributionLinkStatus;
  linkedAt: string;
  revokedAt?: string;
}

export interface TikTokAttributionPersistenceDriver {
  findActiveCreator(input: {
    organizationId: string;
    connectionId: string;
    shopId: string;
    creatorOpenIdDigest: string;
  }): Promise<TikTokCreatorIdentityLink | null>;
  findActiveVideo(input: {
    organizationId: string;
    connectionId: string;
    shopId: string;
    videoIdDigest: string;
  }): Promise<TikTokVideoIdentityLink | null>;
  findActiveVideoByContentId(input: {
    organizationId: string;
    contentId: string;
  }): Promise<TikTokVideoIdentityLink | null>;
  insertCreator(link: TikTokCreatorIdentityLink): Promise<"inserted" | "unique_conflict">;
  insertVideo(link: TikTokVideoIdentityLink): Promise<"inserted" | "unique_conflict">;
}

export interface TikTokCreatorIdentityRegistrationInput {
  id: string;
  organizationId: string;
  connectionId: string;
  shopId: string;
  creatorOpenId: string;
  creatorId: string;
  linkedAt: string;
}

export interface TikTokVideoIdentityRegistrationInput {
  id: string;
  organizationId: string;
  connectionId: string;
  shopId: string;
  videoId: string;
  creatorOpenId: string;
  contentId: string;
  campaignId?: string;
  productId?: string;
  linkedAt: string;
}

export interface TikTokAttributionRegistry {
  registerCreator(input: TikTokCreatorIdentityRegistrationInput): Promise<"inserted" | "duplicate">;
  registerVideo(input: TikTokVideoIdentityRegistrationInput): Promise<"inserted" | "duplicate">;
}

function requireText(value: string | undefined, code: string): string {
  const cleaned = value?.trim();
  if (!cleaned) throw new Error(code);
  return cleaned;
}

function requireTimestamp(value: string, code: string): string {
  const cleaned = requireText(value, code);
  if (Number.isNaN(Date.parse(cleaned))) throw new Error(code);
  return cleaned;
}

function requireDigest(value: string, code: string): string {
  const cleaned = requireText(value, code);
  if (!/^[a-f0-9]{64}$/.test(cleaned)) throw new Error(code);
  return cleaned;
}

function optionalText(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned || undefined;
}

export function createHmacTikTokAttributionHasher(secretKey: string): TikTokAttributionHasher {
  const key = requireText(secretKey, "TIKTOK_ATTRIBUTION_HASH_KEY_REQUIRED");
  if (Buffer.byteLength(key, "utf8") < 32) throw new Error("TIKTOK_ATTRIBUTION_HASH_KEY_TOO_SHORT");

  return {
    digest(kind, rawValue) {
      const raw = requireText(rawValue, `TIKTOK_${kind.toUpperCase()}_REQUIRED`);
      return createHmac("sha256", key)
        .update(`gmvgang:tiktok-attribution:v1:${kind}\0${raw}`, "utf8")
        .digest("hex");
    }
  };
}

function sameCreatorLink(a: TikTokCreatorIdentityLink, b: TikTokCreatorIdentityLink): boolean {
  return a.organizationId === b.organizationId
    && a.connectionId === b.connectionId
    && a.shopId === b.shopId
    && a.creatorOpenIdDigest === b.creatorOpenIdDigest
    && a.creatorId === b.creatorId
    && a.status === "active";
}

function sameVideoLink(a: TikTokVideoIdentityLink, b: TikTokVideoIdentityLink): boolean {
  return a.organizationId === b.organizationId
    && a.connectionId === b.connectionId
    && a.shopId === b.shopId
    && a.videoIdDigest === b.videoIdDigest
    && a.creatorIdentityLinkId === b.creatorIdentityLinkId
    && a.contentId === b.contentId
    && (a.campaignId ?? "") === (b.campaignId ?? "")
    && (a.productId ?? "") === (b.productId ?? "")
    && a.status === "active";
}

export function createTikTokAttributionRegistry(
  driver: TikTokAttributionPersistenceDriver,
  hasher: TikTokAttributionHasher
): TikTokAttributionRegistry {
  return {
    async registerCreator(input) {
      const link: TikTokCreatorIdentityLink = {
        id: requireText(input.id, "TIKTOK_CREATOR_LINK_ID_REQUIRED"),
        organizationId: requireText(input.organizationId, "TIKTOK_ATTRIBUTION_ORGANIZATION_REQUIRED"),
        connectionId: requireText(input.connectionId, "TIKTOK_ATTRIBUTION_CONNECTION_REQUIRED"),
        shopId: requireText(input.shopId, "TIKTOK_ATTRIBUTION_SHOP_REQUIRED"),
        creatorOpenIdDigest: requireDigest(
          hasher.digest("creator_open_id", input.creatorOpenId),
          "TIKTOK_CREATOR_OPEN_ID_DIGEST_INVALID"
        ),
        creatorId: requireText(input.creatorId, "TIKTOK_INTERNAL_CREATOR_ID_REQUIRED"),
        status: "active",
        linkedAt: requireTimestamp(input.linkedAt, "TIKTOK_ATTRIBUTION_LINKED_AT_INVALID")
      };

      const result = await driver.insertCreator(link);
      if (result === "inserted") return "inserted";

      const existing = await driver.findActiveCreator({
        organizationId: link.organizationId,
        connectionId: link.connectionId,
        shopId: link.shopId,
        creatorOpenIdDigest: link.creatorOpenIdDigest
      });
      if (existing && sameCreatorLink(existing, link)) return "duplicate";
      throw new Error("TIKTOK_CREATOR_ATTRIBUTION_CONFLICT");
    },

    async registerVideo(input) {
      const organizationId = requireText(input.organizationId, "TIKTOK_ATTRIBUTION_ORGANIZATION_REQUIRED");
      const connectionId = requireText(input.connectionId, "TIKTOK_ATTRIBUTION_CONNECTION_REQUIRED");
      const shopId = requireText(input.shopId, "TIKTOK_ATTRIBUTION_SHOP_REQUIRED");
      const creatorOpenIdDigest = requireDigest(
        hasher.digest("creator_open_id", input.creatorOpenId),
        "TIKTOK_CREATOR_OPEN_ID_DIGEST_INVALID"
      );
      const creator = await driver.findActiveCreator({
        organizationId,
        connectionId,
        shopId,
        creatorOpenIdDigest
      });
      if (!creator) throw new Error("TIKTOK_VIDEO_CREATOR_LINK_MISSING");

      const link: TikTokVideoIdentityLink = {
        id: requireText(input.id, "TIKTOK_VIDEO_LINK_ID_REQUIRED"),
        organizationId,
        connectionId,
        shopId,
        videoIdDigest: requireDigest(
          hasher.digest("video_id", input.videoId),
          "TIKTOK_VIDEO_ID_DIGEST_INVALID"
        ),
        creatorIdentityLinkId: creator.id,
        contentId: requireText(input.contentId, "TIKTOK_INTERNAL_CONTENT_ID_REQUIRED"),
        ...(optionalText(input.campaignId) ? { campaignId: optionalText(input.campaignId)! } : {}),
        ...(optionalText(input.productId) ? { productId: optionalText(input.productId)! } : {}),
        status: "active",
        linkedAt: requireTimestamp(input.linkedAt, "TIKTOK_ATTRIBUTION_LINKED_AT_INVALID")
      };

      const result = await driver.insertVideo(link);
      if (result === "inserted") return "inserted";

      const existingByVideo = await driver.findActiveVideo({
        organizationId,
        connectionId,
        shopId,
        videoIdDigest: link.videoIdDigest
      });
      if (existingByVideo && sameVideoLink(existingByVideo, link)) return "duplicate";

      const existingByContent = await driver.findActiveVideoByContentId({ organizationId, contentId: link.contentId });
      if (existingByContent && sameVideoLink(existingByContent, link)) return "duplicate";
      throw new Error("TIKTOK_VIDEO_ATTRIBUTION_CONFLICT");
    }
  };
}

export function createTikTokVideoAttributionResolver(
  driver: TikTokAttributionPersistenceDriver,
  hasher: TikTokAttributionHasher
): TikTokVideoAttributionResolver {
  return {
    async resolve(input: TikTokVideoAttributionLookup): Promise<TikTokVideoAttributionResolution | null> {
      const organizationId = requireText(input.organizationId, "TIKTOK_ATTRIBUTION_ORGANIZATION_REQUIRED");
      const connectionId = requireText(input.connectionId, "TIKTOK_ATTRIBUTION_CONNECTION_REQUIRED");
      const shopId = requireText(input.shopId, "TIKTOK_ATTRIBUTION_SHOP_REQUIRED");
      const creatorOpenIdDigest = requireDigest(
        hasher.digest("creator_open_id", input.creatorOpenId),
        "TIKTOK_CREATOR_OPEN_ID_DIGEST_INVALID"
      );
      const videoIdDigest = requireDigest(
        hasher.digest("video_id", input.videoId),
        "TIKTOK_VIDEO_ID_DIGEST_INVALID"
      );

      const creator = await driver.findActiveCreator({
        organizationId,
        connectionId,
        shopId,
        creatorOpenIdDigest
      });
      if (!creator) return null;

      const video = await driver.findActiveVideo({
        organizationId,
        connectionId,
        shopId,
        videoIdDigest
      });
      if (!video || video.creatorIdentityLinkId !== creator.id) return null;

      return {
        creatorId: requireText(creator.creatorId, "TIKTOK_INTERNAL_CREATOR_ID_REQUIRED"),
        contentId: requireText(video.contentId, "TIKTOK_INTERNAL_CONTENT_ID_REQUIRED"),
        ...(video.campaignId ? { campaignId: video.campaignId } : {}),
        ...(video.productId ? { productId: video.productId } : {})
      };
    }
  };
}

function ensureNoError(error: { code?: string; message?: string } | null, code: string): void {
  if (error) throw new Error(`${code}:${error.code ?? "unknown"}`);
}

function requiredRowString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`TIKTOK_ATTRIBUTION_ROW_INVALID:${key}`);
  return value;
}

function optionalRowString(row: Record<string, unknown>, key: string): string | undefined {
  const value = row[key];
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`TIKTOK_ATTRIBUTION_ROW_INVALID:${key}`);
  return value;
}

function creatorFromRow(row: Record<string, unknown>): TikTokCreatorIdentityLink {
  const status = requiredRowString(row, "status");
  if (status !== "active" && status !== "revoked") throw new Error("TIKTOK_ATTRIBUTION_ROW_INVALID:status");
  return {
    id: requiredRowString(row, "id"),
    organizationId: requiredRowString(row, "organization_id"),
    connectionId: requiredRowString(row, "connection_id"),
    shopId: requiredRowString(row, "shop_id"),
    creatorOpenIdDigest: requireDigest(requiredRowString(row, "creator_open_id_digest"), "TIKTOK_ATTRIBUTION_ROW_INVALID:creator_open_id_digest"),
    creatorId: requiredRowString(row, "creator_id"),
    status,
    linkedAt: requiredRowString(row, "linked_at"),
    ...(optionalRowString(row, "revoked_at") ? { revokedAt: optionalRowString(row, "revoked_at")! } : {})
  };
}

function videoFromRow(row: Record<string, unknown>): TikTokVideoIdentityLink {
  const status = requiredRowString(row, "status");
  if (status !== "active" && status !== "revoked") throw new Error("TIKTOK_ATTRIBUTION_ROW_INVALID:status");
  return {
    id: requiredRowString(row, "id"),
    organizationId: requiredRowString(row, "organization_id"),
    connectionId: requiredRowString(row, "connection_id"),
    shopId: requiredRowString(row, "shop_id"),
    videoIdDigest: requireDigest(requiredRowString(row, "video_id_digest"), "TIKTOK_ATTRIBUTION_ROW_INVALID:video_id_digest"),
    creatorIdentityLinkId: requiredRowString(row, "creator_identity_link_id"),
    contentId: requiredRowString(row, "content_id"),
    ...(optionalRowString(row, "campaign_id") ? { campaignId: optionalRowString(row, "campaign_id")! } : {}),
    ...(optionalRowString(row, "product_id") ? { productId: optionalRowString(row, "product_id")! } : {}),
    status,
    linkedAt: requiredRowString(row, "linked_at"),
    ...(optionalRowString(row, "revoked_at") ? { revokedAt: optionalRowString(row, "revoked_at")! } : {})
  };
}

const CREATOR_SELECT = "id,organization_id,connection_id,shop_id,creator_open_id_digest,creator_id,status,linked_at,revoked_at";
const VIDEO_SELECT = "id,organization_id,connection_id,shop_id,video_id_digest,creator_identity_link_id,content_id,campaign_id,product_id,status,linked_at,revoked_at";

export function createSupabaseTikTokAttributionDriver(client: SupabaseClient): TikTokAttributionPersistenceDriver {
  return {
    async findActiveCreator(input) {
      const { data, error } = await client
        .from(TIKTOK_CREATOR_IDENTITY_TABLE)
        .select(CREATOR_SELECT)
        .eq("organization_id", input.organizationId)
        .eq("connection_id", input.connectionId)
        .eq("shop_id", input.shopId)
        .eq("creator_open_id_digest", input.creatorOpenIdDigest)
        .eq("status", "active")
        .maybeSingle();
      ensureNoError(error, "TIKTOK_CREATOR_ATTRIBUTION_QUERY_FAILED");
      return data ? creatorFromRow(data as unknown as Record<string, unknown>) : null;
    },

    async findActiveVideo(input) {
      const { data, error } = await client
        .from(TIKTOK_VIDEO_IDENTITY_TABLE)
        .select(VIDEO_SELECT)
        .eq("organization_id", input.organizationId)
        .eq("connection_id", input.connectionId)
        .eq("shop_id", input.shopId)
        .eq("video_id_digest", input.videoIdDigest)
        .eq("status", "active")
        .maybeSingle();
      ensureNoError(error, "TIKTOK_VIDEO_ATTRIBUTION_QUERY_FAILED");
      return data ? videoFromRow(data as unknown as Record<string, unknown>) : null;
    },

    async findActiveVideoByContentId(input) {
      const { data, error } = await client
        .from(TIKTOK_VIDEO_IDENTITY_TABLE)
        .select(VIDEO_SELECT)
        .eq("organization_id", input.organizationId)
        .eq("content_id", input.contentId)
        .eq("status", "active")
        .maybeSingle();
      ensureNoError(error, "TIKTOK_VIDEO_CONTENT_ATTRIBUTION_QUERY_FAILED");
      return data ? videoFromRow(data as unknown as Record<string, unknown>) : null;
    },

    async insertCreator(link) {
      const { error } = await client.from(TIKTOK_CREATOR_IDENTITY_TABLE).insert({
        id: link.id,
        organization_id: link.organizationId,
        connection_id: link.connectionId,
        shop_id: link.shopId,
        creator_open_id_digest: link.creatorOpenIdDigest,
        creator_id: link.creatorId,
        status: link.status,
        linked_at: link.linkedAt,
        revoked_at: link.revokedAt ?? null
      });
      if (!error) return "inserted";
      if (error.code === "23505") return "unique_conflict";
      throw new Error(`TIKTOK_CREATOR_ATTRIBUTION_INSERT_FAILED:${error.code ?? "unknown"}`);
    },

    async insertVideo(link) {
      const { error } = await client.from(TIKTOK_VIDEO_IDENTITY_TABLE).insert({
        id: link.id,
        organization_id: link.organizationId,
        connection_id: link.connectionId,
        shop_id: link.shopId,
        video_id_digest: link.videoIdDigest,
        creator_identity_link_id: link.creatorIdentityLinkId,
        content_id: link.contentId,
        campaign_id: link.campaignId ?? null,
        product_id: link.productId ?? null,
        status: link.status,
        linked_at: link.linkedAt,
        revoked_at: link.revokedAt ?? null
      });
      if (!error) return "inserted";
      if (error.code === "23505") return "unique_conflict";
      throw new Error(`TIKTOK_VIDEO_ATTRIBUTION_INSERT_FAILED:${error.code ?? "unknown"}`);
    }
  };
}
