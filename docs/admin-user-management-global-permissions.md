# Admin User Management - Global Permissions Decision

## Context

During Phase 3 implementation of the Enhanced Granular Permission System, we evaluated whether admin user management operations should use venue-scoped permissions.

## Decision

**Admin user management will remain GLOBAL and NOT use venue-scoped permissions.**

## Rationale

### 1. Operational Efficiency
- User accounts are organization-wide entities, not venue-specific
- Creating/editing users requires assigning roles, stores, and venues
- Splitting user management by venue would create fragmented administration

### 2. Role Assignment Complexity
- Managers would need to see ALL roles to assign them, not just their venue's roles
- Role permissions are global by design - they exist independent of venues
- User-venue assignments are made AFTER user creation, providing the venue isolation

### 3. Existing Venue Control Mechanism
The system already provides venue-based user management through:
- **VenuePermissionsDialog**: Managers can assign/remove venue access for users
- **UserVenue model**: Links users to specific venues with primary venue designation
- **Filtered User Lists**: `getAllUsersInSharedVenues()` shows only relevant users

### 4. Consistency with RBAC Design
Admin user management follows the same pattern as:
- **Role management**: Global (Task 4 - not venue-scoped)
- **Permission management**: Global (Phase 2 - permissions are system-wide)
- **Store management**: Global (stores can be assigned across venues)

### 5. Admin Bypass Pattern
Admins already bypass ALL permission checks through the automatic admin override in `hasPermission()`. Making user management venue-scoped would be redundant for admins while creating unnecessary restrictions for managers who need organizational visibility.

## Implementation Status

### What IS Venue-Scoped (Completed)
✅ Task 1: Time-off request approval (`timeoff:approve`)
✅ Task 2: Availability viewing (`availability:view_team`)
✅ Task 3: Post/comment moderation (`posts:moderate`)
✅ Task 5: Messages system (participant-based, already secure)

### What Remains GLOBAL
- **User CRUD**: Create, read, update, delete users
- **Role management**: Create, edit, delete roles
- **Permission assignment**: Assign permissions to roles
- **Store management**: Create and manage stores/locations
- **Venue management**: Create and manage venues
- **System configuration**: App-wide settings

## Alternative Approach Considered

We considered venue-scoped user management where:
- Managers could only create users assigned to their venues
- User lists would be filtered by manager's venues
- User editing would check venue access

**Why this was rejected**:
1. Would require managers to see global role/store lists anyway
2. Creates confusion: "Why can I see roles from venues I don't manage?"
3. User-venue assignment already provides the necessary isolation
4. Would complicate onboarding workflows unnecessarily

## Security Guarantees

Even with global user management, venue isolation is maintained through:

1. **Venue Permission Assignment**:
   - After creation, users are assigned to specific venues
   - Managers can only assign users to their own venues (via VenuePermissionsDialog)

2. **Data Access Filtering**:
   - `getSharedVenueUsers()` filters all data queries by venue
   - Users only see data from their assigned venues
   - Cross-venue data access is prevented at the query level

3. **Action Restrictions**:
   - Venue-scoped actions (time-off approval, post moderation) check venue permissions
   - Users can't perform actions outside their venue scope
   - Participant-based actions (messages) check conversation membership

## Conclusion

Admin user management operates at the organizational level while venue-scoped permissions control what users can DO after they're created. This separation of concerns provides:
- **Administrative efficiency**: Central user onboarding and management
- **Operational security**: Venue-isolated data access and action permissions
- **Role clarity**: Clear distinction between user management and venue operations

This design balances administrative flexibility with operational security.

---

**Document Created**: 2025-11-11
**Phase**: Phase 3 - Enhanced Granular Permission System
**Related Files**:
- `src/lib/actions/admin/users.ts` - User CRUD operations
- `src/lib/actions/admin/venue-permissions.ts` - Venue permission assignment
- `src/components/admin/VenuePermissionsDialog.tsx` - Venue assignment UI
