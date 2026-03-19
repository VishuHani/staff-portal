/**
 * Public Endpoint Rate Limiting Utility
 *
 * Baseline protection for externally reachable endpoints such as uploads,
 * webhooks, and cron handlers.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/config";

type SlidingWindowDuration = Parameters<typeof Ratelimit.slidingWindow>[1];

export interface PublicRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
  reason?: string;
}

export interface PublicRateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDurationMs: number;
  keyPrefix: string;
}

class InMemoryPublicRateLimiter {
  private cache = new Map<string, { count: number; resetAt: number; blockedUntil?: number }>();

  check(
    key: string,
    config: PublicRateLimitConfig
  ): PublicRateLimitResult {
    const now = Date.now();
    const current = this.cache.get(key);

    if (current?.blockedUntil && current.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(current.blockedUntil),
        retryAfter: Math.ceil((current.blockedUntil - now) / 1000),
        reason: "Rate limit exceeded. Please try again later.",
      };
    }

    if (!current || current.resetAt <= now) {
      const resetAt = now + config.windowMs;
      this.cache.set(key, { count: 1, resetAt });

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: new Date(resetAt),
      };
    }

    if (current.count >= config.maxRequests) {
      const blockedUntil = now + config.blockDurationMs;
      this.cache.set(key, {
        ...current,
        blockedUntil,
      });

      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(blockedUntil),
        retryAfter: Math.ceil(config.blockDurationMs / 1000),
        reason: "Rate limit exceeded. Please try again later.",
      };
    }

    const nextCount = current.count + 1;
    this.cache.set(key, {
      ...current,
      count: nextCount,
    });

    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - nextCount),
      resetAt: new Date(current.resetAt),
    };
  }

  reset(key: string): void {
    this.cache.delete(key);
  }
}

function formatWindow(windowMs: number): string {
  if (windowMs % 60000 === 0) {
    return `${windowMs / 60000} m`;
  }

  if (windowMs % 1000 === 0) {
    return `${windowMs / 1000} s`;
  }

  return `${windowMs} ms`;
}

function createLimiter(
  config: PublicRateLimitConfig
): {
  check: (identifier: string) => Promise<PublicRateLimitResult>;
  reset: (identifier: string) => void;
} {
  const hasUpstashConfig = !!(env.rateLimit.redisUrl && env.rateLimit.redisToken);
  const inMemory = new InMemoryPublicRateLimiter();

  let limiter: Ratelimit | null = null;

  if (hasUpstashConfig) {
    const redis = new Redis({
      url: env.rateLimit.redisUrl,
      token: env.rateLimit.redisToken,
    });

    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        config.maxRequests,
        formatWindow(config.windowMs) as SlidingWindowDuration
      ),
      analytics: true,
      prefix: "@upstash/ratelimit",
    });
  }

  return {
    async check(identifier: string) {
      const key = `${config.keyPrefix}:${identifier}`;

      if (limiter) {
        const result = await limiter.limit(key);
        return {
          allowed: result.success,
          remaining: result.remaining,
          resetAt: new Date(result.reset),
          retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
          reason: result.success ? undefined : "Rate limit exceeded. Please try again later.",
        };
      }

      return inMemory.check(key, config);
    },
    reset(identifier: string) {
      inMemory.reset(`${config.keyPrefix}:${identifier}`);
    },
  };
}

export function createPublicRateLimiter(config: PublicRateLimitConfig) {
  return createLimiter(config);
}

export const documentUploadRateLimiter = createPublicRateLimiter({
  keyPrefix: "documents:upload",
  maxRequests: 20,
  windowMs: 60_000,
  blockDurationMs: 5 * 60_000,
});

export const emailWebhookRateLimiter = createPublicRateLimiter({
  keyPrefix: "email:webhook",
  maxRequests: 120,
  windowMs: 60_000,
  blockDurationMs: 10 * 60_000,
});

export const cronJobsRateLimiter = createPublicRateLimiter({
  keyPrefix: "cron:jobs",
  maxRequests: 10,
  windowMs: 60_000,
  blockDurationMs: 5 * 60_000,
});
