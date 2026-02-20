/**
 * Rate Limiting Utility
 * 
 * Provides in-memory rate limiting for API endpoints.
 * For production with multiple instances, consider using Redis.
 */

import { prisma } from '@/lib/prisma';

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimitEntry {
  count: number;
  resetAt: number;
  blocked: boolean;
  blockedUntil?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // seconds until block expires
  reason?: string;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDurationMs: number;
  keyPrefix?: string;
}

// ============================================================================
// IN-MEMORY STORE (for single instance)
// ============================================================================

// For production with multiple instances, use Redis
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now && (!entry.blockedUntil || entry.blockedUntil < now)) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

// ============================================================================
// RATE LIMITER CLASS
// ============================================================================

export class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a key is rate limited
   */
  check(key: string): RateLimitResult {
    const fullKey = `${this.config.keyPrefix || 'rl'}:${key}`;
    const now = Date.now();
    const entry = rateLimitStore.get(fullKey);

    // Check if currently blocked
    if (entry?.blocked && entry.blockedUntil && entry.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(entry.blockedUntil),
        retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
        reason: 'Rate limit exceeded. Please try again later.',
      };
    }

    // Check if window has expired
    if (!entry || entry.resetAt < now) {
      // Start new window
      rateLimitStore.set(fullKey, {
        count: 1,
        resetAt: now + this.config.windowMs,
        blocked: false,
      });

      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetAt: new Date(now + this.config.windowMs),
      };
    }

    // Check if limit exceeded
    if (entry.count >= this.config.maxRequests) {
      // Block the user
      const blockedUntil = now + this.config.blockDurationMs;
      rateLimitStore.set(fullKey, {
        ...entry,
        blocked: true,
        blockedUntil,
      });

      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(blockedUntil),
        retryAfter: Math.ceil(this.config.blockDurationMs / 1000),
        reason: 'Rate limit exceeded. Please try again later.',
      };
    }

    // Increment count
    rateLimitStore.set(fullKey, {
      ...entry,
      count: entry.count + 1,
    });

    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count - 1,
      resetAt: new Date(entry.resetAt),
    };
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    const fullKey = `${this.config.keyPrefix || 'rl'}:${key}`;
    rateLimitStore.delete(fullKey);
  }

  /**
   * Get current status without incrementing
   */
  status(key: string): { count: number; remaining: number; resetAt: Date } {
    const fullKey = `${this.config.keyPrefix || 'rl'}:${key}`;
    const now = Date.now();
    const entry = rateLimitStore.get(fullKey);

    if (!entry || entry.resetAt < now) {
      return {
        count: 0,
        remaining: this.config.maxRequests,
        resetAt: new Date(now + this.config.windowMs),
      };
    }

    return {
      count: entry.count,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetAt: new Date(entry.resetAt),
    };
  }
}

// ============================================================================
// PRE-CONFIGURED RATE LIMITERS
// ============================================================================

import {
  MESSAGE_RATE_LIMITS,
  POST_RATE_LIMITS,
  COMMENT_RATE_LIMITS,
} from '@/lib/config/messaging';

/**
 * Rate limiter for sending messages
 */
export const messageRateLimiter = new RateLimiter({
  maxRequests: MESSAGE_RATE_LIMITS.maxMessages,
  windowMs: MESSAGE_RATE_LIMITS.windowMs,
  blockDurationMs: MESSAGE_RATE_LIMITS.blockDurationMs,
  keyPrefix: 'msg',
});

/**
 * Rate limiter for creating posts
 */
export const postRateLimiter = new RateLimiter({
  maxRequests: POST_RATE_LIMITS.maxMessages,
  windowMs: POST_RATE_LIMITS.windowMs,
  blockDurationMs: POST_RATE_LIMITS.blockDurationMs,
  keyPrefix: 'post',
});

/**
 * Rate limiter for creating comments
 */
export const commentRateLimiter = new RateLimiter({
  maxRequests: COMMENT_RATE_LIMITS.maxMessages,
  windowMs: COMMENT_RATE_LIMITS.windowMs,
  blockDurationMs: COMMENT_RATE_LIMITS.blockDurationMs,
  keyPrefix: 'comment',
});

// ============================================================================
// DATABASE-BACKED RATE LIMITING (for persistent tracking)
// ============================================================================

/**
 * Check rate limit using database for persistence
 * This is more reliable but slower than in-memory
 */
export async function checkDatabaseRateLimit(
  userId: string,
  action: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  try {
    // Count actions in the time window
    const count = await prisma.auditLog.count({
      where: {
        userId,
        actionType: action,
        createdAt: {
          gte: windowStart,
        },
      },
    });

    const remaining = Math.max(0, maxRequests - count);
    const resetAt = new Date(now.getTime() + windowMs);

    if (count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil(windowMs / 1000),
        reason: 'Rate limit exceeded. Please try again later.',
      };
    }

    return {
      allowed: true,
      remaining,
      resetAt,
    };
  } catch (error) {
    console.error('Error checking database rate limit:', error);
    // Fail open - allow the request if we can't check the rate limit
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt: new Date(now.getTime() + windowMs),
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a rate limit key for a user and action
 */
export function createRateLimitKey(userId: string, action?: string): string {
  return action ? `${userId}:${action}` : userId;
}

/**
 * Create a rate limit key for an IP address
 */
export function createIpRateLimitKey(ip: string, action?: string): string {
  return action ? `ip:${ip}:${action}` : `ip:${ip}`;
}

/**
 * Combined rate limiter that checks both in-memory and database
 */
export async function combinedRateLimit(
  userId: string,
  limiter: RateLimiter,
  action: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  // Check in-memory first (fast)
  const memoryResult = limiter.check(userId);
  if (!memoryResult.allowed) {
    return memoryResult;
  }

  // Then check database (persistent)
  const dbResult = await checkDatabaseRateLimit(userId, action, maxRequests, windowMs);
  
  // Return the more restrictive result
  if (!dbResult.allowed) {
    return dbResult;
  }

  return {
    allowed: true,
    remaining: Math.min(memoryResult.remaining, dbResult.remaining),
    resetAt: memoryResult.resetAt < dbResult.resetAt ? memoryResult.resetAt : dbResult.resetAt,
  };
}
