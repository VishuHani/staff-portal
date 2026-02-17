# Permission Stack Enhancement Documentation

## Overview

This document describes the comprehensive enhancements made to the permission stack in the Staff Portal application. The permission system now provides:

1. **Complete Audit Trail** - All permission changes are logged with IP addresses
2. **User Notifications** - Users are notified when permissions are granted or revoked
3. **User Profile Permission Display** - Users can view their own permissions
4. **Bulk Permission Operations** - Admins can grant permissions by role or to multiple users
5. **Unified Permission Checking** - Simplified API for permission checks

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PERMISSION STACK                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │   Core RBAC      │    │   Advanced       │                   │
│  │   permissions.ts │◄───┤   permissions.ts │                   │
│  │   access.ts      │    │   (field-level,  │                   │
│  │                  │    │   conditional,   │                   │
│  │                  │    │   time-based)    │                   │
│  └────────┬─────────┘    └──────────────────┘                   │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Permission Management Layer                  │   │
│  │  ┌─────────────────┐    ┌─────────────────────────────┐  │   │
│  │  │ roles.ts        │    │ venue-permissions.ts        │  │   │
│  │  │ - Role CRUD     │    │ - Venue-scoped permissions  │  │   │
│  │  │ - Permission    │    │ - Bulk operations           │  │   │
│  │  │   assignment    │    │ - IP capture + audit        │  │   │
│  │  └─────────────────┘    └─────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Database Layer                         │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │   │
│  │  │ Permission  │ │ Role        │ │ UserVenuePermission │ │   │
│  │  │ (resource,  │ │ RolePermis- │ │ (userId, venueId,   │ │   │
│  │  │  action)    │ │ sion        │ │  permissionId)      │ │   │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Files Modified

### 1. Database Schema (`prisma/schema.prisma`)
- Added `PERMISSION_GRANTED` and `PERMISSION_REVOKED` notification types

### 2. Notification Service (`src/lib/services/notifications.ts`)
Added three new notification functions:
- `notifyPermissionGranted()` - Notify user when permission is granted
- `notifyPermissionRevoked()` - Notify user when permission is revoked
- `notifyPermissionsBulkChanged()` - Notify user when multiple permissions change

### 3. Venue Permissions Actions (`src/lib/actions/admin/venue-permissions.ts`)
Enhanced with:
- IP address capture using `getAuditContext()`
- User notifications on permission changes
- New bulk operations:
  - `bulkGrantPermissionsByRole()` - Grant permissions to all users with a role at a venue
  - `bulkGrantPermissionsToUsers()` - Grant permissions to multiple users at a venue

### 4. Core Permissions (`src/lib/rbac/permissions.ts`)
Added unified permission check functions:
- `checkPermission()` - Single entry point for permission checks
- `checkPermissions()` - Check multiple permissions with detailed results

### 5. Users Table Component (`src/components/admin/UsersTable.tsx`)
Fixed:
- Replaced `window.location.reload()` with `router.refresh()`

### 6. New User Permissions Page
Created:
- `src/app/my/settings/permissions/page.tsx` - Server component
- `src/app/my/settings/permissions/permissions-display-client.tsx` - Client component

## Permission Check Flow

```typescript
// Basic permission check
import { checkPermission } from "@/lib/rbac/permissions";

const canEdit = await checkPermission(userId, "rosters", "edit", { venueId });

// Multiple permission check
import { checkPermissions } from "@/lib/rbac/permissions";

const result = await checkPermissions(userId, [
  { resource: "rosters", action: "view_team" },
  { resource: "rosters", action: "edit_team" },
], venueId);

if (result.allowed) {
  // All permissions granted
} else {
  // Check which failed
  result.results.forEach(r => {
    if (!r.allowed) {
      console.log(`Missing: ${r.resource}:${r.action}`);
    }
  });
}
```

## Audit Log Events

| Action Type | Description | Data Logged |
|-------------|-------------|-------------|
| `VENUE_PERMISSION_GRANTED` | Single permission granted | userId, venueId, permission, IP |
| `VENUE_PERMISSION_REVOKED` | Single permission revoked | userId, venueId, permission, IP |
| `VENUE_PERMISSIONS_BULK_UPDATED` | Bulk update for user | old/new permission IDs, IP |
| `VENUE_PERMISSIONS_BULK_GRANTED_BY_ROLE` | Grant by role | roleId, venueId, userCount, IP |
| `VENUE_PERMISSIONS_BULK_GRANTED_TO_USERS` | Grant to multiple users | userIds, venueId, permissionIds, IP |

## User Notification Flow

```
Permission Change
       │
       ▼
┌──────────────────┐
│ Server Action    │
│ (grant/revoke)   │
└────────┬─────────┘
         │
         ├──────────────────────┐
         │                      │
         ▼                      ▼
┌──────────────────┐   ┌──────────────────┐
│ Create Audit Log │   │ Send Notification│
│ (with IP)        │   │ (IN_APP + EMAIL) │
└──────────────────┘   └──────────────────┘
```

## User Profile Permission Display

Users can view their permissions at `/my/settings/permissions`:

- **Role Permissions**: Permissions inherited from their role
- **Venue-Specific Permissions**: Additional permissions granted at specific venues
- **Permission Summary**: Total counts and breakdowns

## Bulk Permission Operations

### Grant by Role
```typescript
import { bulkGrantPermissionsByRole } from "@/lib/actions/admin/venue-permissions";

const result = await bulkGrantPermissionsByRole(
  roleId,      // Target role
  venueId,     // Target venue
  permissionIds // Permissions to grant
);
```

### Grant to Multiple Users
```typescript
import { bulkGrantPermissionsToUsers } from "@/lib/actions/admin/venue-permissions";

const result = await bulkGrantPermissionsToUsers(
  userIds,     // Array of user IDs
  venueId,     // Target venue
  permissionIds // Permissions to grant
);
```

## Permission Hierarchy

1. **Admin Bypass**: Admins bypass all permission checks
2. **Role Permissions**: Base permissions from role assignment
3. **Venue-Specific Permissions**: Additional permissions at specific venues
4. **Permission Union**: User has permission if granted via role OR venue

## Security Considerations

1. **IP Address Capture**: All permission changes log the IP address
2. **Self-Modification Prevention**: Users cannot modify their own permissions
3. **Admin Protection**: Only admins can modify admin permissions
4. **Role Protection**: System roles (ADMIN, MANAGER, STAFF) cannot be renamed/deleted
5. **Venue Scoping**: Managers can only manage permissions at their assigned venues

## Testing Checklist

- [ ] Grant single permission → Audit log created, user notified
- [ ] Revoke single permission → Audit log created, user notified
- [ ] Bulk update permissions → Audit log created, user notified
- [ ] Grant by role → All users with role receive permissions and notifications
- [ ] Grant to multiple users → All users receive permissions and notifications
- [ ] View own permissions → Shows role + venue-specific permissions
- [ ] Permission check with venue context → Returns correct result
- [ ] Admin bypass → Admin has all permissions
- [ ] Self-modification blocked → Cannot edit own permissions

## Future Enhancements

1. **Permission Templates**: Pre-defined permission sets for common roles
2. **Permission Expiration**: Time-limited permission grants
3. **Permission Request Workflow**: Users can request additional permissions
4. **Permission Analytics**: Dashboard showing permission distribution
5. **Bulk Revoke Operations**: Revoke permissions by role or multiple users
