# Pre-Launch Architecture Remediation Notes

**Date:** March 19, 2026  
**Scope:** PLR-017, PLR-018, PLR-020, PLR-021, PLR-025, PLR-029, PLR-030

## 1. Route Semantics (PLR-017)

- API routes are now reviewed against method semantics:
  - `GET`: read/status only.
  - `POST`: create/trigger operations.
  - `PUT`: full updates for known resources.
  - `DELETE`: destructive removal.
- `documents/fillable` now follows this split:
  - `POST /api/documents/fillable` create fillable PDF template.
  - `POST /api/documents/fillable/fill` execute fill command for an existing PDF.
  - `GET /api/documents/fillable/fields` extract/read form fields.
- Exception documented: `GET /api/cron/jobs` remains a trigger endpoint for scheduler compatibility, while manual enqueues use `POST`.

## 2. Action Contract Standardization (PLR-018)

- Shared action contract helpers are the canonical return pattern:
  - `actionSuccess(...)`
  - `actionFailure(...)`
  - `ActionResult<T>`
- Applied across profile, conversations, messages, posts, admin users/roles, roster approval/management, and email approval actions.
- Rule: all new server actions must return explicit `ActionResult<T>` and avoid ad-hoc return shapes.

## 3. Error Taxonomy and Logging (PLR-020)

- Structured action logging standard:
  - `logActionError("<domain>.<action>", error, context)`
- Applied across profile, conversation, messaging, posts, admin users/roles, roster, and campaign approval action surfaces.
- Rule: new server actions must emit tagged structured logs in `catch` blocks.

## 4. Revalidation Strategy (PLR-021)

- Canonical invalidation helper:
  - `revalidatePaths(pathA, pathB, ...)`
- Applied to email, profile, posts, conversations, admin users/roles, and roster actions to deduplicate and centralize invalidation.
- Rule: avoid multiple ad-hoc `revalidatePath(...)` calls in sequence.

## 5. User Model Boundary (PLR-025)

- `User` fetches used for auth context now use explicit select projection:
  - `src/lib/users/selectors.ts -> userAuthContextSelect`
- `getCurrentUser()` now pulls only auth/session-required fields + permission relations instead of full wide `User` scalar payload.
- Follow-up stage (post-launch): split sensitive employment/payroll profile to dedicated read paths where needed.

## 6. Large Client Components and Prop Strategy (PLR-029, PLR-030)

- Heavy route entry components were split into thin wrappers + view modules:
  - `campaign-detail-client` -> `campaign-detail-view`
  - `my-shifts-client` -> `my-shifts-view`
- Route entry wrappers now lazy-load the heavy views using `next/dynamic`.
- Notification header chain now uses shared context:
  - `NotificationProvider` in `dashboard-layout`
  - `NotificationDropdown` and `NotificationBadge` consume context directly (reduced prop drilling).
- Composition rule:
  - keep route-level client entry files lightweight,
  - isolate heavy rendering logic in feature view files,
  - avoid deep prop chains by keeping state/handlers co-located in feature modules.
