# Plan: Platform-Wide URL Architecture Redesign

## STATUS: AWAITING APPROVAL

---

## Executive Summary

Redesign the entire URL structure to be semantically correct, role-appropriate, and future-proof. The current `/admin/*` prefix for manager-accessible routes is confusing and misleading.

---

## Current Problems

### 1. Semantic Mismatch
Managers access URLs prefixed with `/admin/` which implies system administrator access:
- `/admin/availability` - Managers see "admin" but they're not admins
- `/admin/time-off` - Same issue
- `/admin/channels` - Same issue
- `/admin/users` - Same issue

### 2. Mental Model Confusion
- Users don't know which routes are truly admin-only
- The URL doesn't communicate access level
- Hard to explain to new users

### 3. Current Route Analysis

| Route | Current Access | Actual Purpose |
|-------|---------------|----------------|
| `/admin/availability` | ADMIN + MANAGER | Team management |
| `/admin/time-off` | ADMIN + MANAGER | Team management |
| `/admin/reports` | ADMIN + MANAGER | Team/System reports |
| `/admin/channels` | ADMIN + MANAGER | Communication management |
| `/admin/users` | ADMIN + MANAGER | Team/User management |
| `/admin/roles` | ADMIN only | System configuration |
| `/admin/stores` | ADMIN only | System configuration |
| `/admin/audit` | ADMIN only | System monitoring |
| `/admin/notifications` | ADMIN only | System announcements |
| `/admin/venue-permissions` | ADMIN only | System configuration |

---

## Proposed URL Architecture

### Option A: Three-Tier Hierarchy (Recommended)

```
/                           - Home/Landing
├── /dashboard              - Personal dashboard (all users)
│
├── /my/                    - Personal features (all users)
│   ├── /my/availability    - My availability settings
│   ├── /my/time-off        - My time-off requests
│   ├── /my/profile         - My profile
│   └── /my/settings        - My preferences
│
├── /manage/                - Team management (MANAGER + ADMIN)
│   ├── /manage/availability    - Team availability overview
│   ├── /manage/time-off        - Time-off approvals
│   ├── /manage/reports         - Team reports & analytics
│   ├── /manage/channels        - Channel management
│   └── /manage/users           - Team member management
│
├── /system/                - System administration (ADMIN only)
│   ├── /system/roles           - Role configuration
│   ├── /system/venues          - Venue management
│   ├── /system/audit           - Audit logs
│   ├── /system/announcements   - System-wide announcements
│   ├── /system/permissions     - Venue permissions
│   └── /system/reports         - Cross-venue system reports
│
└── /shared/                - Shared features (all users)
    ├── /posts              - Company posts
    ├── /messages           - Direct messages
    └── /notifications      - Personal notifications
```

**Benefits:**
- Clear semantic meaning at every level
- `/my/` = personal, `/manage/` = team, `/system/` = admin
- Easy to understand and navigate
- Future-proof for new features
- RBAC still handles actual access control

**URL Examples:**
- Staff member: `/my/availability`, `/my/time-off`, `/posts`
- Manager: All above + `/manage/availability`, `/manage/time-off`, `/manage/reports`
- Admin: All above + `/system/roles`, `/system/venues`, `/system/reports`

---

### Option B: Feature-Based (No Role Prefix)

```
/dashboard
/availability               - Personal availability
/staff-availability         - Team view
/time-off                   - Personal
/time-off-approvals         - Approvals
/reports                    - Reports (scoped by role)
/channels
/users
/roles                      - Admin only
/venues                     - Admin only
/audit                      - Admin only
```

**Pros:** Simpler, flatter structure
**Cons:** Less clear hierarchy, harder to group related features

---

### Option C: Keep Admin, Add Team Prefix

```
/team/                      - Manager-level features
  /team/availability
  /team/time-off
  /team/reports
  /team/users

/admin/                     - Admin-only features
  /admin/roles
  /admin/venues
  /admin/audit
  /admin/reports            - System-wide
```

**Pros:** Minimal changes to admin routes
**Cons:** "Team" might be too limiting

---

## Recommendation: Option A

The three-tier hierarchy (`/my/`, `/manage/`, `/system/`) provides:

1. **Clear semantics** - URL tells you what level of access you're using
2. **Scalability** - Easy to add new features under the right prefix
3. **User-friendly** - Intuitive for all user types
4. **Consistent** - Same pattern applies everywhere

---

## Implementation Plan

### Phase 1: Create New Route Structure
1. Create `/my/*` routes (move personal features)
2. Create `/manage/*` routes (new management routes)
3. Create `/system/*` routes (new admin-only routes)

### Phase 2: Add Redirects
1. Redirect old `/admin/*` routes to appropriate new locations
2. Redirect `/availability` to `/my/availability`
3. Redirect `/time-off` to `/my/time-off`
4. Keep redirects for 3-6 months for backward compatibility

### Phase 3: Update Navigation
1. Update sidebar to use new URLs
2. Update all internal links
3. Update any hardcoded URLs in components

### Phase 4: Cleanup
1. Remove old route files after redirect period
2. Update documentation
3. Remove redirect rules

---

## Route Migration Map

| Old Route | New Route | Access |
|-----------|-----------|--------|
| `/availability` | `/my/availability` | ALL |
| `/time-off` | `/my/time-off` | ALL |
| `/settings/profile` | `/my/profile` | ALL |
| `/settings` | `/my/settings` | ALL |
| `/admin/availability` | `/manage/availability` | MANAGER+ |
| `/admin/time-off` | `/manage/time-off` | MANAGER+ |
| `/admin/channels` | `/manage/channels` | MANAGER+ |
| `/admin/users` | `/manage/users` | MANAGER+ |
| `/reports` | `/manage/reports` | MANAGER |
| `/admin/reports` | `/system/reports` | ADMIN |
| `/admin/roles` | `/system/roles` | ADMIN |
| `/admin/stores` | `/system/venues` | ADMIN |
| `/admin/audit` | `/system/audit` | ADMIN |
| `/admin/notifications` | `/system/announcements` | ADMIN |
| `/admin/venue-permissions` | `/system/permissions` | ADMIN |

---

## Sidebar Navigation Structure

### For STAFF:
```
PERSONAL
  Dashboard         /dashboard
  My Availability   /my/availability
  My Time Off       /my/time-off

COMMUNITY
  Posts             /posts
  Messages          /messages

ACCOUNT
  Notifications     /notifications
  Profile           /my/profile
  Settings          /my/settings
```

### For MANAGER (adds):
```
TEAM MANAGEMENT
  Staff Availability   /manage/availability
  Time-Off Approvals   /manage/time-off
  Reports & Analytics  /manage/reports
  Channels             /manage/channels
  Team Members         /manage/users
```

### For ADMIN (adds):
```
SYSTEM
  Roles              /system/roles
  Venues             /system/venues
  Audit Logs         /system/audit
  Announcements      /system/announcements
  Permissions        /system/permissions
  System Reports     /system/reports
```

---

## Files to Create/Modify

### New Directories:
- `/src/app/my/`
- `/src/app/manage/`
- `/src/app/system/`

### Files to Create (approximately 20+ route files):
- `/src/app/my/availability/page.tsx`
- `/src/app/my/time-off/page.tsx`
- `/src/app/my/profile/page.tsx`
- `/src/app/my/settings/page.tsx`
- `/src/app/manage/availability/page.tsx`
- `/src/app/manage/time-off/page.tsx`
- `/src/app/manage/reports/page.tsx` (+ sub-routes)
- `/src/app/manage/channels/page.tsx`
- `/src/app/manage/users/page.tsx`
- `/src/app/system/roles/page.tsx`
- `/src/app/system/venues/page.tsx`
- `/src/app/system/audit/page.tsx`
- `/src/app/system/announcements/page.tsx`
- `/src/app/system/permissions/page.tsx`
- `/src/app/system/reports/page.tsx` (+ sub-routes)

### Files to Modify:
- `/src/components/layout/sidebar.tsx` - Complete restructure
- `/middleware.ts` - Add redirect rules
- All components with hardcoded links

---

## Estimated Effort

- **Phase 1:** 2-3 hours (create new routes)
- **Phase 2:** 1 hour (add redirects)
- **Phase 3:** 1-2 hours (update navigation & links)
- **Phase 4:** 30 minutes (cleanup, after deprecation period)

**Total: ~5-6 hours of implementation**

---

## Questions for Approval

1. **Do you prefer Option A (three-tier) or another option?**

2. **Should we keep backward-compatible redirects?**
   - Yes: Old URLs continue to work (recommended)
   - No: Clean break, old URLs return 404

3. **What about the already-implemented `/reports` separation?**
   - Integrate into new structure (`/manage/reports` and `/system/reports`)
   - Keep as-is for now

4. **Timeline preference?**
   - Implement all at once
   - Implement in phases (my/manage/system separately)

---

## Alternative: Minimal Change Approach

If the full restructure seems too disruptive, we could:

1. Just rename `/admin/` to `/manage/` for shared routes
2. Keep true admin routes at `/admin/`
3. Less work, but less clean

This would look like:
```
/manage/availability    (was /admin/availability)
/manage/time-off        (was /admin/time-off)
/manage/channels        (was /admin/channels)
/manage/users           (was /admin/users)
/manage/reports         (was /reports for managers)

/admin/roles            (stays)
/admin/venues           (was /admin/stores)
/admin/audit            (stays)
/admin/reports          (system-wide reports)
```

---

## Ready for Your Decision

Please review and let me know:
1. Which option you prefer (A, B, C, or Minimal)
2. Any modifications to the proposed structure
3. Whether to proceed with implementation
