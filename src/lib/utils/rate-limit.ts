/**
 * Rate Limiting Utility
 *
 * Provides rate limiting for auth endpoints to prevent brute force attacks.
 *
 * Production: Uses Upstash Redis (requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN)
 * Development: Falls back to in-memory cache (resets on server restart)
 *
 * Usage:
 * ```ts
 * const { success, reset } = await rateLimit.login(identifier);
 * if (!success) {
 *   return { error: `Too many attempts. Try again in ${Math.ceil(reset / 1000)} seconds` };
 * }
 * ```
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env, constants } from "@/lib/config";

// In-memory store for development (resets on server restart)
class InMemoryRateLimiter {
  private cache: Map<string, { count: number; resetAt: number }> = new Map();

  async limit(
    identifier: string,
    limit: number,
    window: number
  ): Promise<{ success: boolean; reset: number; remaining: number }> {
    const now = Date.now();
    const key = identifier;

    // Get or create entry
    let entry = this.cache.get(key);

    // Reset if window expired
    if (!entry || now > entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + window,
      };
      this.cache.set(key, entry);
    }

    // Increment count
    entry.count++;

    // Check if limit exceeded
    const success = entry.count <= limit;
    const remaining = Math.max(0, limit - entry.count);
    const reset = entry.resetAt - now;

    return {
      success,
      reset,
      remaining,
    };
  }

  // Clean up expired entries (call periodically)
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.resetAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Create rate limiters based on environment
const hasUpstashConfig = !!(env.rateLimit.redisUrl && env.rateLimit.redisToken);

let redis: Redis | null = null;
let upstashRateLimiter: Ratelimit | null = null;
const inMemoryLimiter = new InMemoryRateLimiter();

// Cleanup in-memory cache every 5 minutes
if (!hasUpstashConfig) {
  setInterval(() => {
    inMemoryLimiter.cleanup();
  }, 5 * 60 * 1000);
}

if (hasUpstashConfig) {
  // Production: Use Upstash Redis
  redis = new Redis({
    url: env.rateLimit.redisUrl,
    token: env.rateLimit.redisToken,
  });

  // Sliding window rate limiter
  upstashRateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"), // Default: 10 requests per minute
    analytics: true,
    prefix: "@upstash/ratelimit",
  });

  console.log("✅ Rate limiting: Using Upstash Redis (Production)");
} else {
  console.log(
    "⚠️  Rate limiting: Using in-memory store (Development only - resets on server restart)"
  );
  console.log(
    "   For production, set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN"
  );
}

/**
 * Rate limit helper function
 */
async function rateLimitAction(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<{
  success: boolean;
  reset: number;
  remaining: number;
}> {
  if (upstashRateLimiter) {
    // Use Upstash (production)
    const result = await upstashRateLimiter.limit(identifier);
    return {
      success: result.success,
      reset: result.reset,
      remaining: result.remaining,
    };
  } else {
    // Use in-memory (development)
    return await inMemoryLimiter.limit(identifier, limit, windowMs);
  }
}

// Rate limiting configuration from centralized config
const { rateLimiting } = constants;

/**
 * Rate Limiters for Auth Endpoints
 *
 * Conservative limits to prevent brute force while allowing legitimate retries
 * Configuration sourced from @/lib/config
 */
export const rateLimit = {
  /**
   * Login rate limit: 5 attempts per 15 minutes per IP/email
   *
   * Prevents: Password brute force attacks
   * Allows: ~3 failed login attempts before temporary lockout
   */
  login: async (identifier: string) => {
    return rateLimitAction(
      `login:${identifier}`,
      rateLimiting.login.maxAttempts,
      rateLimiting.login.windowMinutes * 60 * 1000
    );
  },

  /**
   * Signup rate limit: 3 attempts per hour per IP
   *
   * Prevents: Account enumeration, spam signups
   * Allows: Legitimate users to retry if they make mistakes
   */
  signup: async (identifier: string) => {
    return rateLimitAction(
      `signup:${identifier}`,
      rateLimiting.signup.maxAttempts,
      rateLimiting.signup.windowMinutes * 60 * 1000
    );
  },

  /**
   * Password reset rate limit: 3 attempts per hour per IP/email
   *
   * Prevents: Email spam, account enumeration
   * Allows: Users to request reset if they don't receive email
   */
  resetPassword: async (identifier: string) => {
    return rateLimitAction(
      `reset:${identifier}`,
      rateLimiting.passwordReset.maxAttempts,
      rateLimiting.passwordReset.windowMinutes * 60 * 1000
    );
  },
};

/**
 * Get client IP address from request headers
 *
 * Checks multiple headers for proxy/CDN scenarios (Vercel, Cloudflare, etc.)
 */
export function getClientIp(headers: Headers): string {
  // Try multiple headers in order of reliability
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") || // Cloudflare
    headers.get("x-vercel-forwarded-for") || // Vercel
    "unknown";

  return ip;
}
