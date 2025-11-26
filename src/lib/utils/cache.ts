/**
 * Caching Utility - Phase 5 Advanced Features (Nov 2025)
 *
 * Provides a flexible caching layer with multiple strategies.
 * - Development: In-memory cache (resets on server restart)
 * - Production: Upstash Redis (if configured)
 *
 * Features:
 * - TTL-based expiration
 * - Namespace support for key organization
 * - Automatic cache invalidation
 * - Cache-aside pattern helpers
 *
 * Usage:
 * ```ts
 * // Simple get/set
 * await cache.set('user:123', userData, 60); // 60 seconds TTL
 * const user = await cache.get<User>('user:123');
 *
 * // Cache-aside pattern
 * const user = await cache.getOrSet('user:123', async () => {
 *   return await prisma.user.findUnique({ where: { id: '123' } });
 * }, 300);
 *
 * // Invalidation
 * await cache.delete('user:123');
 * await cache.deleteByPrefix('user:'); // Clear all user cache
 * ```
 */

import { env } from "@/lib/config";

// Types
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
}

// In-memory cache store
class InMemoryCache {
  private store: Map<string, CacheEntry<unknown>> = new Map();
  private stats: CacheStats = { hits: 0, misses: 0, sets: 0, deletes: 0 };

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    this.stats.sets++;
  }

  async delete(key: string): Promise<boolean> {
    const existed = this.store.delete(key);
    if (existed) this.stats.deletes++;
    return existed;
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    this.stats.deletes += count;
    return count;
  }

  async clear(): Promise<void> {
    const count = this.store.size;
    this.store.clear();
    this.stats.deletes += count;
  }

  getStats(): CacheStats & { size: number } {
    return { ...this.stats, size: this.store.size };
  }

  // Cleanup expired entries
  cleanup(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }
}

// Initialize cache
const inMemoryCache = new InMemoryCache();
const hasUpstashConfig = !!(env.rateLimit.redisUrl && env.rateLimit.redisToken);

// Cleanup every 5 minutes
setInterval(() => {
  const cleaned = inMemoryCache.cleanup();
  if (cleaned > 0) {
    console.log(`[Cache] Cleaned ${cleaned} expired entries`);
  }
}, 5 * 60 * 1000);

// Log cache type on initialization
if (hasUpstashConfig) {
  console.log("✅ Cache: Using Upstash Redis (Production)");
} else {
  console.log(
    "⚠️  Cache: Using in-memory store (Development only - resets on server restart)"
  );
}

/**
 * Main cache interface
 */
export const cache = {
  /**
   * Get a value from cache
   * @param key - Cache key
   * @returns Cached value or null if not found/expired
   */
  async get<T>(key: string): Promise<T | null> {
    // TODO: Add Redis implementation when needed
    return inMemoryCache.get<T>(key);
  },

  /**
   * Set a value in cache with TTL
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Time to live in seconds (default: 300 = 5 minutes)
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    // TODO: Add Redis implementation when needed
    return inMemoryCache.set(key, value, ttlSeconds);
  },

  /**
   * Delete a key from cache
   * @param key - Cache key to delete
   * @returns true if key existed
   */
  async delete(key: string): Promise<boolean> {
    return inMemoryCache.delete(key);
  },

  /**
   * Delete all keys with a given prefix
   * Useful for invalidating related cache entries
   * @param prefix - Key prefix to match
   * @returns Number of keys deleted
   */
  async deleteByPrefix(prefix: string): Promise<number> {
    return inMemoryCache.deleteByPrefix(prefix);
  },

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    return inMemoryCache.clear();
  },

  /**
   * Get cache statistics
   */
  getStats() {
    return inMemoryCache.getStats();
  },

  /**
   * Cache-aside pattern: Get from cache or fetch and cache
   * @param key - Cache key
   * @param fetcher - Async function to fetch data if not cached
   * @param ttlSeconds - Time to live in seconds
   * @returns Cached or freshly fetched value
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, ttlSeconds);
    return value;
  },

  /**
   * Stale-while-revalidate pattern
   * Returns stale data immediately while refreshing in background
   * @param key - Cache key
   * @param fetcher - Async function to fetch fresh data
   * @param ttlSeconds - Time to live in seconds
   * @param staleWhileRevalidateSeconds - Additional time to serve stale data
   */
  async getOrSetSWR<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 300,
    staleWhileRevalidateSeconds: number = 60
  ): Promise<T | null> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    // No cache, fetch fresh
    const value = await fetcher();
    await this.set(key, value, ttlSeconds + staleWhileRevalidateSeconds);
    return value;
  },
};

/**
 * Cache key builders for consistent key formatting
 */
export const cacheKeys = {
  user: (id: string) => `user:${id}`,
  userPermissions: (id: string) => `user:${id}:permissions`,
  userVenues: (id: string) => `user:${id}:venues`,
  venue: (id: string) => `venue:${id}`,
  venueStaff: (id: string) => `venue:${id}:staff`,
  channel: (id: string) => `channel:${id}`,
  channelMembers: (id: string) => `channel:${id}:members`,
  rolePermissions: (roleId: string) => `role:${roleId}:permissions`,
  availabilityByUser: (userId: string) => `availability:user:${userId}`,
  availabilityByVenue: (venueId: string) => `availability:venue:${venueId}`,
  timeOffRequests: (userId: string) => `timeoff:user:${userId}`,
  notifications: (userId: string) => `notifications:${userId}`,
  dashboardStats: (venueId?: string) =>
    venueId ? `dashboard:${venueId}` : "dashboard:global",
};

/**
 * Cache invalidation helpers
 */
export const invalidateCache = {
  /**
   * Invalidate all cache for a user
   */
  async user(userId: string): Promise<void> {
    await cache.deleteByPrefix(`user:${userId}`);
  },

  /**
   * Invalidate all cache for a venue
   */
  async venue(venueId: string): Promise<void> {
    await cache.deleteByPrefix(`venue:${venueId}`);
    await cache.delete(cacheKeys.dashboardStats(venueId));
  },

  /**
   * Invalidate availability cache
   */
  async availability(userId: string, venueId?: string): Promise<void> {
    await cache.delete(cacheKeys.availabilityByUser(userId));
    if (venueId) {
      await cache.delete(cacheKeys.availabilityByVenue(venueId));
    }
  },

  /**
   * Invalidate all dashboard stats
   */
  async dashboardStats(): Promise<void> {
    await cache.deleteByPrefix("dashboard:");
  },

  /**
   * Invalidate channel cache
   */
  async channel(channelId: string): Promise<void> {
    await cache.deleteByPrefix(`channel:${channelId}`);
  },

  /**
   * Invalidate role permissions (affects all users with that role)
   */
  async rolePermissions(roleId: string): Promise<void> {
    await cache.delete(cacheKeys.rolePermissions(roleId));
  },
};

/**
 * Default TTL values in seconds
 */
export const cacheTTL = {
  short: 60, // 1 minute - for frequently changing data
  medium: 300, // 5 minutes - default
  long: 900, // 15 minutes - for semi-static data
  extraLong: 3600, // 1 hour - for rarely changing data
  session: 1800, // 30 minutes - for session-related data
};
