import type { PlatformRateLimitAction, PlatformRateLimitPort } from "@gmvgang/platform-api";

type FixedWindowEntry = {
  count: number;
  resetAt: number;
};

type FixedWindowOptions = {
  limit: number;
  windowMs: number;
};

export type FixedWindowRateLimiter = {
  consume(key: string, nowMs?: number): boolean;
};

export function createFixedWindowRateLimiter(options: FixedWindowOptions): FixedWindowRateLimiter {
  if (!Number.isInteger(options.limit) || options.limit < 1) throw new Error("RATE_LIMIT_INVALID_LIMIT");
  if (!Number.isFinite(options.windowMs) || options.windowMs < 1) throw new Error("RATE_LIMIT_INVALID_WINDOW");

  const entries = new Map<string, FixedWindowEntry>();

  return {
    consume(key, nowMs = Date.now()) {
      const subject = key.trim();
      if (!subject) return false;

      const current = entries.get(subject);
      if (!current || current.resetAt <= nowMs) {
        entries.set(subject, { count: 1, resetAt: nowMs + options.windowMs });
        return true;
      }

      if (current.count >= options.limit) return false;
      current.count += 1;
      return true;
    },
  };
}

const MUTATION_RULES: Record<PlatformRateLimitAction, FixedWindowOptions> = {
  creator_registration: { limit: 5, windowMs: 10 * 60 * 1000 },
  creator_profile_completion: { limit: 20, windowMs: 10 * 60 * 1000 },
};

export function createPlatformMutationRateLimitPort(): PlatformRateLimitPort {
  const limiters: Record<PlatformRateLimitAction, FixedWindowRateLimiter> = {
    creator_registration: createFixedWindowRateLimiter(MUTATION_RULES.creator_registration),
    creator_profile_completion: createFixedWindowRateLimiter(MUTATION_RULES.creator_profile_completion),
  };

  return {
    consume(input) {
      const nowMs = Date.parse(input.now);
      if (!Number.isFinite(nowMs)) return false;
      return limiters[input.action].consume(input.subject, nowMs);
    },
  };
}
