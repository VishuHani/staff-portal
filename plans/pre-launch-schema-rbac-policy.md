# Pre-Launch Schema and RBAC Policy

Date: 2026-03-19

## Scope

This note records the schema and RBAC boundary decisions applied during the launch hardening pass.

## Uniqueness Policy

1. `email_folders` enforces a case-insensitive unique constraint on `(module, parentId, lower(name))`.
2. Email workspace folder creation must continue to treat sibling names as case-insensitive.
3. Additional uniqueness constraints should only be added when the existing application logic already treats the fields as a natural key and the data model can support the constraint without destructive cleanup.

## Cascade Policy

1. Venue-scoped email workspace records keep a `SET NULL` venue relation where the app already supports venue-less retention.
2. Pure link tables should cascade when either side is deleted. `template_library_imports` follows this rule.
3. Historical operational records that are still used for audit or debugging should remain non-destructive until their retention policy is reviewed separately.

## RBAC Boundary Policy

1. Shared permission contract types live in `src/lib/rbac/types.ts`.
2. Runtime permission checks live in `src/lib/rbac/permissions.ts`.
3. Authentication-aware access helpers live in `src/lib/rbac/access.ts`.
4. RBAC modules should not import from the `src/lib/rbac` barrel during internal implementation.
5. If a new shared type is needed, add it to `src/lib/rbac/types.ts` before wiring it into runtime helpers.

## Current Notes

1. The email workspace folder duplicate-name guard is now backed by a canonical database constraint.
2. Prisma enum values used by the email system are now sourced from the generated Prisma client rather than duplicated inline.
3. Remaining venue-delete behavior for historical document and invitation records is intentionally left for a separate retention review.
