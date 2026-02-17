# Ultra-Granular Permission System

## Overview

The Staff Portal implements an enterprise-grade permission system that provides fine-grained access control at multiple levels:

1. **Resource-Level Permissions** - Control access to different areas of the application
2. **Action-Level Permissions** - Control what operations can be performed
3. **Field-Level Permissions** - Control access to specific data fields
4. **Conditional Permissions** - Context-based access rules
5. **Time-Based Access** - Temporal access restrictions
6. **Venue-Scoped Permissions** - Location-based access control

## Architecture

```
src/lib/rbac/
  index.ts                    # Main entry point
  permissions.ts              # Core RBAC (resources, actions, hasPermission)
  access.ts                   # Access helpers (canAccess, requireAuth)
  field-permissions.ts        # Field-level access control
  conditional-permissions.ts  # Context-based permission rules
  time-based-access.ts        # Time-restricted access
  advanced-permissions.ts     # Combined advanced checks
```

## Permission Resources

### Core Resources
| Resource | Description |
|----------|-------------|
| `users` | User management |
| `roles` | Role management |
| `stores` / `venues` | Venue/store settings |
| `positions` | Venue positions |

### Scheduling Resources
| Resource | Description |
|----------|-------------|
| `availability` | Staff availability |
| `timeoff` | Time-off requests |
| `rosters` | Roster management |
| `schedules` | Schedule viewing |

### Communication Resources
| Resource | Description |
|----------|-------------|
| `posts` | Channel posts |
| `comments` | Post comments |
| `reactions` | Emoji reactions |
| `messages` | Direct messages |
| `conversations` | DM threads |
| `channels` | Communication channels |

### Intelligence Resources
| Resource | Description |
|----------|-------------|
| `ai` | AI features (chat, suggestions) |
| `reports` | Reports and analytics |

### System Resources
| Resource | Description |
|----------|-------------|
| `audit` | Audit logs |
| `notifications` | User notifications |
| `announcements` | System announcements |
| `settings` | User/system settings |
| `media` | File uploads |
| `dashboard` | Dashboard widgets |
| `profile` | User profiles |
| `admin` | Admin functions |

## Permission Actions

### Basic CRUD
- `create`, `read`, `update`, `delete`, `edit`, `manage`

### Scope-Based
- `view_own`, `view_team`, `view_all`
- `edit_own`, `edit_team`, `edit_all`
- `delete_own`, `delete_all`

### Workflow
- `approve`, `reject`, `cancel`, `publish`
- `submit`, `recall`, `finalize`

### Data Operations
- `export`, `export_team`, `export_all`, `export_anonymized`
- `import`, `import_own`, `import_team`, `import_all`

### Content Moderation
- `moderate`, `pin`, `unpin`, `archive`, `restore`

### Bulk Operations
- `bulk_create`, `bulk_update`, `bulk_delete`, `bulk_assign`

### Admin Actions
- `manage_users`, `manage_roles`, `manage_stores`
- `manage_permissions`, `manage_settings`, `manage_positions`
- `view_audit_logs`, `impersonate`, `deactivate`, `reactivate`

### Sensitive Data
- `view_sensitive` - Access to sensitive fields (pay rates, SSN, etc.)

### AI Actions
- `view_ai`, `use_ai`, `manage_ai`

## Usage Examples

### Basic Permission Check

```typescript
import { hasPermission, canAccess } from "@/lib/rbac";

// Server-side with userId
const canEdit = await hasPermission(userId, "rosters", "edit");

// Server-side with current user
const canView = await canAccess("reports", "view_team");
```

### Venue-Scoped Permission

```typescript
import { hasPermission, canAccessVenue } from "@/lib/rbac";

// Check permission at specific venue
const canEditAtVenue = await hasPermission(
  userId,
  "rosters",
  "edit",
  venueId
);

// With current user
const canViewAtVenue = await canAccessVenue(
  "reports",
  "view_team",
  venueId
);
```

### Multiple Permission Check

```typescript
import { checkPermissions } from "@/lib/rbac";

const result = await checkPermissions(userId, [
  { resource: "rosters", action: "view_team" },
  { resource: "rosters", action: "edit_team" },
  { resource: "rosters", action: "publish" },
], venueId);

if (result.allowed) {
  // All permissions granted
} else {
  // Check which failed
  const failed = result.results.filter(r => !r.allowed);
}
```

### Field-Level Permission

```typescript
import { 
  getAccessibleFields, 
  filterAccessibleFields,
  validateFieldAccess 
} from "@/lib/rbac";

// Get accessible fields for a resource
const { fields, accessLevels } = await getAccessibleFields({
  userId,
  resource: "users",
  action: "edit",
  targetUserId: targetUser.id,
});

// Filter data to only accessible fields
const filteredData = await filterAccessibleFields(
  { userId, resource: "users", action: "edit" },
  userData
);

// Validate that data only contains accessible fields
await validateFieldAccess(
  { userId, resource: "users", action: "edit" },
  updateData
);
```

### Conditional Permission

```typescript
import { evaluateConditionalPermission } from "@/lib/rbac";

// Evaluate with resource data
const result = await evaluateConditionalPermission({
  userId,
  resource: "rosters",
  action: "edit",
  resourceId: rosterId,
  venueId,
});

if (!result.allowed) {
  console.log("Failed conditions:", result.failedConditions);
}
```

### Time-Based Access

```typescript
import { checkTimeBasedAccess, getAccessStatus } from "@/lib/rbac";

// Check if user has time-based access
const hasAccess = await hasTimeBasedAccess(userId, "reports", "view_team");

// Get current access status for UI
const status = await getAccessStatus(userId);
if (!status.hasAccess) {
  console.log("Access restricted to:", status.restrictions);
}
```

### Combined Advanced Check

```typescript
import { hasAdvancedPermission } from "@/lib/rbac";

const canPerform = await hasAdvancedPermission(
  userId,
  "rosters",
  "publish",
  {
    data: { status: "APPROVED", venueId },
    checkTime: true,
    timezone: "Australia/Sydney",
  }
);
```

## Role Defaults

### ADMIN
- Bypasses all permission checks
- Full access to all resources and actions

### MANAGER
```typescript
const MANAGER_PERMISSIONS = {
  users: ["view_team", "edit_team", "view_sensitive"],
  availability: ["view_own", "edit_own", "view_team", "edit_team"],
  timeoff: ["create", "view_own", "view_team", "approve", "reject"],
  rosters: ["view_team", "create", "edit", "submit", "publish", "copy", "import", "export"],
  schedules: ["view_own", "view_team", "edit_team", "publish"],
  posts: ["create", "view", "edit_own", "delete_own", "moderate", "pin"],
  comments: ["view", "create", "edit_own", "delete_own", "moderate"],
  messages: ["send", "view"],
  channels: ["view", "create", "edit", "moderate", "assign"],
  reports: ["view_team", "export_team"],
  ai: ["view_ai", "use_ai"],
  media: ["view", "upload", "delete_own"],
  dashboard: ["view", "customize"],
};
```

### STAFF
```typescript
const STAFF_PERMISSIONS = {
  users: ["view_own", "edit_own"],
  availability: ["view_own", "edit_own"],
  timeoff: ["create", "view_own", "edit_own", "cancel"],
  rosters: ["view_own"],
  schedules: ["view_own"],
  posts: ["create", "view", "edit_own", "delete_own"],
  comments: ["view", "create", "edit_own", "delete_own"],
  reactions: ["view", "create", "delete_own"],
  messages: ["send", "view"],
  channels: ["view"],
  reports: ["view"],
  media: ["view", "upload", "delete_own"],
  dashboard: ["view"],
  profile: ["view_own", "edit_own"],
};
```

## Conditional Permission Rules

### Default Rules

| Resource | Action | Conditions |
|----------|--------|------------|
| `rosters` | `edit` | Status must be `DRAFT` or `PENDING_REVIEW` |
| `rosters` | `publish` | Status must be `APPROVED` |
| `timeoff` | `approve` | Cannot approve own request |
| `timeoff` | `cancel` | Status must be `PENDING`, must be own request |
| `users` | `edit_team` | User must be at same venue |
| `posts` | `moderate` | Post must be at user's venue |

### Creating Custom Rules

```typescript
import { createConditionalPermissionRule } from "@/lib/rbac";

await createConditionalPermissionRule(roleId, {
  resource: "rosters",
  action: "approve",
  conditions: [
    { type: "status_in", value: ["PENDING_REVIEW"] },
    { type: "venue_match" },
    { type: "not_own_record", field: "createdBy" },
  ],
  requireAll: true,
});
```

## Time-Based Access Rules

### Creating Time Rules

```typescript
import { createTimeBasedAccessRule } from "@/lib/rbac";

// Restrict reports access to business hours on weekdays
await createTimeBasedAccessRule(
  roleId,
  "reports",
  "view_team",
  {
    daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
    startTime: "08:00",
    endTime: "18:00",
    timezone: "Australia/Sydney",
  }
);
```

## Field-Level Permissions

### Sensitive Fields

| Resource | Sensitive Fields |
|----------|-----------------|
| `users` | `weekdayRate`, `saturdayRate`, `sundayRate`, `dateOfBirth`, `phone`, `bio` |
| `rosters` | `shifts.payRate`, `shifts.breakMinutes` |
| `timeoff` | `reason`, `notes` |

### Checking Field Access

```typescript
import { canAccessField, isSensitiveField } from "@/lib/rbac";

// Check if field is sensitive
if (isSensitiveField("users", "weekdayRate")) {
  // Requires view_sensitive permission
}

// Check if user can access field
const canViewPayRate = await canAccessField(
  userId,
  "users",
  "weekdayRate",
  "read"
);
```

## Database Schema

### Permission Tables

```sql
-- Permissions (resource:action pairs)
Permission {
  id: String
  resource: String
  action: String
  description: String?
}

-- Role-Permission assignments
RolePermission {
  roleId: String
  permissionId: String
}

-- User-Venue specific permissions
UserVenuePermission {
  userId: String
  venueId: String
  permissionId: String
  grantedBy: String
  grantedAt: DateTime
}

-- Field-level permissions
FieldPermission {
  roleId: String
  resource: String
  field: String
  access: String // "read" | "write" | "none"
}

-- Conditional permissions
ConditionalPermission {
  roleId: String
  resource: String
  action: String
  conditions: JSON
}

-- Time-based access
TimeBasedAccess {
  roleId: String
  resource: String
  action: String
  daysOfWeek: Int[]
  startTime: String
  endTime: String
  timezone: String
}
```

## Best Practices

### 1. Always Check Permissions Server-Side

```typescript
// GOOD
"use server";
export async function updateRoster(data: RosterData) {
  const hasPermission = await canAccess("rosters", "edit");
  if (!hasPermission) {
    return { error: "Forbidden" };
  }
  // ... proceed
}

// BAD - Client-side only check
"use client";
function RosterEditor() {
  const canEdit = usePermission("rosters", "edit"); // Only for UI!
  // Don't rely on this for security
}
```

### 2. Use Conditional Permissions for Business Rules

```typescript
// Instead of hardcoding business logic in actions:
if (roster.status !== "DRAFT") {
  return { error: "Can only edit draft rosters" };
}

// Use conditional permissions:
const result = await evaluateConditionalPermission({
  userId,
  resource: "rosters",
  action: "edit",
  resourceId: roster.id,
});
```

### 3. Filter Data by Field Permissions

```typescript
// Before returning user data:
const userData = await prisma.user.findUnique({ where: { id } });
const filteredData = await filterAccessibleFields(
  { userId: requesterId, resource: "users", action: "view" },
  userData
);
return filteredData;
```

### 4. Use Venue Scoping for Multi-Tenant

```typescript
// Always pass venueId for venue-specific resources
const canEdit = await hasPermission(userId, "rosters", "edit", venueId);
```

### 5. Log Permission Changes

All permission changes are automatically logged to the audit system with:
- Who made the change
- What permission was changed
- IP address of the requester
- Timestamp

## Admin UI

Access the permission management UI at:
- `/system/roles` - Role management
- `/system/permissions` - Permission assignments
- `/system/venues` - Venue-specific permissions

## Migration Guide

### From Old Permission System

1. Replace `user.role.name === "ADMIN"` with `await isAdmin(userId)`
2. Replace `user.role.name === "MANAGER"` with `await isManager(userId)`
3. Replace hardcoded checks with `hasPermission()` calls
4. Add venue context where applicable

### Example Migration

```typescript
// OLD
if (user.role.name === "MANAGER" || user.role.name === "ADMIN") {
  // allow
}

// NEW
if (await hasPermission(user.id, "rosters", "edit", venueId)) {
  // allow
}
```

## Troubleshooting

### Permission Not Working

1. Check if user is active
2. Check if role has the permission assigned
3. Check if venue-specific permission is needed
4. Check conditional permission rules
5. Check time-based access restrictions

### Debug Permission Check

```typescript
const result = await checkPermissions(userId, [
  { resource: "rosters", action: "edit" },
], venueId);

console.log("Results:", result.results);
// [{ resource: "rosters", action: "edit", allowed: true }]
```

## Future Enhancements

- [ ] Permission templates for quick role setup
- [ ] Permission inheritance between roles
- [ ] Temporary permission grants (with expiry)
- [ ] Permission analytics dashboard
- [ ] Bulk permission import/export