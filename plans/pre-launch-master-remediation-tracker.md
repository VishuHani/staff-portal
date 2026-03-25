# Pre-Launch Master Remediation Tracker

**Created:** March 19, 2026  
**Last Updated:** March 20, 2026  
**Purpose:** Single source of truth for pre-launch remediation across initial 13 findings + 28 architecture findings + newly discovered issues during fixes.

## Snapshot

| Metric | Value | Notes |
|---|---:|---|
| Raw Findings Total | 43 | `I13 (13) + A28 (28) + NEW (2)` |
| Canonical Issues Total | 41 | Exact dedupe only for true duplicates |
| Fixed (`Verified`) | 39 | Closure requires evidence + verification |
| Pending (non-blocked) | 0 | `Pending + In Progress + Fixed-Pending-Verify` |
| Blocked | 0 | Blocked tracked separately |
| Invalid | 2 | Retained for audit traceability |
| Pending Total (incl. blocked) | 0 | `Pending (non-blocked) + Blocked` |
| New-Discovered (`NEW-*`) | 2 | Issues found while fixing |

**Accounting rule:** `Fixed + Pending (non-blocked) + Blocked + Invalid = Canonical Total`  
**Current check:** `39 + 0 + 0 + 2 = 41` ✅

## Status Definitions

| Status | Meaning | Counts As |
|---|---|---|
| `Pending` | Not started | Pending (non-blocked) |
| `In Progress` | Actively being fixed | Pending (non-blocked) |
| `Fixed-Pending-Verify` | Code changed, waiting validation | Pending (non-blocked) |
| `Verified` | Fix validated with evidence | Fixed |
| `Blocked` | Cannot proceed due to dependency/risk | Blocked |
| `Invalid` | Not a real issue in current architecture | Invalid |

## Governance Rules

1. Update this file at PR open and PR merge for every remediation change.
2. Every status change must include evidence (`PR`, commit, test output, or validation notes).
3. `Verified` is the only status counted as `Fixed`.
4. All `NEW-*` issues discovered while fixing must be logged immediately and triaged in the same update cycle.
5. Launch decision is based on `Snapshot` and unresolved `P0/P1` entries in **Launch Gate**.

## Source Ledger (Raw Findings, No Drops)

| Raw ID | Source | Raw Finding | Severity | Audit Alignment | Canonical ID | Execution Status | Notes |
|---|---|---|---|---|---|---|---|
| I13-001 | Initial 13 | Unauthenticated document upload endpoints | High | Confirmed | PLR-001 | Verified | Implemented authenticated upload route with rate limiting and permission checks |
| I13-002 | Initial 13 | Missing webhook signature verification | High | Confirmed | PLR-002 | Verified | Implemented webhook verification with production fail-closed behavior |
| I13-003 | Initial 13 | Cross-venue authz gap in pay settings paths | Critical | Confirmed | PLR-003 | Verified | Venue-scoped guardrails added and covered by pay-settings unit tests |
| I13-004 | Initial 13 | Cross-venue authz gap in channel management paths | Critical | Confirmed | PLR-004 | Verified | Channel update/read authz tightened with tenant-aware tests |
| I13-005 | Initial 13 | Cross-venue authz gap in posts paths | Critical | Confirmed | PLR-005 | Verified | Post access/mutation now constrained to accessible channels/venues |
| I13-006 | Initial 13 | Cross-venue authz gap in comments/reactions paths | Critical | Confirmed | PLR-006 | Verified | Comment/reaction access controls hardened and tested |
| I13-007 | Initial 13 | Stored HTML injection/XSS in email preview/render paths | Critical | Confirmed | PLR-007 | Verified | Stored XSS class risk |
| I13-008 | Initial 13 | Notification link handling XSS/open-redirect risk | High | Partially Confirmed | PLR-008 | Verified | Sanitization/allowlist hardening |
| I13-009 | Initial 13 | SSRF-like fetch surface in fillable/doc-analysis flows | Critical | Partially Confirmed | PLR-009 | Verified | External URL fetch controls needed |
| I13-010 | Initial 13 | Document assignment cross-tenant leakage/integrity risk | Critical | Confirmed | PLR-010 | Verified | Assignment paths now enforce tenant/channel boundaries |
| I13-011 | Initial 13 | Prospective-user flow tenant-integrity risk | High | Confirmed | PLR-011 | Verified | Tenant integrity |
| I13-012 | Initial 13 | Next.js 16 route params typing build blocker | High | Confirmed | PLR-012 | Verified | Production build now passes on Next 16.2.0 |
| I13-013 | Initial 13 | High/critical dependency advisories (`npm audit`) | High | Confirmed | PLR-013 | Verified | `npm audit --audit-level=high --json` now reports 0 vulnerabilities after dependency upgrades and `xlsx` replacement |
| A28-001 | pre-launch-architecture-audit.md | 1.1 Missing Authentication in Documents Upload | High | Confirmed | PLR-001 | Verified | Duplicate of I13-001 |
| A28-002 | pre-launch-architecture-audit.md | 1.2 Missing Rate Limiting on Cron Endpoint | Medium | Partially Confirmed | PLR-014 | Verified | Cron route now requires shared secret and rate-limits enqueue requests |
| A28-003 | pre-launch-architecture-audit.md | 1.3 Missing Signature Verification | High | Confirmed | PLR-002 | Verified | Duplicate of I13-002 |
| A28-004 | pre-launch-architecture-audit.md | 1.4 Missing Pagination in List Endpoints | Medium | Confirmed | PLR-015 | Verified | API scalability |
| A28-005 | pre-launch-architecture-audit.md | 1.5 Inconsistent Response Formats | Low | Partially Confirmed | PLR-016 | Verified | Standardization |
| A28-006 | pre-launch-architecture-audit.md | 1.6 RESTful Compliance Issues | Medium | Partially Confirmed | PLR-017 | Verified | Fill/extract operations split into explicit subroutes (`/fill`, `/fields`) |
| A28-007 | pre-launch-architecture-audit.md | 2.1 Inconsistent Return Types | Medium | Confirmed | PLR-018 | Verified | Action contract standardized across profile/conversations/messages/posts/admin/rosters surfaces |
| A28-008 | pre-launch-architecture-audit.md | 2.2 Potential `use client` boundary violations | Low | Inaccurate | PLR-019 | Invalid | Flag kept for traceability |
| A28-009 | pre-launch-architecture-audit.md | 2.3 Missing Error Boundaries in Server Actions | Medium | Partially Confirmed | PLR-020 | Verified | Catch-block logging normalized with `logActionError` and contextual metadata |
| A28-010 | pre-launch-architecture-audit.md | 2.4 Revalidation Strategy Issues | Medium | Partially Confirmed | PLR-021 | Verified | Revalidation standardized with `revalidatePaths` on remediated action modules |
| A28-011 | pre-launch-architecture-audit.md | 2.5 Large Server Action Files | Low | Confirmed | PLR-022 | Verified | Email campaign action surface split into `shared` and `approvals` modules; core file size reduced |
| A28-012 | pre-launch-architecture-audit.md | 3.1 Missing Indexes on Frequently Queried Fields | High | Partially Confirmed | PLR-023 | Verified | Composite index review |
| A28-013 | pre-launch-architecture-audit.md | 3.2 Missing Cascade Delete Behavior | Medium | Partially Confirmed | PLR-024 | Verified | Cascade policy codified in schema + migration and validated with `npx prisma validate` |
| A28-014 | pre-launch-architecture-audit.md | 3.3 Overly Large User Model | Medium | Partially Confirmed | PLR-025 | Verified | Auth context now uses narrow select projection (`userAuthContextSelect`) |
| A28-015 | pre-launch-architecture-audit.md | 3.4 Missing Unique Constraints | Medium | Partially Confirmed | PLR-026 | Verified | Email folder sibling-name uniqueness enforced in DB + application-level prechecks |
| A28-016 | pre-launch-architecture-audit.md | 3.5 Enum Consistency Issues | Low | Partially Confirmed | PLR-027 | Verified | Prisma enum values centralized in shared TS types |
| A28-017 | pre-launch-architecture-audit.md | 4.1 Server/Client Component Separation | Medium | Inaccurate | PLR-028 | Invalid | Architecture is mostly aligned |
| A28-018 | pre-launch-architecture-audit.md | 4.2 Large Client Components | Medium | Confirmed | PLR-029 | Verified | My-shifts and campaign-detail clients split into lazily loaded view modules |
| A28-019 | pre-launch-architecture-audit.md | 4.3 Prop Drilling vs Context Usage | Low | Confirmed | PLR-030 | Verified | Notification context introduced to remove header->dropdown->badge prop drilling |
| A28-020 | pre-launch-architecture-audit.md | 5.1 Circular Dependency Risk | Medium | Partially Confirmed | PLR-031 | Verified | RBAC shared contract types extracted into `src/lib/rbac/types.ts` |
| A28-021 | pre-launch-architecture-audit.md | 5.2 Mixed Concerns in Module Organization | Low | Confirmed | PLR-032 | Verified | RBAC boundary policy documented |
| A28-022 | pre-launch-architecture-audit.md | 6.1 N+1 Query in Email Campaign Sending | High | Confirmed | PLR-033 | Verified | Scalability |
| A28-023 | pre-launch-architecture-audit.md | 6.2 Missing Pagination in Server Actions | Medium | Confirmed | PLR-034 | Verified | Scalability |
| A28-024 | pre-launch-architecture-audit.md | 6.3 In-Memory Cache in Production | Medium | Confirmed | PLR-035 | Verified | Reliability/perf |
| A28-025 | pre-launch-architecture-audit.md | 6.4 Permission Check Performance | Medium | Confirmed | PLR-036 | Verified | Query overhead |
| A28-026 | pre-launch-architecture-audit.md | 6.5 Real-time Dashboard Updates (Polling) | Medium | Confirmed | PLR-037 | Verified | Scalability |
| A28-027 | pre-launch-architecture-audit.md | 7.1.3 Add rate limiting to all public endpoints | High | Confirmed | PLR-038 | Verified | Public upload/webhook endpoints now enforce baseline rate limiting |
| A28-028 | pre-launch-architecture-audit.md | 7.1.4 Review/test auth in all API routes | High | Confirmed | PLR-039 | Verified | Auth coverage added for upload, webhook, and cron routes |
| NEW-001 | Remediation Discovery (2026-03-20) | Invite page crash from invalid date formatting (`parseISO(date.toString())`) | High | Confirmed | PLR-040 | Verified | Date formatting hardened for mixed Date/string inputs and invalid values |
| NEW-002 | Remediation Discovery (2026-03-20) | Production email/auth links could fall back to localhost/undefined when `NEXT_PUBLIC_APP_URL` missing | High | Confirmed | PLR-041 | Verified | Centralized app URL resolver added and wired across auth/invite/reminder/notification paths |

## Canonical Issues (Actionable Deduplicated Backlog)

| PLR ID | Title | Mapped Raw IDs | Domain | Severity | Launch Priority | Audit Alignment | Execution Status | Owner | Target Date | Evidence | Verification | Last Updated |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PLR-001 | Add authentication to document upload endpoints | I13-001, A28-001 | Security | High | P0 | Confirmed | Verified | Unassigned | TBD | Security-controls test suite | Unauthorized upload requests rejected; valid upload path covered | 2026-03-19 |
| PLR-002 | Enforce webhook signature verification | I13-002, A28-003 | Security | High | P0 | Confirmed | Verified | Unassigned | TBD | Security-controls test suite | Invalid webhook auth rejected; production fails closed without config | 2026-03-19 |
| PLR-003 | Enforce venue authz in pay settings operations | I13-003 | AuthZ/Tenant | Critical | P0 | Confirmed | Verified | Unassigned | TBD | `src/lib/actions/admin/venue-pay-config.ts`; `__tests__/unit/actions/pay-settings.test.ts` | Cross-venue pay-setting mutations denied in tenant-scoped checks | 2026-03-19 |
| PLR-004 | Enforce venue authz in channel management operations | I13-004 | AuthZ/Tenant | Critical | P0 | Confirmed | Verified | Unassigned | TBD | `src/lib/actions/channels.ts`; `__tests__/unit/actions/channels.test.ts` | Cross-venue channel updates now return not-found/denied paths | 2026-03-19 |
| PLR-005 | Enforce venue authz in post operations | I13-005 | AuthZ/Tenant | Critical | P0 | Confirmed | Verified | Unassigned | TBD | `src/lib/actions/posts.ts`; `__tests__/unit/actions/posts.test.ts` | Post reads/writes constrained by accessible channels + shared-venue authors | 2026-03-19 |
| PLR-006 | Enforce venue authz in comment/reaction operations | I13-006 | AuthZ/Tenant | Critical | P0 | Confirmed | Verified | Unassigned | TBD | `src/lib/actions/comments.ts`; `src/lib/actions/reactions.ts`; `__tests__/unit/actions/comments.test.ts`; `__tests__/unit/actions/reactions.test.ts` | Comment/reaction mutations blocked outside allowed tenant scope | 2026-03-19 |
| PLR-007 | Neutralize stored HTML/XSS in email preview/render | I13-007 | Security | Critical | P0 | Confirmed | Verified | Unassigned | TBD | `__tests__/unit/lib/services/email-sanitization.test.ts` | Payload escaping/sanitization verified with tests | 2026-03-19 |
| PLR-008 | Harden notification link handling against script/open-redirect vectors | I13-008 | Security | High | P1 | Partially Confirmed | Verified | Unassigned | TBD | `__tests__/unit/lib/services/email-sanitization.test.ts` | Link parsing allowlist and escaping verified | 2026-03-19 |
| PLR-009 | Mitigate SSRF in fillable/doc-analysis fetch paths | I13-009 | Security | Critical | P0 | Partially Confirmed | Verified | Unassigned | TBD | `__tests__/unit/lib/security/protected-fetch.test.ts` | URL allowlist/egress controls + negative tests | 2026-03-19 |
| PLR-010 | Fix document assignment multi-tenant leakage/integrity | I13-010 | Data Integrity | Critical | P0 | Confirmed | Verified | Unassigned | TBD | `src/lib/actions/documents/assignments.ts`; `__tests__/unit/actions/document-assignments.test.ts` | Assignment reads/mutations now enforce tenant/channel visibility constraints | 2026-03-19 |
| PLR-011 | Fix prospective-user flow tenant-integrity enforcement | I13-011 | Data Integrity | High | P0 | Confirmed | Verified | Unassigned | TBD | `src/lib/actions/invites.ts`; `__tests__/unit/actions/invites.test.ts` | Venue-scoped invite lookup remains venue-specific; invitation acceptance now validates account email matches token email | 2026-03-19 |
| PLR-012 | Resolve Next.js 16 params typing build blocker | I13-012 | Reliability | High | P0 | Confirmed | Verified | Unassigned | TBD | `npm run -s build` (pass) | Next.js 16 build now compiles, type-checks, and completes static generation | 2026-03-19 |
| PLR-013 | Resolve high/critical dependency advisories | I13-013 | Security | High | P0 | Confirmed | Verified | Unassigned | TBD | `package.json`; `package-lock.json`; `src/lib/utils/excel-workbook.ts`; `src/lib/services/roster-export-service.ts`; `src/lib/actions/reports/export.ts`; `npm audit --audit-level=high --json` | `npm audit` now reports 0 vulnerabilities; Excel export regression tests pass after `xlsx` replacement | 2026-03-19 |
| PLR-014 | Add protection/rate limiting around cron enqueue endpoint | A28-002 | Security | Medium | P1 | Partially Confirmed | Verified | Unassigned | TBD | Security-controls test suite | Cron auth required in all environments; enqueue requests rate-limited | 2026-03-19 |
| PLR-015 | Add pagination for list API endpoints | A28-004 | Performance | Medium | P1 | Confirmed | Verified | Unassigned | TBD | src/app/api/venues/[venueId]/users/route.ts; __tests__/unit/lib/utils/pagination.test.ts | Venue user list now paginates with bounded limits | 2026-03-19 |
| PLR-016 | Standardize API response envelope | A28-005 | Architecture | Low | P2 | Partially Confirmed | Verified | Unassigned | TBD | `src/app/api/documents/upload/route.ts`; `src/app/api/documents/upload-pdf/route.ts`; `src/app/api/documents/fillable/route.ts`; `src/app/api/cron/jobs/route.ts`; `src/app/api/email-campaigns/webhook/route.ts`; `src/app/api/admin/venue-pay-config/route.ts`; `src/app/api/admin/staff/[id]/pay-rates/route.ts`; `src/app/api/admin/repair-roster-chains/route.ts`; `src/app/api/documents/assignments/bulk/route.ts`; `__tests__/unit/lib/utils/api-response.test.ts`; `__tests__/unit/app/api/security-controls.test.ts`; `__tests__/unit/app/api/fillable-route.test.ts` | Shared API helper now used consistently across low-risk routes | 2026-03-19 |
| PLR-017 | Align route semantics with REST conventions where applicable | A28-006 | Architecture | Medium | P2 | Partially Confirmed | Verified | Unassigned | TBD | `src/app/api/documents/fillable/route.ts`; `src/app/api/documents/fillable/fill/route.ts`; `src/app/api/documents/fillable/fields/route.ts`; `__tests__/unit/app/api/fillable-route.test.ts` | Create/fill/extract operations now use explicit route contracts; unauthorized envelope tests pass | 2026-03-19 |
| PLR-018 | Standardize server action return contract | A28-007 | Architecture | Medium | P2 | Confirmed | Verified | Unassigned | TBD | `src/lib/actions/profile.ts`; `src/lib/actions/conversations.ts`; `src/lib/actions/messages.ts`; `src/lib/actions/posts.ts`; `src/lib/actions/admin/users.ts`; `src/lib/actions/admin/roles.ts`; `src/lib/actions/rosters/approval-actions.ts`; `src/lib/actions/rosters/roster-actions.ts`; `src/lib/actions/email-campaigns/approvals.ts`; `src/lib/utils/action-contract.ts` | Unified `actionSuccess`/`actionFailure` contract validated via targeted action suites + production build | 2026-03-19 |
| PLR-019 | Validate/close client-server boundary concern | A28-008 | Architecture | Low | P2 | Inaccurate | Invalid | Unassigned | N/A | Review notes | No actionable regression in current state | 2026-03-19 |
| PLR-020 | Implement structured error boundaries/logging in server actions | A28-009 | Reliability | Medium | P2 | Partially Confirmed | Verified | Unassigned | TBD | `src/lib/actions/profile.ts`; `src/lib/actions/conversations.ts`; `src/lib/actions/messages.ts`; `src/lib/actions/posts.ts`; `src/lib/actions/admin/users.ts`; `src/lib/actions/admin/roles.ts`; `src/lib/actions/rosters/approval-actions.ts`; `src/lib/actions/rosters/roster-actions.ts`; `src/lib/actions/email-campaigns/approvals.ts`; `src/lib/utils/action-contract.ts` | Catch logging paths now use `logActionError` with consistent action names and context payloads | 2026-03-19 |
| PLR-021 | Standardize cache revalidation strategy | A28-010 | Reliability | Medium | P2 | Partially Confirmed | Verified | Unassigned | TBD | `src/lib/actions/email-campaigns.ts`; `src/lib/actions/email-campaigns/approvals.ts`; `src/lib/actions/profile.ts`; `src/lib/actions/conversations.ts`; `src/lib/actions/posts.ts`; `src/lib/actions/admin/users.ts`; `src/lib/actions/admin/roles.ts`; `src/lib/actions/rosters/approval-actions.ts`; `src/lib/actions/rosters/roster-actions.ts`; `src/lib/utils/action-contract.ts` | Revalidation now uses centralized `revalidatePaths` helper across remediated action modules | 2026-03-19 |
| PLR-022 | Break down oversized server action files | A28-011 | Architecture | Low | P2 | Confirmed | Verified | Unassigned | TBD | `src/lib/actions/email-campaigns.ts`; `src/lib/actions/email-campaigns/shared.ts`; `src/lib/actions/email-campaigns/approvals.ts` | Email campaigns action surface split into focused modules; build and targeted tests pass | 2026-03-19 |
| PLR-023 | Add/verify composite indexes for high-frequency queries | A28-012 | Performance | High | P1 | Partially Confirmed | Verified | Unassigned | TBD | prisma/schema.prisma; prisma/migrations/20260319190000_add_performance_indexes/migration.sql | Composite indexes added for messages, rosters, and email campaigns | 2026-03-19 |
| PLR-024 | Review cascade delete behavior and policies | A28-013 | Data Integrity | Medium | P2 | Partially Confirmed | Verified | Unassigned | TBD | `prisma/schema.prisma`; `prisma/migrations/20260319203000_schema_rbac_policy_hardening/migration.sql`; `plans/pre-launch-schema-rbac-policy.md`; `npx prisma validate` | Documented and explicit `onDelete` behavior now enforced for targeted relations | 2026-03-19 |
| PLR-025 | Reduce User model overloading risk | A28-014 | Architecture | Medium | P2 | Partially Confirmed | Verified | Unassigned | TBD | `src/lib/users/selectors.ts`; `src/lib/actions/auth.ts`; `__tests__/unit/actions/auth-current-user.test.ts` | Auth-context fetch now uses explicit projection with sensitive-field exclusion verified by tests | 2026-03-19 |
| PLR-026 | Add missing uniqueness constraints where required | A28-015 | Data Integrity | Medium | P1 | Partially Confirmed | Verified | Unassigned | TBD | `prisma/migrations/20260319203000_schema_rbac_policy_hardening/migration.sql`; `src/lib/actions/email-workspace/folders.ts`; `plans/pre-launch-schema-rbac-policy.md`; `npx prisma validate` | DB-level sibling-name uniqueness + application-level duplicate guard paths are in place | 2026-03-19 |
| PLR-027 | Align enum usage with schema types | A28-016 | Architecture | Low | P2 | Partially Confirmed | Verified | Unassigned | TBD | `src/types/prisma-enums.ts`; `src/types/email-campaign.ts`; `src/lib/schemas/notifications.ts`; `__tests__/unit/types/prisma-enums.test.ts` | Prisma-backed enum values now flow through shared types and schema validation | 2026-03-19 |
| PLR-028 | Validate server/client separation issue claim | A28-017 | Architecture | Medium | P2 | Inaccurate | Invalid | Unassigned | N/A | Review notes | Kept for audit history only | 2026-03-19 |
| PLR-029 | Split oversized client components and lazy load where needed | A28-018 | Performance | Medium | P2 | Confirmed | Verified | Unassigned | TBD | `src/app/my/rosters/my-shifts-client.tsx`; `src/app/my/rosters/my-shifts-view.tsx`; `src/app/system/emails/[id]/campaign-detail-client.tsx`; `src/app/system/emails/[id]/campaign-detail-view.tsx` | Heavy client entry points moved to view modules and dynamically imported wrappers; build passes | 2026-03-19 |
| PLR-030 | Reduce deep prop drilling where it harms maintainability | A28-019 | Architecture | Low | P2 | Confirmed | Verified | Unassigned | TBD | `src/components/notifications/notification-context.tsx`; `src/components/layout/dashboard-layout.tsx`; `src/components/layout/header.tsx`; `src/components/notifications/NotificationDropdown.tsx`; `src/components/notifications/NotificationBadge.tsx`; `plans/pre-launch-architecture-remediation-notes.md` | Header notification chain now consumes shared context for identity/unread state; prop drilling reduced | 2026-03-19 |
| PLR-031 | Eliminate circular dependency risks in RBAC modules | A28-020 | Architecture | Medium | P2 | Partially Confirmed | Verified | Unassigned | TBD | `src/lib/rbac/types.ts`; `src/lib/rbac/access.ts`; `src/lib/rbac/permissions.ts`; `src/lib/rbac/email-workspace.ts`; `__tests__/unit/lib/rbac/boundaries.test.ts` | Shared contract types are isolated and the RBAC barrel is no longer used internally | 2026-03-19 |
| PLR-032 | Clarify module boundaries and concern separation | A28-021 | Architecture | Low | P2 | Confirmed | Verified | Unassigned | TBD | `plans/pre-launch-schema-rbac-policy.md` | RBAC ownership and import rules documented | 2026-03-19 |
| PLR-033 | Replace N+1 email campaign send loop with scalable batching/queueing | A28-022 | Performance | High | P1 | Confirmed | Verified | Unassigned | TBD | src/lib/actions/email-campaigns.ts | Recipient sends now run in bounded batches; queue-based offload remains future work | 2026-03-19 |
| PLR-034 | Add pagination controls in server-action list queries | A28-023 | Performance | Medium | P1 | Confirmed | Verified | Unassigned | TBD | src/lib/actions/email-campaigns.ts; src/app/manage/emails/manager-emails-client.tsx; src/app/system/emails/emails-page-client.tsx; __tests__/unit/lib/utils/pagination.test.ts | Campaign lists now page server-side and expose pagination metadata to clients | 2026-03-19 |
| PLR-035 | Enforce production cache backend requirements | A28-024 | Reliability | Medium | P1 | Confirmed | Verified | Unassigned | TBD | src/lib/utils/cache.ts; __tests__/unit/lib/utils/cache.test.ts | Production startup fails fast without configured Redis-backed cache; in-memory store remains dev fallback | 2026-03-19 |
| PLR-036 | Optimize permission check performance and caching strategy | A28-025 | Performance | Medium | P1 | Confirmed | Verified | Unassigned | TBD | src/lib/rbac/permissions.ts; __tests__/unit/lib/rbac/access.test.ts | Permission snapshots are cached and reused across repeated checks; TTL staleness remains until invalidation | 2026-03-19 |
| PLR-037 | Improve real-time dashboard strategy (reduce polling load) | A28-026 | Performance | Medium | P1 | Confirmed | Verified | Unassigned | TBD | src/components/notifications/NotificationBadge.tsx | Polling now backs off to 60s and pauses while hidden, resuming on visibility/focus | 2026-03-19 |
| PLR-038 | Add baseline rate limiting to all public endpoints | A28-027 | Security | High | P0 | Confirmed | Verified | Unassigned | TBD | Security-controls test suite | Upload and webhook endpoints enforce baseline rate limits | 2026-03-19 |
| PLR-039 | Complete API route authentication/authorization coverage audit | A28-028 | Security | High | P0 | Confirmed | Verified | Unassigned | TBD | Security-controls test suite | Upload, webhook, and cron route auth tests added | 2026-03-19 |
| PLR-040 | Prevent invite-management runtime crash from invalid date parsing | NEW-001 | Reliability | High | P1 | Confirmed | Verified | Unassigned | TBD | `src/app/system/invites/invites-page-enhanced.tsx`; `npm run type-check`; `npm run build` | Invite date rendering now guards invalid/serialized values and no longer throws `Invalid time value` | 2026-03-20 |
| PLR-041 | Centralize production-safe app URL resolution for auth and email links | NEW-002 | Reliability | High | P1 | Confirmed | Verified | Unassigned | TBD | `src/lib/utils/app-url.ts`; `src/lib/actions/auth.ts`; `src/lib/actions/invites.ts`; `src/lib/actions/documents/assignments.ts`; `src/lib/jobs/document-reminders.ts`; `src/lib/services/email/templates.ts`; `src/lib/services/email/sanitization.ts`; `src/lib/utils/audit-alert.ts`; `npm run type-check`; `npm run build` | Redirect and email links now resolve via env/`VERCEL_URL` fallback instead of localhost defaults in production paths | 2026-03-20 |

## Newly Discovered During Fixes (`NEW-*`)

| NEW ID | Title | Discovered While Fixing | Severity | Domain | Triage Result | Mapped Canonical ID | Execution Status | Evidence | Last Updated |
|---|---|---|---|---|---|---|---|---|---|
| NEW-001 | Invite page crash from invalid date formatting (`parseISO(date.toString())`) | PLR-011 | High | Reliability | Confirmed and fixed in same cycle | PLR-040 | Verified | `src/app/system/invites/invites-page-enhanced.tsx`; `npm run type-check`; `npm run build` | 2026-03-20 |
| NEW-002 | Production auth/email links could resolve to localhost/undefined when app URL env missing | PLR-011 | High | Reliability | Confirmed and fixed in same cycle | PLR-041 | Verified | `src/lib/utils/app-url.ts` + auth/invite/email callsite updates; `npm run type-check`; `npm run build` | 2026-03-20 |

## Launch Gate

### Unresolved `P0` Issues (Must Be `Verified` Before Public Launch)

- None

### Unresolved `P1` Issues (Strongly Recommended Before Launch)

- None

## Validation Checklist (Tracker Integrity)

1. Completeness: 43 raw findings exist with unique IDs (`I13-*`, `A28-*`, `NEW-*`).
2. Coverage: every raw row maps to a canonical `PLR-*`.
3. Accounting: `Fixed + Pending (non-blocked) + Blocked + Invalid = Canonical`.
4. Workflow: status transitions logged with evidence.
5. Discovery: all newly found issues enter `NEW-*` table immediately and are mapped.
