/**
 * Performance Optimization Utilities for Document Management System
 * Phase 8 - Polish & Testing
 *
 * This module provides:
 * - Query optimization helpers
 * - Caching strategies for frequently accessed data
 * - Lazy loading utilities for large forms
 * - Debounced auto-save configuration
 * - Virtual scrolling for long field lists
 */

import { cache, cacheKeys, cacheTTL, invalidateCache } from "@/lib/utils/cache";

// ============================================================================
// TYPES
// ============================================================================

export interface QueryOptimizationOptions {
  /** Enable query result caching */
  useCache?: boolean;
  /** Cache TTL in seconds */
  cacheTTL?: number;
  /** Maximum number of results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Fields to select (projection) */
  select?: string[];
  /** Include relations */
  include?: string[];
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface AutoSaveConfig {
  /** Debounce interval in milliseconds */
  debounceMs: number;
  /** Maximum wait time before forcing a save */
  maxWaitMs: number;
  /** Minimum time between saves */
  minIntervalMs: number;
  /** Enable local storage backup */
  localStorageBackup: boolean;
  /** Local storage key prefix */
  storageKeyPrefix: string;
  /** Maximum draft age in days */
  maxDraftAgeDays: number;
}

export interface VirtualScrollConfig {
  /** Height of each item in pixels */
  itemHeight: number;
  /** Number of items to render above viewport */
  overscan: number;
  /** Container height in pixels */
  containerHeight: number;
  /** Enable smooth scrolling */
  smoothScroll: boolean;
}

export interface LazyLoadOptions {
  /** Delay before loading in milliseconds */
  delay?: number;
  /** Placeholder component height */
  placeholderHeight?: number;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Threshold for intersection observer */
  threshold?: number;
}

// ============================================================================
// DOCUMENT-SPECIFIC CACHE KEYS
// ============================================================================

export const documentCacheKeys = {
  // Template caching
  template: (id: string) => `doc:template:${id}`,
  templateVersions: (id: string) => `doc:template:${id}:versions`,
  templateFields: (id: string) => `doc:template:${id}:fields`,
  templatesByVenue: (venueId: string) => `doc:templates:venue:${venueId}`,
  templatesByCategory: (venueId: string, category: string) =>
    `doc:templates:venue:${venueId}:category:${category}`,

  // Assignment caching
  assignment: (id: string) => `doc:assignment:${id}`,
  assignmentsByUser: (userId: string) => `doc:assignments:user:${userId}`,
  assignmentsByVenue: (venueId: string) => `doc:assignments:venue:${venueId}`,
  pendingAssignments: (userId: string) => `doc:assignments:user:${userId}:pending`,
  overdueAssignments: (venueId: string) => `doc:assignments:venue:${venueId}:overdue`,

  // Submission caching
  submission: (id: string) => `doc:submission:${id}`,
  submissionsByAssignment: (assignmentId: string) =>
    `doc:submissions:assignment:${assignmentId}`,
  submissionsByUser: (userId: string) => `doc:submissions:user:${userId}`,

  // Bundle caching
  bundle: (id: string) => `doc:bundle:${id}`,
  bundlesByVenue: (venueId: string) => `doc:bundles:venue:${venueId}`,
  bundleItems: (bundleId: string) => `doc:bundle:${bundleId}:items`,

  // Analytics caching
  analyticsOverview: (venueId: string) => `doc:analytics:venue:${venueId}:overview`,
  analyticsCompletions: (venueId: string, period: string) =>
    `doc:analytics:venue:${venueId}:completions:${period}`,
  analyticsOverdue: (venueId: string) => `doc:analytics:venue:${venueId}:overdue`,

  // Form schema caching
  formSchema: (templateId: string, version: number) =>
    `doc:schema:${templateId}:v${version}`,
  formDraft: (assignmentId: string, userId: string) =>
    `doc:draft:${assignmentId}:${userId}`,

  // PDF caching
  pdfInfo: (templateId: string) => `doc:pdf:info:${templateId}`,
  pdfThumbnails: (templateId: string) => `doc:pdf:thumbnails:${templateId}`,
};

// ============================================================================
// CACHE INVALIDATION HELPERS
// ============================================================================

export const invalidateDocumentCache = {
  /**
   * Invalidate all cache for a template
   */
  async template(templateId: string): Promise<void> {
    await Promise.all([
      cache.delete(documentCacheKeys.template(templateId)),
      cache.delete(documentCacheKeys.templateVersions(templateId)),
      cache.delete(documentCacheKeys.templateFields(templateId)),
      cache.delete(documentCacheKeys.formSchema(templateId, 0)), // Best effort
      cache.delete(documentCacheKeys.pdfInfo(templateId)),
      cache.delete(documentCacheKeys.pdfThumbnails(templateId)),
    ]);
    // Clear schema versions with pattern
    await cache.deleteByPrefix(`doc:schema:${templateId}:`);
  },

  /**
   * Invalidate all cache for an assignment
   */
  async assignment(assignmentId: string, userId?: string, venueId?: string): Promise<void> {
    await Promise.all([
      cache.delete(documentCacheKeys.assignment(assignmentId)),
      cache.delete(documentCacheKeys.submissionsByAssignment(assignmentId)),
    ]);

    if (userId) {
      await Promise.all([
        cache.delete(documentCacheKeys.assignmentsByUser(userId)),
        cache.delete(documentCacheKeys.pendingAssignments(userId)),
        cache.delete(documentCacheKeys.submissionsByUser(userId)),
        cache.deleteByPrefix(`doc:draft:${assignmentId}:`),
      ]);
    }

    if (venueId) {
      await Promise.all([
        cache.delete(documentCacheKeys.assignmentsByVenue(venueId)),
        cache.delete(documentCacheKeys.overdueAssignments(venueId)),
        cache.delete(documentCacheKeys.analyticsOverview(venueId)),
      ]);
    }
  },

  /**
   * Invalidate all cache for a bundle
   */
  async bundle(bundleId: string, venueId?: string): Promise<void> {
    await Promise.all([
      cache.delete(documentCacheKeys.bundle(bundleId)),
      cache.delete(documentCacheKeys.bundleItems(bundleId)),
    ]);

    if (venueId) {
      await cache.delete(documentCacheKeys.bundlesByVenue(venueId));
    }
  },

  /**
   * Invalidate analytics cache for a venue
   */
  async analytics(venueId: string): Promise<void> {
    await Promise.all([
      cache.delete(documentCacheKeys.analyticsOverview(venueId)),
      cache.delete(documentCacheKeys.analyticsOverdue(venueId)),
      cache.deleteByPrefix(`doc:analytics:venue:${venueId}:completions:`),
    ]);
  },

  /**
   * Invalidate all document cache for a venue
   */
  async venue(venueId: string): Promise<void> {
    await Promise.all([
      cache.delete(documentCacheKeys.templatesByVenue(venueId)),
      cache.delete(documentCacheKeys.assignmentsByVenue(venueId)),
      cache.delete(documentCacheKeys.bundlesByVenue(venueId)),
      cache.delete(documentCacheKeys.overdueAssignments(venueId)),
      invalidateDocumentCache.analytics(venueId),
    ]);
  },
};

// ============================================================================
// QUERY OPTIMIZATION HELPERS
// ============================================================================

/**
 * Create optimized pagination parameters
 */
export function createPaginationParams(
  page: number = 1,
  pageSize: number = 20
): PaginationOptions {
  // Ensure valid values
  const validPage = Math.max(1, page);
  const validPageSize = Math.min(Math.max(1, pageSize), 100); // Max 100 items per page

  return {
    page: validPage,
    pageSize: validPageSize,
  };
}

/**
 * Calculate pagination metadata
 */
export function calculatePaginationMeta(
  totalItems: number,
  page: number,
  pageSize: number
): PaginatedResult<never>["pagination"] {
  const totalPages = Math.ceil(totalItems / pageSize);
  const validPage = Math.min(Math.max(1, page), totalPages || 1);

  return {
    page: validPage,
    pageSize,
    totalItems,
    totalPages,
    hasMore: validPage < totalPages,
  };
}

/**
 * Create a cached query wrapper
 */
export function createCachedQuery<T>(
  keyBuilder: (...args: unknown[]) => string,
  queryFn: (...args: unknown[]) => Promise<T>,
  ttlSeconds: number = cacheTTL.medium
): (...args: unknown[]) => Promise<T> {
  return async (...args: unknown[]) => {
    const key = keyBuilder(...args);
    return cache.getOrSet(key, () => queryFn(...args), ttlSeconds);
  };
}

/**
 * Batch loader for N+1 query prevention
 */
export class BatchLoader<TKey, TResult> {
  private batch: Map<TKey, Promise<TResult>> = new Map();
  private batchFn: (keys: TKey[]) => Promise<Map<TKey, TResult>>;
  private scheduleDispatch: () => void;
  private scheduled = false;

  constructor(
    batchFn: (keys: TKey[]) => Promise<Map<TKey, TResult>>,
    private delayMs: number = 10
  ) {
    this.batchFn = batchFn;
    this.scheduleDispatch = this.createScheduler();
  }

  private createScheduler(): () => void {
    return () => {
      if (this.scheduled) return;
      this.scheduled = true;
      setTimeout(() => this.dispatch(), this.delayMs);
    };
  }

  private async dispatch(): Promise<void> {
    const keys = Array.from(this.batch.keys());
    this.batch.clear();
    this.scheduled = false;

    if (keys.length === 0) return;

    try {
      const results = await this.batchFn(keys);
      // Resolvers are handled by the promises created in load()
      for (const [key, promise] of this.batch.entries()) {
        const result = results.get(key);
        if (result !== undefined) {
          // Resolve the promise with the result
          (promise as any).resolve?.(result);
        }
      }
    } catch (error) {
      // Reject all pending promises
      for (const [, promise] of this.batch.entries()) {
        (promise as any).reject?.(error);
      }
    }
  }

  async load(key: TKey): Promise<TResult> {
    if (this.batch.has(key)) {
      return this.batch.get(key)!;
    }

    let resolveFn: (value: TResult) => void;
    let rejectFn: (reason: unknown) => void;

    const promise = new Promise<TResult>((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    }) as Promise<TResult> & { resolve: typeof resolveFn; reject: typeof rejectFn };

    (promise as any).resolve = resolveFn!;
    (promise as any).reject = rejectFn!;

    this.batch.set(key, promise);
    this.scheduleDispatch();

    return promise;
  }

  async loadMany(keys: TKey[]): Promise<(TResult | Error)[]> {
    return Promise.all(
      keys.map((key) =>
        this.load(key).catch((error) => {
          if (error instanceof Error) return error;
          return new Error(String(error));
        })
      )
    );
  }
}

// ============================================================================
// DEBOUNCED AUTO-SAVE
// ============================================================================

/**
 * Default auto-save configuration
 */
export const DEFAULT_AUTO_SAVE_CONFIG: AutoSaveConfig = {
  debounceMs: 1000, // 1 second debounce
  maxWaitMs: 30000, // Force save after 30 seconds
  minIntervalMs: 500, // Minimum 500ms between saves
  localStorageBackup: true,
  storageKeyPrefix: "doc_draft_",
  maxDraftAgeDays: 7,
};

/**
 * Create a debounced auto-save function
 */
export function createAutoSave<TData>(
  saveFn: (data: TData) => Promise<void>,
  config: Partial<AutoSaveConfig> = {}
): {
  save: (data: TData) => void;
  flush: () => Promise<void>;
  cancel: () => void;
  getStatus: () => { pending: boolean; lastSaved: Date | null };
} {
  const finalConfig = { ...DEFAULT_AUTO_SAVE_CONFIG, ...config };
  let timeoutId: NodeJS.Timeout | null = null;
  let maxWaitTimeoutId: NodeJS.Timeout | null = null;
  let lastSaveTime = 0;
  let lastSavedAt: Date | null = null;
  let pendingData: TData | null = null;
  let isSaving = false;

  const executeSave = async (data: TData) => {
    if (isSaving) {
      // Queue the save for after current save completes
      pendingData = data;
      return;
    }

    const now = Date.now();
    const timeSinceLastSave = now - lastSaveTime;

    if (timeSinceLastSave < finalConfig.minIntervalMs) {
      // Reschedule for later
      timeoutId = setTimeout(
        () => executeSave(data),
        finalConfig.minIntervalMs - timeSinceLastSave
      );
      return;
    }

    isSaving = true;
    lastSaveTime = now;

    try {
      await saveFn(data);
      lastSavedAt = new Date();

      // Save to local storage as backup
      if (finalConfig.localStorageBackup) {
        saveDraftToLocalStorage(data, finalConfig.storageKeyPrefix);
      }
    } catch (error) {
      console.error("Auto-save failed:", error);
      // Don't throw - auto-save should be silent
    } finally {
      isSaving = false;

      // Process pending data if any
      if (pendingData) {
        const dataToSave = pendingData;
        pendingData = null;
        executeSave(dataToSave);
      }
    }
  };

  const debouncedSave = (data: TData) => {
    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Set max wait timeout if not already set
    if (!maxWaitTimeoutId) {
      maxWaitTimeoutId = setTimeout(() => {
        if (pendingData !== null || timeoutId) {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          executeSave(data);
        }
        maxWaitTimeoutId = null;
      }, finalConfig.maxWaitMs);
    }

    // Set debounce timeout
    timeoutId = setTimeout(() => {
      timeoutId = null;
      executeSave(data);
    }, finalConfig.debounceMs);
  };

  const flush = async () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (maxWaitTimeoutId) {
      clearTimeout(maxWaitTimeoutId);
      maxWaitTimeoutId = null;
    }
    if (pendingData) {
      await executeSave(pendingData);
      pendingData = null;
    }
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (maxWaitTimeoutId) {
      clearTimeout(maxWaitTimeoutId);
      maxWaitTimeoutId = null;
    }
    pendingData = null;
  };

  return {
    save: debouncedSave,
    flush,
    cancel,
    getStatus: () => ({
      pending: timeoutId !== null || isSaving,
      lastSaved: lastSavedAt,
    }),
  };
}

/**
 * Save draft to local storage
 */
function saveDraftToLocalStorage<TData>(
  data: TData,
  keyPrefix: string
): void {
  if (typeof window === "undefined") return;

  try {
    const key = `${keyPrefix}${Date.now()}`;
    const draft = {
      data,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(draft));

    // Clean up old drafts
    cleanupOldDrafts(keyPrefix, 7); // Keep last 7 drafts
  } catch (error) {
    console.warn("Failed to save draft to local storage:", error);
  }
}

/**
 * Clean up old drafts from local storage
 */
function cleanupOldDrafts(keyPrefix: string, keepCount: number): void {
  if (typeof window === "undefined") return;

  const draftKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(keyPrefix)) {
      draftKeys.push(key);
    }
  }

  // Sort by timestamp (newest first) and remove old ones
  draftKeys.sort().reverse();

  for (let i = keepCount; i < draftKeys.length; i++) {
    localStorage.removeItem(draftKeys[i]);
  }
}

/**
 * Load draft from local storage
 */
export function loadDraftFromLocalStorage<TData>(
  keyPrefix: string,
  maxAgeDays: number = 7
): { data: TData; savedAt: Date } | null {
  if (typeof window === "undefined") return null;

  const draftKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(keyPrefix)) {
      draftKeys.push(key);
    }
  }

  if (draftKeys.length === 0) return null;

  // Get the most recent draft
  draftKeys.sort().reverse();
  const latestKey = draftKeys[0];

  try {
    const raw = localStorage.getItem(latestKey);
    if (!raw) return null;

    const draft = JSON.parse(raw);
    const savedAt = new Date(draft.savedAt);
    const ageInDays =
      (Date.now() - savedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (ageInDays > maxAgeDays) {
      localStorage.removeItem(latestKey);
      return null;
    }

    return {
      data: draft.data as TData,
      savedAt,
    };
  } catch (error) {
    console.warn("Failed to load draft from local storage:", error);
    return null;
  }
}

// ============================================================================
// VIRTUAL SCROLLING HELPERS
// ============================================================================

/**
 * Default virtual scroll configuration
 */
export const DEFAULT_VIRTUAL_SCROLL_CONFIG: VirtualScrollConfig = {
  itemHeight: 60,
  overscan: 5,
  containerHeight: 400,
  smoothScroll: true,
};

/**
 * Calculate visible range for virtual scrolling
 */
export function calculateVisibleRange(
  scrollTop: number,
  config: VirtualScrollConfig,
  totalItems: number
): {
  startIndex: number;
  endIndex: number;
  visibleCount: number;
  offsetY: number;
} {
  const { itemHeight, overscan, containerHeight } = config;

  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    totalItems - 1,
    startIndex + visibleCount + overscan * 2
  );
  const offsetY = startIndex * itemHeight;

  return {
    startIndex,
    endIndex,
    visibleCount,
    offsetY,
  };
}

/**
 * Get total height for virtual list
 */
export function getTotalHeight(
  totalItems: number,
  itemHeight: number
): number {
  return totalItems * itemHeight;
}

// ============================================================================
// LAZY LOADING UTILITIES
// ============================================================================

/**
 * Create a lazy load trigger hook configuration
 */
export function createLazyLoadConfig(
  options: LazyLoadOptions = {}
): IntersectionObserverInit {
  return {
    rootMargin: options.rootMargin ?? "100px",
    threshold: options.threshold ?? 0.1,
  };
}

/**
 * Chunk array for lazy loading
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Load items in batches
 */
export async function loadInBatches<T, R>(
  items: T[],
  batchFn: (batch: T[]) => Promise<R[]>,
  batchSize: number = 10,
  onProgress?: (loaded: number, total: number) => void
): Promise<R[]> {
  const results: R[] = [];
  const chunks = chunkArray(items, batchSize);

  for (let i = 0; i < chunks.length; i++) {
    const batchResults = await batchFn(chunks[i]);
    results.push(...batchResults);

    if (onProgress) {
      onProgress(Math.min((i + 1) * batchSize, items.length), items.length);
    }
  }

  return results;
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

/**
 * Measure execution time of an async function
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>,
  logThreshold: number = 1000 // Log if takes longer than 1 second
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  if (duration > logThreshold) {
    console.warn(`[Performance] ${name} took ${duration.toFixed(2)}ms`);
  }

  return { result, duration };
}

/**
 * Performance metrics collector
 */
export class PerformanceMetrics {
  private metrics: Map<string, { count: number; totalMs: number; maxMs: number }> =
    new Map();

  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      const existing = this.metrics.get(name) || { count: 0, totalMs: 0, maxMs: 0 };
      this.metrics.set(name, {
        count: existing.count + 1,
        totalMs: existing.totalMs + duration,
        maxMs: Math.max(existing.maxMs, duration),
      });
    }
  }

  getMetrics(): Record<string, { count: number; avgMs: number; maxMs: number }> {
    const result: Record<string, { count: number; avgMs: number; maxMs: number }> = {};
    for (const [name, { count, totalMs, maxMs }] of this.metrics) {
      result[name] = {
        count,
        avgMs: totalMs / count,
        maxMs,
      };
    }
    return result;
  }

  reset(): void {
    this.metrics.clear();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const documentCacheTTL = {
  template: cacheTTL.long, // 15 minutes
  assignment: cacheTTL.medium, // 5 minutes
  submission: cacheTTL.medium, // 5 minutes
  analytics: cacheTTL.short, // 1 minute
  formSchema: cacheTTL.extraLong, // 1 hour
  pdfInfo: cacheTTL.extraLong, // 1 hour
};

// Global performance metrics instance
export const documentPerformanceMetrics = new PerformanceMetrics();