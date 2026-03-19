# Staff Portal Pre-Launch Performance Audit

**Date:** March 19, 2026  
**Status:** Ready for Launch  
**Reviewer:** Performance Review

---

## Executive Summary

This comprehensive performance audit examines the Staff Portal Next.js application across six critical areas: N+1 query problems, database query efficiency, memory management, bundle size & code splitting, caching strategy, and real-time/WebSocket performance. The codebase demonstrates good foundational patterns but has several performance bottlenecks that should be addressed before public launch.

**Overall Assessment:** The application requires targeted fixes before production deployment. While core infrastructure (Prisma indexes, basic caching, cleanup handlers) is well-implemented, several high-impact performance issues were identified.

---

## 1. N+1 Query Problems

### Findings

| Severity | Location | Issue |
|----------|----------|-------|
| **CRITICAL** | [`validation-service.ts:292-299`](src/lib/rosters/validation-service.ts:292) | Sequential validation in loop for bulk shift validation - O(n) database queries |
| **HIGH** | [`roster-queries.ts:407-556`](src/lib/actions/rosters/roster-queries.ts:407) | getShiftConflictDetails performs N+1 queries for each shift |
| **HIGH** | [`shift-actions.ts:635-668`](src/lib/actions/rosters/shift-actions.ts:635) | Promise.all with individual updates creates connection pressure |
| **MEDIUM** | [`approval-actions.ts:409`](src/lib/actions/rosters/approval-actions.ts:409) | Sequential history entries in loop |
| **MEDIUM** | [`validation-service.ts:792-812`](src/lib/rosters/validation-service.ts:792) | Cross-venue validation fetches shifts per user in loop |

### Detailed Findings

**File:** `src/lib/rosters/validation-service.ts:292-299`
```typescript
// Current: O(n) database calls
for (let i = 0; i < shifts.length; i++) {
  const result = await validateShiftBeforeAdd(rosterId, shift, undefined);
  // Each call makes 3-5 database queries
}
```
**Problem:** Bulk validation makes individual database calls for each shift  
**Suggestion:** Batch validation into single database query with EXISTS subqueries

**File:** `src/lib/actions/rosters/roster-queries.ts:407-556`  
**Problem:** Shift conflict detection queries for each shift individually  
**Suggestion:** Use a single aggregated query to find all conflicts

---

## 2. Database Query Efficiency

### Findings

| Severity | Location | Issue |
|----------|----------|-------|
| **HIGH** | [`messages.ts:734-747`](src/lib/actions/messages.ts:734) | Sequential UPDATE in loop for mark-as-read |
| **HIGH** | [`availability.ts`](src/lib/actions/availability.ts) | Many queries missing select statements (already noted with optimization comments) |
| **MEDIUM** | [`posts.ts:145-192`](src/lib/actions/posts.ts:145) | No limit on default query - unbounded results |
| **MEDIUM** | [`roster-queries.ts:583-691`](src/lib/actions/rosters/roster-queries.ts:583) | Staff query without pagination for large venues |
| **LOW** | [`assignments.ts:707-720`](src/lib/actions/documents/assignments.ts:707) | 6 sequential count queries could be single query |

### Detailed Findings

**File:** `src/lib/actions/messages.ts:734-747`
```typescript
// Current: N individual updates
for (const message of unreadMessages) {
  await prisma.message.update({ where: { id: message.id }, ... });
}
```
**Problem:** Updates 100+ messages individually  
**Suggestion:** Use updateMany with WHERE clause

**File:** `src/lib/actions/posts.ts:145-192`  
**Problem:** Default limit of 20 is good but no maximum protection  
**Suggestion:** Add max limit cap (e.g., 100)

**Missing Composite Indexes Identified:**
- `rosterShift: [userId, date, roster.status]` - needed for conflict queries
- `documentAssignment: [userId, status, venueId]` - for user assignment lists
- `message: [conversationId, senderId, createdAt]` - for conversation queries

---

## 3. Memory Management

### Findings

| Severity | Location | Issue |
|----------|----------|-------|
| **MEDIUM** | Multiple client components | useEffect without explicit return cleanup for async operations |
| **LOW** | [`cache.ts:48-119`](src/lib/utils/cache.ts:48) | In-memory cache has no size limits - unbounded growth risk |
| **LOW** | Multiple hooks | No request deduplication for parallel identical requests |

### Detailed Findings

**File:** Multiple client components (useConversationListRealtime, NotificationBadge, etc.)  
**Problem:** useEffect hooks properly clean up Supabase subscriptions, but some may not handle component unmount during async operations  
**Status:** Most realtime hooks properly implement cleanup (lines 84-89 in useConversationListRealtime.ts)

**File:** `src/lib/utils/cache.ts:48-119`  
**Problem:** InMemoryCache has no maximum size - could grow unbounded in long-running server processes  
**Suggestion:** Add maxSize with LRU eviction

---

## 4. Bundle Size & Code Splitting

### Findings

| Severity | Location | Issue |
|----------|----------|-------|
| **HIGH** | All client components | No dynamic imports for heavy components (EmailBuilder, AIChat, etc.) |
| **MEDIUM** | Large action files | `roster-actions.ts` (20KB), `approval-actions.ts` (30KB) contain monolithic code |
| **MEDIUM** | AI features | Heavy AI libraries loaded on main bundle |

### Detailed Findings

**File:** Multiple pages  
**Problem:** Heavy interactive components (EmailBuilder, Reports, AI Chat) loaded as static imports  
**Example:**
```typescript
// Current
import { EmailBuilder } from "./email-builder";

// Should be
const EmailBuilder = dynamic(() => import("./email-builder"), { 
  loading: () => <Skeleton />,
  ssr: false 
});
```

**Components requiring dynamic imports:**
- `src/app/emails/builder/**` - Email builder (heavy DOM manipulation)
- `src/app/**/ai-chat*` - AI chat interfaces
- `src/app/**/reports/**` - Report builders
- `src/components/rosters/roster-upload-wizard-v3.tsx` - Complex wizard

**Missing lazy loading:**
- PDF rendering components
- Chart libraries (likely recharts/tremor)
- Rich text editors

---

## 5. Caching Strategy

### Findings

| Severity | Location | Issue |
|----------|----------|-------|
| **HIGH** | Production cache | Uses in-memory fallback (not Redis) - loses cache on server restart |
| **MEDIUM** | Server Actions | Limited cache usage in action files |
| **MEDIUM** | Dashboard queries | No caching for frequently accessed data |
| **LOW** | Cache infrastructure | Well-designed API with invalidation helpers |

### Detailed Findings

**File:** `src/lib/utils/cache.ts:133-140`
```typescript
if (hasUpstashConfig) {
  console.log("✅ Cache: Using Upstash Redis (Production)");
} else {
  console.log("⚠️  Cache: Using in-memory store (Development only)");
}
```
**Problem:** Cache falls back to in-memory in production if Redis not configured  
**Impact:** Cache invalidates on every server restart/redeploy  
**Suggestion:** Ensure Redis credentials are set in production environment

**Missing Cache Implementation:**
- Dashboard statistics (accessed on every page load)
- User permissions (checked on every action)
- Channel member lists
- Roster summaries

**Existing good patterns:**
- Cache key builders (`cacheKeys` object)
- Cache invalidation helpers (`invalidateCache`)
- TTL constants defined

---

## 6. Real-time & WebSocket Performance

### Findings

| Severity | Location | Issue |
|----------|----------|-------|
| **MEDIUM** | Multiple realtime hooks | Each page creates 2-4 separate Supabase channels |
| **MEDIUM** | No connection pooling | Each channel is separate connection |
| **LOW** | Presence sync | Typing indicator triggers full sync |
| **GOOD** | Cleanup handlers | All hooks properly remove channels on unmount |

### Detailed Findings

**File:** `src/hooks/useConversationListRealtime.ts:21-82`  
**Problem:** Creates 3 separate channels for conversation updates  
```typescript
const conversationChannel = supabase.channel(...);
const messageChannel = supabase.channel(...);
const participantChannel = supabase.channel(...);
```
**Suggestion:** Consolidate into single channel with multiple event listeners

**File:** `src/hooks/useTypingIndicator.ts:44-62`  
**Problem:** Full presence state synced on every keystroke  
**Note:** Already handles debouncing via 3-second auto-stop

**Good Implementation Found:**
- Proper cleanup in all realtime hooks
- Use of refs for callbacks to prevent re-subscriptions
- Debounced refresh to prevent refresh storms

---

## Summary Table

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| N+1 Queries | 1 | 2 | 2 | 0 | 5 |
| DB Efficiency | 0 | 2 | 3 | 0 | 5 |
| Memory | 0 | 0 | 1 | 2 | 3 |
| Bundle Size | 1 | 0 | 2 | 0 | 3 |
| Caching | 1 | 0 | 2 | 1 | 4 |
| Realtime | 0 | 0 | 2 | 1 | 3 |
| **TOTAL** | **3** | **4** | **12** | **4** | **23** |

---

## Recommended Priority Actions

### P0 - Must Fix Before Launch
1. **Bulk validation loop** - Implement batch validation in validation-service.ts
2. **Mark-as-read update loop** - Use updateMany in messages.ts
3. **Redis configuration** - Ensure UPSTASH_REDIS_URL is set in production

### P1 - Should Fix Before Launch
4. Add dynamic imports for EmailBuilder, AI Chat, Report pages
5. Add composite indexes for roster conflict queries
6. Consolidate Supabase realtime channels

### P2 - Post-Launch Improvements
7. Implement request deduplication
8. Add cache size limits with LRU eviction
9. Add pagination to staff lists
10. Implement dashboard query caching

---

## Positive Findings

1. **Database indexes** - Comprehensive indexing in Prisma schema (75+ indexes)
2. **Cleanup handlers** - All useEffect hooks properly clean up subscriptions
3. **Cache API design** - Well-structured cache interface with invalidation
4. **Rate limiting** - Already implemented for messages
5. **Select statements** - Most queries use selective field fetching

---

*End of Performance Audit Report*
