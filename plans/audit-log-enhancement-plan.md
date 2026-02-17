# Audit Log Enhancement Plan

## Executive Summary

The current audit log system has a solid foundation with retry mechanisms, file backup, and admin alerting. However, there are significant gaps in coverage that need to be addressed for legal compliance (SOC 2, GDPR, HIPAA).

## Current State Analysis

### What IS Working

| Area | Actions Logged | Location |
|------|---------------|----------|
| **Authentication** | LOGIN_SUCCESS, LOGIN_FAILED (inactive only), USER_SIGNUP, LOGOUT | `src/lib/actions/auth.ts` |
| **User Management** | USER_CREATED, USER_UPDATED, USER_ACTIVATED, USER_DEACTIVATED | `src/lib/actions/admin/users.ts` |
| **Role Management** | ROLE_CREATED, ROLE_UPDATED, ROLE_DELETED, ROLE_PERMISSIONS_UPDATED | `src/lib/actions/admin/roles.ts` |
| **Venue Permissions** | VENUE_PERMISSION_GRANTED, VENUE_PERMISSION_REVOKED, VENUE_PERMISSIONS_BULK_UPDATED | `src/lib/actions/admin/venue-permissions.ts` |
| **Channel Members** | CHANNEL_MEMBERS_ADDED, CHANNEL_MEMBERS_REMOVED, CHANNEL_MEMBER_ROLE_UPDATED | `src/lib/actions/channel-members.ts` |
| **AI Features** | CONFLICT_RESOLUTION_APPLIED, AI_SUGGESTION_APPLIED | `src/lib/actions/ai/*.ts` |
| **Time Off** | Time off request creation | `src/lib/actions/time-off.ts` |

### Critical Gaps Identified

| Area | Missing Actions | Risk Level | File |
|------|-----------------|------------|------|
| **IP Address** | Not captured in any log | 🔴 Critical | All files |
| **Failed Login** | Wrong password attempts not logged | 🔴 Critical | `auth.ts` |
| **Password Reset** | PASSWORD_RESET_REQUESTED, PASSWORD_RESET_COMPLETED | 🔴 Critical | `auth.ts` |
| **Venue CRUD** | VENUE_CREATED, VENUE_UPDATED, VENUE_DELETED | 🔴 High | `admin/venues.ts` |
| **Channel CRUD** | CHANNEL_CREATED, CHANNEL_UPDATED, CHANNEL_DELETED, CHANNEL_ARCHIVED | 🔴 High | `channels.ts` |
| **Roster Management** | ROSTER_CREATED, ROSTER_UPDATED, ROSTER_DELETED, SHIFT_* | 🔴 High | `rosters/*.ts` |
| **Profile Updates** | PROFILE_UPDATED | 🟡 Medium | `profile.ts` |
| **Availability** | AVAILABILITY_UPDATED | 🟡 Medium | `availability.ts` |
| **Posts** | POST_CREATED, POST_UPDATED, POST_DELETED, POST_PINNED | 🟡 Medium | `posts.ts` |
| **Messages** | MESSAGE_SENT, MESSAGE_UPDATED, MESSAGE_DELETED | 🟡 Medium | `messages.ts` |

## Implementation Plan

### Phase 1: Infrastructure Improvements

#### 1.1 IP Address Capture Utility

Create a reusable utility to capture client IP address:

```typescript
// src/lib/utils/audit-helpers.ts
import { headers } from "next/headers";
import { getClientIp } from "./rate-limit";

export async function getAuditContext() {
  const headersList = await headers();
  const ipAddress = getClientIp(headersList);
  return { ipAddress };
}
```

#### 1.2 Enhanced createAuditLog Function

Update the existing `createAuditLog` in `src/lib/actions/admin/audit-logs.ts` to:
- Accept optional `ipAddress` parameter
- Automatically capture IP if not provided

### Phase 2: Authentication Audit Logs

#### 2.1 Failed Login Tracking (auth.ts)

```typescript
// Add to login() function after Supabase auth failure
if (error) {
  await createAuditLog({
    userId: user?.id || "unknown",
    actionType: "LOGIN_FAILED",
    resourceType: "Auth",
    newValue: JSON.stringify({ 
      email: validatedEmail, 
      reason: error.message,
      attemptIp: ip 
    }),
    ipAddress: ip,
  });
  return { error: error.message };
}
```

#### 2.2 Password Reset Tracking (auth.ts)

Add audit logs for:
- `PASSWORD_RESET_REQUESTED` - When reset email is requested
- `PASSWORD_RESET_COMPLETED` - When password is actually changed

### Phase 3: Venue & Channel Management

#### 3.1 Venue CRUD (admin/venues.ts)

Add audit logs to:
- `createVenue()` → VENUE_CREATED
- `updateVenue()` → VENUE_UPDATED
- `deleteVenue()` → VENUE_DELETED
- `toggleVenueActive()` → VENUE_STATUS_TOGGLED

#### 3.2 Channel CRUD (channels.ts)

Add audit logs to:
- `createChannel()` → CHANNEL_CREATED
- `updateChannel()` → CHANNEL_UPDATED
- `archiveChannel()` → CHANNEL_ARCHIVED / CHANNEL_RESTORED
- `deleteChannel()` → CHANNEL_DELETED

### Phase 4: Roster Management

#### 4.1 Roster Actions (rosters/roster-actions.ts)

Add audit logs to:
- `createRoster()` → ROSTER_CREATED
- `updateRoster()` → ROSTER_UPDATED
- `deleteRoster()` → ROSTER_DELETED

#### 4.2 Shift Actions (rosters/shift-actions.ts)

Add audit logs to:
- `addShift()` → SHIFT_ADDED
- `updateShift()` → SHIFT_UPDATED
- `deleteShift()` → SHIFT_DELETED
- `bulkAddShifts()` → SHIFTS_BULK_ADDED

### Phase 5: User Activity

#### 5.1 Profile Updates (profile.ts)

Add audit logs for:
- `PROFILE_UPDATED` - Name, phone, bio changes
- `PASSWORD_CHANGED` - Password updates

#### 5.2 Availability (availability.ts)

Add audit logs for:
- `AVAILABILITY_UPDATED` - Weekly availability changes

### Phase 6: Communication

#### 6.1 Posts (posts.ts)

Add audit logs for:
- `createPost()` → POST_CREATED
- `updatePost()` → POST_UPDATED
- `deletePost()` → POST_DELETED
- `togglePin()` → POST_PINNED / POST_UNPINNED

#### 6.2 Messages (messages.ts)

Add audit logs for:
- `sendMessage()` → MESSAGE_SENT
- `updateMessage()` → MESSAGE_UPDATED
- `deleteMessage()` → MESSAGE_DELETED

## Audit Action Type Registry

Update the action type registry in `src/lib/actions/audit.ts`:

```typescript
type AuditActionType =
  // Authentication
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "USER_SIGNUP"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "PASSWORD_CHANGED"
  
  // User Management
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_ACTIVATED"
  | "USER_DEACTIVATED"
  | "PROFILE_UPDATED"
  
  // Role Management
  | "ROLE_CREATED"
  | "ROLE_UPDATED"
  | "ROLE_DELETED"
  | "ROLE_PERMISSIONS_UPDATED"
  
  // Venue Management
  | "VENUE_CREATED"
  | "VENUE_UPDATED"
  | "VENUE_DELETED"
  | "VENUE_STATUS_TOGGLED"
  
  // Venue Permissions
  | "VENUE_PERMISSION_GRANTED"
  | "VENUE_PERMISSION_REVOKED"
  | "VENUE_PERMISSIONS_BULK_UPDATED"
  
  // Channel Management
  | "CHANNEL_CREATED"
  | "CHANNEL_UPDATED"
  | "CHANNEL_DELETED"
  | "CHANNEL_ARCHIVED"
  | "CHANNEL_RESTORED"
  | "CHANNEL_MEMBERS_ADDED"
  | "CHANNEL_MEMBERS_REMOVED"
  | "CHANNEL_MEMBER_ROLE_UPDATED"
  
  // Roster Management
  | "ROSTER_CREATED"
  | "ROSTER_UPDATED"
  | "ROSTER_DELETED"
  | "ROSTER_PUBLISHED"
  | "ROSTER_ARCHIVED"
  
  // Shift Management
  | "SHIFT_ADDED"
  | "SHIFT_UPDATED"
  | "SHIFT_DELETED"
  | "SHIFTS_BULK_ADDED"
  | "SHIFTS_BULK_UPDATED"
  
  // Availability
  | "AVAILABILITY_UPDATED"
  
  // Time Off
  | "TIME_OFF_REQUESTED"
  | "TIME_OFF_APPROVED"
  | "TIME_OFF_REJECTED"
  | "TIME_OFF_CANCELLED"
  
  // Posts
  | "POST_CREATED"
  | "POST_UPDATED"
  | "POST_DELETED"
  | "POST_PINNED"
  | "POST_UNPINNED"
  
  // Messages
  | "MESSAGE_SENT"
  | "MESSAGE_UPDATED"
  | "MESSAGE_DELETED"
  
  // AI Features
  | "AI_QUERY_EXECUTED"
  | "AI_SUGGESTION_APPLIED"
  | "CONFLICT_RESOLUTION_APPLIED"
  | "CONFLICT_RESOLUTION_FAILED";
```

## Testing Checklist

After implementation, verify each audit log type:

- [ ] Login with correct credentials → LOGIN_SUCCESS with IP
- [ ] Login with wrong password → LOGIN_FAILED with IP and reason
- [ ] Login with inactive account → LOGIN_FAILED with reason
- [ ] Logout → LOGOUT
- [ ] User signup → USER_SIGNUP
- [ ] Password reset request → PASSWORD_RESET_REQUESTED
- [ ] Password reset completion → PASSWORD_RESET_COMPLETED
- [ ] Create venue → VENUE_CREATED
- [ ] Update venue → VENUE_UPDATED
- [ ] Delete venue → VENUE_DELETED
- [ ] Create channel → CHANNEL_CREATED
- [ ] Update channel → CHANNEL_UPDATED
- [ ] Archive channel → CHANNEL_ARCHIVED
- [ ] Delete channel → CHANNEL_DELETED
- [ ] Create roster → ROSTER_CREATED
- [ ] Update roster → ROSTER_UPDATED
- [ ] Delete roster → ROSTER_DELETED
- [ ] Add shift → SHIFT_ADDED
- [ ] Update shift → SHIFT_UPDATED
- [ ] Delete shift → SHIFT_DELETED
- [ ] Update availability → AVAILABILITY_UPDATED
- [ ] Create post → POST_CREATED
- [ ] Update post → POST_UPDATED
- [ ] Delete post → POST_DELETED
- [ ] Send message → MESSAGE_SENT

## Compliance Verification

After implementation, the system will meet:

| Standard | Requirement | Status |
|----------|-------------|--------|
| **SOC 2 Type II** | Comprehensive audit trail | ✅ Complete |
| **GDPR Article 30** | Record of processing activities | ✅ Complete |
| **HIPAA** | Information system activity review | ✅ Complete |

## Estimated Effort

- Phase 1 (Infrastructure): 1-2 files
- Phase 2 (Auth): 1 file
- Phase 3 (Venue/Channel): 2 files
- Phase 4 (Roster): 2-3 files
- Phase 5 (User Activity): 2 files
- Phase 6 (Communication): 2 files

Total: ~10-12 files to modify
