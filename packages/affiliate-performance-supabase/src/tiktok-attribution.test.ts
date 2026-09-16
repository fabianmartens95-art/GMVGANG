import { describe, expect, it } from "vitest";
import {
  createHmacTikTokAttributionHasher,
  createTikTokAttributionRegistry,
  createTikTokVideoAttributionResolver,
  type TikTokAttributionPersistenceDriver,
  type TikTokCreatorIdentityLink,
  type TikTokVideoIdentityLink
} from "./tiktok-attribution.js";

class MemoryDriver implements TikTokAttributionPersistenceDriver {
  readonly creators: TikTokCreatorIdentityLink[] = [];
  readonly videos: TikTokVideoIdentityLink[] = [];

  async findActiveCreator(input: {
    organizationId: string;
    connectionId: string;
    shopId: string;
    creatorOpenIdDigest: string;
  }) {
    return this.creators.find((link) => link.status === "active"
      && link.organizationId === input.organizationId
      && link.connectionId === input.connectionId
      && link.shopId === input.shopId
      && link.creatorOpenIdDigest === input.creatorOpenIdDigest) ?? null;
  }

  async findActiveVideo(input: {
    organizationId: string;
    connectionId: string;
    shopId: string;
    videoIdDigest: string;
  }) {
    return this.videos.find((link) => link.status === "active"
      && link.organizationId === input.organizationId
      && link.connectionId === input.connectionId
      && link.shopId === input.shopId
      && link.videoIdDigest === input.videoIdDigest) ?? null;
  }

  async findActiveVideoByContentId(input: { organizationId: string; contentId: string }) {
    return this.videos.find((link) => link.status === "active"
      && link.organizationId === input.organizationId
      && link.contentId === input.contentId) ?? null;
  }

  async insertCreator(link: TikTokCreatorIdentityLink) {
    const duplicateExternal = await this.findActiveCreator({
      organizationId: link.organizationId,
      connectionId: link.connectionId,
      shopId: link.shopId,
      creatorOpenIdDigest: link.creatorOpenIdDigest
    });
    const duplicateInternal = this.creators.find((existing) => existing.status === "active"
      && existing.organizationId === link.organizationId
      && existing.connectionId === link.connectionId
      && existing.shopId === link.shopId
      && existing.creatorId === link.creatorId);
    if (duplicateExternal || duplicateInternal) return "unique_conflict" as const;
    this.creators.push({ ...link });
    return "inserted" as const;
  }

  async insertVideo(link: TikTokVideoIdentityLink) {
    const duplicateExternal = await this.findActiveVideo({
      organizationId: link.organizationId,
      connectionId: link.connectionId,
      shopId: link.shopId,
      videoIdDigest: link.videoIdDigest
    });
    const duplicateContent = await this.findActiveVideoByContentId({
      organizationId: link.organizationId,
      contentId: link.contentId
    });
    if (duplicateExternal || duplicateContent) return "unique_conflict" as const;
    this.videos.push({ ...link });
    return "inserted" as const;
  }
}

const HASH_KEY = "0123456789abcdef0123456789abcdef";

function creatorInput(overrides: Partial<Parameters<ReturnType<typeof createTikTokAttributionRegistry>["registerCreator"]>[0]> = {}) {
  return {
    id: "creator-link-1",
    organizationId: "org-1",
    connectionId: "conn-1",
    shopId: "shop-1",
    creatorOpenId: "raw-open-id-sensitive",
    creatorId: "creator-master-1",
    linkedAt: "2026-09-16T14:00:00.000Z",
    ...overrides
  };
}

function videoInput(overrides: Partial<Parameters<ReturnType<typeof createTikTokAttributionRegistry>["registerVideo"]>[0]> = {}) {
  return {
    id: "video-link-1",
    organizationId: "org-1",
    connectionId: "conn-1",
    shopId: "shop-1",
    videoId: "raw-video-id-sensitive",
    creatorOpenId: "raw-open-id-sensitive",
    contentId: "content-master-1",
    campaignId: "campaign-1",
    productId: "product-1",
    linkedAt: "2026-09-16T14:01:00.000Z",
    ...overrides
  };
}

describe("TikTok attribution HMAC privacy boundary", () => {
  it("creates deterministic domain-separated digests without preserving raw provider ids", () => {
    const hasher = createHmacTikTokAttributionHasher(HASH_KEY);
    const creatorDigest = hasher.digest("creator_open_id", "raw-id-1");
    const videoDigest = hasher.digest("video_id", "raw-id-1");

    expect(creatorDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(videoDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(creatorDigest).not.toBe(videoDigest);
    expect(creatorDigest).not.toContain("raw-id-1");
    expect(hasher.digest("creator_open_id", "raw-id-1")).toBe(creatorDigest);
  });

  it("rejects a short or missing dedicated hash key", () => {
    expect(() => createHmacTikTokAttributionHasher("short")).toThrow("TIKTOK_ATTRIBUTION_HASH_KEY_TOO_SHORT");
    expect(() => createHmacTikTokAttributionHasher(" ")).toThrow("TIKTOK_ATTRIBUTION_HASH_KEY_REQUIRED");
  });
});

describe("TikTok attribution registry", () => {
  it("registers creator and video links idempotently while storing digests only", async () => {
    const driver = new MemoryDriver();
    const hasher = createHmacTikTokAttributionHasher(HASH_KEY);
    const registry = createTikTokAttributionRegistry(driver, hasher);

    expect(await registry.registerCreator(creatorInput())).toBe("inserted");
    expect(await registry.registerCreator(creatorInput({ id: "creator-link-retry" }))).toBe("duplicate");
    expect(await registry.registerVideo(videoInput())).toBe("inserted");
    expect(await registry.registerVideo(videoInput({ id: "video-link-retry" }))).toBe("duplicate");

    expect(driver.creators).toHaveLength(1);
    expect(driver.videos).toHaveLength(1);
    const serialized = JSON.stringify({ creators: driver.creators, videos: driver.videos });
    expect(serialized).not.toContain("raw-open-id-sensitive");
    expect(serialized).not.toContain("raw-video-id-sensitive");
  });

  it("fails closed when the same external creator identity is remapped to another internal creator", async () => {
    const driver = new MemoryDriver();
    const registry = createTikTokAttributionRegistry(driver, createHmacTikTokAttributionHasher(HASH_KEY));
    await registry.registerCreator(creatorInput());

    await expect(registry.registerCreator(creatorInput({
      id: "creator-link-conflict",
      creatorId: "creator-master-2"
    }))).rejects.toThrow("TIKTOK_CREATOR_ATTRIBUTION_CONFLICT");
  });

  it("requires an existing protected creator link before video registration", async () => {
    const driver = new MemoryDriver();
    const registry = createTikTokAttributionRegistry(driver, createHmacTikTokAttributionHasher(HASH_KEY));

    await expect(registry.registerVideo(videoInput())).rejects.toThrow("TIKTOK_VIDEO_CREATOR_LINK_MISSING");
  });

  it("blocks remapping an external video or reusing an internal content id", async () => {
    const driver = new MemoryDriver();
    const registry = createTikTokAttributionRegistry(driver, createHmacTikTokAttributionHasher(HASH_KEY));
    await registry.registerCreator(creatorInput());
    await registry.registerVideo(videoInput());

    await expect(registry.registerVideo(videoInput({
      id: "video-link-conflict",
      contentId: "content-master-2"
    }))).rejects.toThrow("TIKTOK_VIDEO_ATTRIBUTION_CONFLICT");

    await expect(registry.registerVideo(videoInput({
      id: "video-link-content-conflict",
      videoId: "different-video-id",
      contentId: "content-master-1"
    }))).rejects.toThrow("TIKTOK_VIDEO_ATTRIBUTION_CONFLICT");
  });
});

describe("TikTok attribution resolver", () => {
  it("resolves raw provider identifiers to internal creator/content references", async () => {
    const driver = new MemoryDriver();
    const hasher = createHmacTikTokAttributionHasher(HASH_KEY);
    const registry = createTikTokAttributionRegistry(driver, hasher);
    await registry.registerCreator(creatorInput());
    await registry.registerVideo(videoInput());
    const resolver = createTikTokVideoAttributionResolver(driver, hasher);

    await expect(resolver.resolve({
      organizationId: "org-1",
      connectionId: "conn-1",
      shopId: "shop-1",
      videoId: "raw-video-id-sensitive",
      creatorOpenId: "raw-open-id-sensitive",
      authorType: "AFFILIATE"
    })).resolves.toEqual({
      creatorId: "creator-master-1",
      contentId: "content-master-1",
      campaignId: "campaign-1",
      productId: "product-1"
    });
  });

  it("returns null across tenant/shop boundaries or when the creator/video pairing does not match", async () => {
    const driver = new MemoryDriver();
    const hasher = createHmacTikTokAttributionHasher(HASH_KEY);
    const registry = createTikTokAttributionRegistry(driver, hasher);
    await registry.registerCreator(creatorInput());
    await registry.registerVideo(videoInput());
    const resolver = createTikTokVideoAttributionResolver(driver, hasher);

    await expect(resolver.resolve({
      organizationId: "org-2",
      connectionId: "conn-1",
      shopId: "shop-1",
      videoId: "raw-video-id-sensitive",
      creatorOpenId: "raw-open-id-sensitive",
      authorType: "AFFILIATE"
    })).resolves.toBeNull();

    await expect(resolver.resolve({
      organizationId: "org-1",
      connectionId: "conn-1",
      shopId: "shop-1",
      videoId: "raw-video-id-sensitive",
      creatorOpenId: "different-creator-open-id",
      authorType: "AFFILIATE"
    })).resolves.toBeNull();
  });
});
