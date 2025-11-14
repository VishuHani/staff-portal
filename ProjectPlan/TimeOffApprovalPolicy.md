# Time-Off Approval Policy

**Last Updated:** November 14, 2025
**Version:** 1.0
**Status:** Active

---

## Overview

This document defines the approval workflow for time-off requests in the Staff Portal multi-venue system.

## Primary Venue Approval Model

### Core Policy

**Time-off requests are approved by managers who have access to the requester's PRIMARY venue.**

### How It Works

1. **Primary Venue Determination**
   - Each user has one "primary" venue marked with `isPrimary: true` in the `UserVenue` junction table
   - If no primary venue is explicitly set, the system uses the user's `venueId` field as a fallback
   - Users can be assigned to multiple venues, but only ONE is considered primary for approval purposes

2. **Approval Authority**
   - Managers can approve time-off requests for users whose primary venue matches one of the manager's assigned venues
   - This is enforced through venue-scoped permission checks using `canAccessVenue("timeoff", "approve", venueId)`
   - Admins can approve requests across all venues (global permission)

3. **Venue Filtering**
   - The `getSharedVenueUsers(managerId)` function returns all users who share at least one venue with the manager
   - Time-off requests are filtered to only show requests from these shared-venue users
   - This prevents managers from seeing or acting on requests from users in venues they don't manage

### Implementation Details

**File:** `src/lib/actions/time-off.ts`
**Function:** `reviewTimeOffRequest()`
**Lines:** 405-427

```typescript
// Get requester's primary venue
const requesterPrimaryVenue = request.user.venues.find((uv) => uv.isPrimary);

if (!requesterPrimaryVenue) {
  // Fallback to global permission check if no venue assigned
  const hasAccess = await canAccess("timeoff", "approve");
  if (!hasAccess) {
    return { error: "You don't have permission to review time-off requests" };
  }
} else {
  // VENUE-SCOPED PERMISSION CHECK
  const hasVenueAccess = await canAccessVenue(
    "timeoff",
    "approve",
    requesterPrimaryVenue.venueId
  );

  if (!hasVenueAccess) {
    return {
      error: `You don't have permission to approve time-off requests for ${requesterPrimaryVenue.venue.name}`
    };
  }
}
```

## User Scenarios

### Scenario 1: Single-Venue Manager

**Setup:**
- Manager A is assigned to "Downtown" venue
- Staff Member B has "Downtown" as primary venue

**Result:**
- Manager A can see and approve Staff Member B's time-off requests
- This is the simplest and most common case

### Scenario 2: Multi-Venue Manager

**Setup:**
- Manager A is assigned to both "Downtown" and "Westside" venues
- Staff Member B has "Downtown" as primary venue
- Staff Member C has "Westside" as primary venue
- Staff Member D has "Northside" as primary venue (not assigned to Manager A)

**Result:**
- Manager A can approve requests from Staff Member B (Downtown primary)
- Manager A can approve requests from Staff Member C (Westside primary)
- Manager A CANNOT see or approve requests from Staff Member D (no shared venues)

### Scenario 3: Multi-Venue Staff Member

**Setup:**
- Staff Member B works at multiple venues: "Downtown" (primary), "Westside", "Airport"
- Manager A is assigned to "Downtown" venue only
- Manager C is assigned to "Westside" venue only

**Result:**
- Manager A can approve Staff Member B's time-off (primary venue match)
- Manager C CANNOT approve Staff Member B's time-off (primary venue mismatch)
- Even though Staff Member B works at Westside, their primary venue is Downtown

**Rationale:** This prevents confusion about who has approval authority. One manager (at the primary venue) is clearly responsible.

### Scenario 4: Admin User

**Setup:**
- Admin user (role: ADMIN)
- Any staff member at any venue

**Result:**
- Admin can approve time-off for ALL users across ALL venues
- Admin permission checks bypass venue-scoping

## Edge Cases

### No Primary Venue Assigned

If a user has no primary venue explicitly set:
1. System falls back to user's `venueId` field
2. If `venueId` is also null, manager needs GLOBAL `timeoff:approve` permission
3. Recommended: Always assign a primary venue to avoid ambiguity

### User Changes Primary Venue

If a staff member's primary venue changes:
- Pending requests remain visible to the old venue's managers
- Future requests go to the new venue's managers
- This is intentional to avoid approval workflow disruption

### Venue Deactivation

If a venue is marked inactive:
- Users remain assigned to it
- Managers lose access to approve requests for that venue
- Recommended: Reassign users before deactivating venues

## Security Considerations

### Double-Check Pattern

The implementation uses a "double-check" pattern for maximum security:

1. **First Check:** Venue-scoped permission via `canAccessVenue()`
2. **Second Check:** Shared venue filtering via `getSharedVenueUsers()`

```typescript
// Line 429-433
const sharedVenueUserIds = await getSharedVenueUsers(user.id);
if (!sharedVenueUserIds.includes(request.userId)) {
  return { error: "You don't have access to this time-off request" };
}
```

This redundant check ensures:
- Even if permission checks are bypassed, venue filtering catches it
- Database-level isolation prevents data leakage
- Defense in depth security strategy

### Optimistic Locking

As of Phase 2.3, concurrent approval attempts are prevented using optimistic locking:
- Version field tracks modification history
- Concurrent approvals from multiple managers are detected
- First approval wins, second gets error: "modified by another user"

## Testing Checklist

- [ ] Manager at venue A can approve staff with venue A as primary
- [ ] Manager at venue A cannot approve staff with venue B as primary
- [ ] Multi-venue manager sees requests from all assigned venues
- [ ] Multi-venue staff requests go to primary venue manager only
- [ ] Admin can approve requests across all venues
- [ ] User without primary venue uses fallback logic correctly
- [ ] Venue filtering prevents unauthorized access
- [ ] Error messages clearly indicate venue-related permission issues

## Related Documentation

- **RBAC System:** `src/lib/rbac/permissions.ts`
- **Venue Utilities:** `src/lib/utils/venue.ts`
- **Time-Off Actions:** `src/lib/actions/time-off.ts`
- **Working Features:** `ProjectPlan/WORKING_FEATURES.md`

## Future Enhancements

### Potential Improvements (Not Implemented)

1. **Approval Delegation**
   - Allow managers to delegate approval authority temporarily
   - Useful for manager vacations or workload balancing

2. **Multi-Approver Workflow**
   - Require approval from multiple venues for cross-venue requests
   - Could be useful for staff who work significant hours across multiple locations

3. **Approval Routing Configuration**
   - Allow admins to configure custom approval rules per venue
   - More flexible than the current "primary venue only" model

4. **Automatic Escalation**
   - If no manager available at primary venue, escalate to admin
   - Prevents requests from being stuck in pending state

## Change History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-11-14 | 1.0 | Initial policy documentation | Claude Code |

---

**Questions or Issues?**
Contact system administrators or refer to the RBAC documentation for permission configuration details.
