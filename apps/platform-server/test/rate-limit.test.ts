import { describe, expect, it } from "vitest";

import { createFixedWindowRateLimiter, createPlatformMutationRateLimitPort } from "../src/rate-limit.js";

describe("fixed window rate limiter", () => {
  it("allows up to the configured limit and resets after the window", () => {
    const limiter = createFixedWindowRateLimiter({ limit: 2, windowMs: 1_000 });

    expect(limiter.consume("creator-1", 0)).toBe(true);
    expect(limiter.consume("creator-1", 100)).toBe(true);
    expect(limiter.consume("creator-1", 200)).toBe(false);
    expect(limiter.consume("creator-1", 1_000)).toBe(true);
  });

  it("keeps subjects isolated", () => {
    const limiter = createFixedWindowRateLimiter({ limit: 1, windowMs: 1_000 });

    expect(limiter.consume("creator-1", 0)).toBe(true);
    expect(limiter.consume("creator-1", 1)).toBe(false);
    expect(limiter.consume("creator-2", 1)).toBe(true);
  });
});

describe("platform mutation rate limiter", () => {
  it("blocks the sixth Creator registration within ten minutes", async () => {
    const limiter = createPlatformMutationRateLimitPort();
    const base = Date.parse("2026-09-16T14:00:00.000Z");

    for (let index = 0; index < 5; index += 1) {
      await expect(limiter.consume({
        action: "creator_registration",
        subject: "creator-user-1",
        now: new Date(base + index * 1_000).toISOString(),
      })).resolves.toBe(true);
    }

    await expect(limiter.consume({
      action: "creator_registration",
      subject: "creator-user-1",
      now: new Date(base + 5_000).toISOString(),
    })).resolves.toBe(false);
  });
});
