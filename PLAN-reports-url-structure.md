# Plan: Separate Reports URLs for Admin vs Manager

## STATUS: IMPLEMENTED

## Current Situation

**Issue:** Both Admins and Managers access reports via `/admin/reports/*`
- URL path `/admin/` suggests admin-only feature
- Confusing for managers who see "admin" in their URL
- Same URL for different permission levels

**Current Access Control (working correctly):**
- Pages use `requireAnyPermission([{ resource: "reports", action: "view_team" }, { resource: "reports", action: "view_all" }])`
- Managers have `view_team` permission (see their venue's staff)
- Admins bypass checks (see all staff across all venues)
- Data is already scoped correctly by `getSharedVenueUsers()`

**Current Routes (all under `/admin/reports/`):**
- `/admin/reports` - Dashboard
- `/admin/reports/availability-matrix`
- `/admin/reports/coverage`
- `/admin/reports/conflicts`
- `/admin/reports/calendar`
- `/admin/reports/time-off`
- `/admin/reports/suggestions`
- `/admin/reports/ai-chat`

---

## Proposed Solution

### Option A: Create Separate `/reports` Route for Managers (Recommended)

Create new `/reports/*` routes for managers, keep `/admin/reports/*` for admins.

**New Structure:**
```
/reports/*              <- For MANAGERS (team-scoped data)
  /reports
  /reports/availability-matrix
  /reports/coverage
  /reports/conflicts
  /reports/calendar
  /reports/time-off
  /reports/ai-chat

/admin/reports/*        <- For ADMINS (system-wide data)
  (same sub-routes)
```

**Benefits:**
- Clear URL semantics (managers don't see "admin")
- Separate pages allow for role-specific UI
- Admin reports could show cross-venue comparisons
- Future: Admin could have additional system-wide reports

**Implementation Steps:**
1. Create `/src/app/(dashboard)/reports/` directory structure
2. Create route files that reuse existing components
3. Update sidebar navigation to point managers to `/reports`
4. Admin routes remain at `/admin/reports`
5. Add redirects: managers hitting `/admin/reports` -> `/reports`

**Files to Create:**
- `/src/app/(dashboard)/reports/page.tsx`
- `/src/app/(dashboard)/reports/availability-matrix/page.tsx`
- `/src/app/(dashboard)/reports/coverage/page.tsx`
- `/src/app/(dashboard)/reports/conflicts/page.tsx`
- `/src/app/(dashboard)/reports/calendar/page.tsx`
- `/src/app/(dashboard)/reports/time-off/page.tsx`
- `/src/app/(dashboard)/reports/ai-chat/page.tsx`

**Files to Modify:**
- `/src/components/layout/sidebar.tsx` - Point managers to `/reports`
- `/src/middleware.ts` - Add redirect for managers accessing `/admin/reports`

---

### Option B: Rename `/admin/` to `/manage/` (Simpler)

Rename the entire admin section to `/manage/` which is more neutral.

**New Structure:**
```
/manage/*               <- For MANAGERS and ADMINS
  /manage/reports
  /manage/availability
  /manage/time-off
  /manage/users
  etc.
```

**Benefits:**
- Simpler change (rename not duplicate)
- "/manage" is role-neutral

**Drawbacks:**
- Still same URL for both roles
- Breaking change for bookmarks/links

---

## Recommendation

**Go with Option A** - Create separate `/reports` routes for managers.

This is cleaner, more semantic, and allows for future differentiation between manager and admin report views.

---

## Questions for User

1. Should manager reports have different features than admin reports?
   - E.g., Admin sees cross-venue comparisons, managers see only their venues

2. Should we also separate other shared routes like `/admin/availability`, `/admin/time-off`?
   - Could create `/team/availability`, `/team/time-off` for managers

3. What should happen when a manager navigates to `/admin/reports`?
   - Redirect to `/reports`?
   - Show 403 forbidden?
   - Allow access (current behavior)?
