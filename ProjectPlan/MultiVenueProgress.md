# Multi-Venue Implementation Progress

**Status**: Phase 2 Complete - Profile Management Implemented
**Started**: 2025-11-10
**Current Phase**: Phase 3 Ready to Start
**Last Updated**: 2025-11-10

---

## Overview

Implementing comprehensive multi-venue support with:
- ✅ **Strict data isolation** between venues
- ✅ **User profiles** with firstName, lastName, avatars
- ✅ **Multi-venue** user assignment capability
- ✅ **Profile completion** enforcement

---

## Phase 1: Database & Profile Foundation (Days 1-2)

### Database Schema Changes
- [ ] Add profile fields to User model (firstName, lastName, profileImage, phone, department, position, profileCompleted)
- [ ] Create UserVenue junction table for multi-venue support
- [ ] Update Store model with UserVenue relation
- [ ] Generate Prisma migrations
- [ ] Test migrations on development database

### Data Migration
- [ ] Create data migration script
- [ ] Auto-generate firstName/lastName from existing emails
- [ ] Migrate existing storeId to UserVenue records
- [ ] Set profileCompleted=false for existing users
- [ ] Test migration script on copy of production data

**Deliverables**:
- Prisma migration files
- Data migration script
- Migration test results

---

## Phase 2: Core Utilities & Components (Day 3)

### Shared Utilities
- [ ] Create `/src/lib/utils/user.ts` with display functions
  - [ ] getUserDisplayName()
  - [ ] getUserInitials()
  - [ ] getUserAvatarUrl()
  - [ ] formatUserForDisplay()

- [ ] Create `/src/lib/utils/venue.ts` with access functions
  - [ ] getUserVenueIds()
  - [ ] canAccessVenue()
  - [ ] filterByUserVenues()
  - [ ] getSharedVenueUsers()

### Reusable Components
- [ ] Create UserAvatar component (`/src/components/ui/user-avatar.tsx`)
  - [ ] Image display with fallback to initials
  - [ ] Multiple size support (sm, md, lg)
  - [ ] Loading states
  - [ ] Error handling

- [ ] Create VenueSelector component (`/src/components/admin/venue-selector.tsx`)
  - [ ] Multi-select dropdown
  - [ ] Primary venue toggle
  - [ ] Validation

**Deliverables**:
- 2 utility files with helper functions
- 2 reusable components
- Unit tests for utilities

---

## Phase 3: Authentication & Profile Management (Days 4-5)

### Registration Flow
- [ ] Update signup form (`/src/app/signup/page.tsx`)
  - [ ] Add firstName, lastName fields (required)
  - [ ] Add phone field (optional)
  - [ ] Update validation schemas

- [ ] Create profile completion middleware
  - [ ] Check profileCompleted flag
  - [ ] Redirect to onboarding if incomplete

- [ ] Create onboarding page (`/src/app/onboarding/complete-profile/page.tsx`)
  - [ ] Profile completion form
  - [ ] Redirect after completion

### Profile Management
- [ ] Create profile page (`/src/app/settings/profile/page.tsx`)
  - [ ] Display current profile info
  - [ ] Edit form for all profile fields
  - [ ] View assigned venues (read-only)

- [ ] Create ProfileForm component
  - [ ] Form validation with Zod
  - [ ] Success/error handling
  - [ ] Loading states

- [ ] Create AvatarUpload component
  - [ ] Image upload with preview
  - [ ] Crop/resize functionality
  - [ ] File validation

- [ ] Create profile actions (`/src/lib/actions/profile.ts`)
  - [ ] updateProfile()
  - [ ] uploadProfileImage()
  - [ ] completeProfile()
  - [ ] getProfile()

- [ ] Create profile schemas (`/src/lib/schemas/profile.ts`)
  - [ ] updateProfileSchema
  - [ ] completeProfileSchema
  - [ ] uploadImageSchema

### Supabase Storage Setup
- [ ] Create profile-images bucket
- [ ] Configure bucket permissions
- [ ] Set up image optimization/resizing

**Deliverables**:
- Updated signup flow with profile fields
- Profile completion enforcement
- Full profile management system
- Image upload functionality

---

## Phase 4: Admin User Management (Day 6)

### Admin UI Updates
- [ ] Update UserDialog (`/src/components/admin/UserDialog.tsx`)
  - [ ] Add firstName, lastName fields
  - [ ] Add phone, department, position fields
  - [ ] Add VenueSelector for multi-venue assignment
  - [ ] Add profile image upload
  - [ ] Update form validation

- [ ] Update UsersTable (`/src/components/admin/UsersTable.tsx`)
  - [ ] Display user avatars
  - [ ] Show full names instead of emails
  - [ ] Display assigned venues as badges
  - [ ] Add venue filter dropdown
  - [ ] Update search to include name fields

- [ ] Update admin page (`/src/app/admin/users/page.tsx`)
  - [ ] Pass venue data to components
  - [ ] Handle new data structure

### Admin Actions
- [ ] Update createUser in `/src/lib/actions/admin/users.ts`
  - [ ] Require firstName/lastName
  - [ ] Handle multi-venue assignment
  - [ ] Create UserVenue records
  - [ ] Set primary venue

- [ ] Update updateUser
  - [ ] Update profile fields
  - [ ] Sync venue assignments
  - [ ] Handle venue changes

- [ ] Create assignVenues function
  - [ ] Bulk venue assignment
  - [ ] Validation

- [ ] Update getAllUsers query
  - [ ] Include venues relation
  - [ ] Include profile fields

### Admin Schemas
- [ ] Update `/src/lib/schemas/admin/users.ts`
  - [ ] Add profile fields to schemas
  - [ ] Add venueIds array validation
  - [ ] Add profileImage validation

**Deliverables**:
- Updated admin user management UI
- Multi-venue assignment functionality
- Enhanced user search and filtering

---

## Phase 5: Display Component Updates (Days 7-8)

### Layout Components (3 files)
- [ ] Header (`/src/components/layout/header.tsx`)
  - [ ] Replace email with name + avatar
  - [ ] Update user display

- [ ] Dashboard Layout
  - [ ] Update any user references

- [ ] Navigation
  - [ ] Update user menu

### Posts System (6 files)
- [ ] PostCard (`/src/components/posts/PostCard.tsx`)
  - [ ] Show author avatar
  - [ ] Display author name
  - [ ] Remove email

- [ ] CommentThread (`/src/components/posts/CommentThread.tsx`)
  - [ ] Commenter avatars
  - [ ] Commenter names

- [ ] CommentContent (`/src/components/posts/CommentContent.tsx`)
  - [ ] Update user display

- [ ] MentionInput (`/src/components/posts/MentionInput.tsx`)
  - [ ] Search by name
  - [ ] Show avatars in dropdown

- [ ] ReactionPicker (`/src/components/posts/ReactionPicker.tsx`)
  - [ ] Show names in tooltips

- [ ] PostFeed (`/src/components/posts/PostFeed.tsx`)
  - [ ] Update user references

### Messages System (4 files)
- [ ] MessageBubble (`/src/components/messages/MessageBubble.tsx`)
  - [ ] Sender name + avatar
  - [ ] Remove email

- [ ] MessageThread (`/src/components/messages/MessageThread.tsx`)
  - [ ] Update sender display

- [ ] ConversationList (`/src/components/messages/ConversationList.tsx`)
  - [ ] Participant names + avatars

- [ ] NewConversationDialog (`/src/components/messages/NewConversationDialog.tsx`)
  - [ ] Search by name
  - [ ] Show avatars

### Time-Off Components (2 files)
- [ ] TimeOffReviewList (`/src/components/time-off/time-off-review-list.tsx`)
  - [ ] Requester name + avatar

- [ ] TimeOffCalendar
  - [ ] Update user displays

### Server Actions - Add Profile Fields (14 files, ~40 locations)
- [ ] posts.ts - Update user selects (8 locations)
- [ ] comments.ts - Update user selects (5 locations)
- [ ] messages.ts - Update user selects (6 locations)
- [ ] conversations.ts - Update user selects (7 locations)
- [ ] time-off.ts - Update user selects (3 locations)
- [ ] reactions.ts - Update user selects
- [ ] auth.ts - Update getCurrentUser
- [ ] admin/users.ts - Update queries
- [ ] users.ts - Update queries

**Pattern for all updates**:
```typescript
user: {
  select: {
    id: true,
    email: true,
    firstName: true,      // ADD
    lastName: true,       // ADD
    profileImage: true,   // ADD
    role: { select: { name: true } }
  }
}
```

**Deliverables**:
- All 20+ components updated to show names
- All 14 server actions updated with profile fields
- No emails visible in UI
- Avatars everywhere

---

## Phase 6: Venue-Based Data Isolation (Days 9-11)

### Query Filtering Implementation

#### Posts Queries (`/src/lib/actions/posts.ts`)
- [ ] Add venue filter to getPosts()
- [ ] Add venue check to getPostById()
- [ ] Update Channel model with venue relations
- [ ] Implement channel-venue access control

#### Messages & Conversations
- [ ] Add venue filter to getConversations() (`conversations.ts`)
- [ ] Restrict conversation creation to same-venue users
- [ ] Filter user search by shared venues (`messages.ts`)
- [ ] Validate participant venues in createConversation()

#### Time-Off Requests (`/src/lib/actions/time-off.ts`)
- [ ] Add venue filter to getAllTimeOffRequests()
- [ ] Route approvals to venue-specific managers
- [ ] Filter calendar by venue
- [ ] Update notification routing

#### User Lists (`/src/lib/actions/users.ts`)
- [ ] Add venue filter to getUsers()
- [ ] Filter autocomplete by shared venues
- [ ] Update user search queries

#### Availability (`/src/lib/actions/availability.ts`)
- [ ] Add venue filter to getTeamAvailability()
- [ ] Filter schedule views by venue

### Access Control Enhancement

#### RBAC Updates (`/src/lib/rbac/access.ts`)
- [ ] Implement canAccessVenue()
- [ ] Add venue context to canAccess()
- [ ] Create admin override logic
- [ ] Add venue-scoped permission checks

### Session & Context
- [ ] Store venue IDs in session
- [ ] Implement venue context caching
- [ ] Create venue switcher for multi-venue users
- [ ] Add selected venue to session storage

**Deliverables**:
- All queries filtered by venue
- Strict data isolation enforced
- Admin bypass working
- Performance optimized

---

## Phase 7: Testing & Refinement (Days 12-13)

### Functional Testing
- [ ] User registration with profiles
- [ ] Profile completion flow
- [ ] Profile editing and updates
- [ ] Avatar upload and display
- [ ] Multi-venue assignment (admin)
- [ ] Single venue assignment
- [ ] Primary venue designation

### Data Isolation Testing
- [ ] Cross-venue post visibility (should fail)
- [ ] Same-venue conversation creation (should work)
- [ ] Cross-venue conversation creation (should fail)
- [ ] Time-off filtering by venue
- [ ] User search restricted to venue
- [ ] Admin can see all venues

### Display Testing
- [ ] Names display everywhere
- [ ] Avatars render correctly
- [ ] Fallback initials work
- [ ] No emails in UI
- [ ] Search by name works
- [ ] Notifications show names

### Performance Testing
- [ ] Query performance benchmarks
- [ ] Load testing with 1000+ users
- [ ] Venue filter query optimization
- [ ] Identify and fix slow queries
- [ ] Add database indexes

### Edge Cases
- [ ] User with no venues
- [ ] User with single venue
- [ ] User with multiple venues
- [ ] Incomplete profiles
- [ ] Missing profile images
- [ ] Invalid venue IDs

### Security Testing
- [ ] SQL injection attempts
- [ ] Venue access bypass attempts
- [ ] Permission escalation tests
- [ ] Data leakage checks
- [ ] Session manipulation tests

**Deliverables**:
- Test results documentation
- Performance metrics report
- Security audit report
- Bug fixes implemented

---

## Phase 8: Documentation & Deployment (Days 14-15)

### Documentation
- [ ] Create Admin Guide (`docs/AdminGuide.md`)
- [ ] Create User Guide (`docs/UserGuide.md`)
- [ ] Create Migration Runbook (`docs/MigrationRunbook.md`)
- [ ] Update API documentation
- [ ] Create troubleshooting guide

### Deployment Preparation
- [ ] Test database migration on staging
- [ ] Test data migration script
- [ ] Create rollback plan
- [ ] Configure feature flags
- [ ] Set up monitoring and alerts

### Deployment Execution
- [ ] Run database migration (production)
- [ ] Deploy code with feature flags OFF
- [ ] Run data migration script
- [ ] Test in production (small group)
- [ ] Enable profile completion requirement
- [ ] Enable multi-venue features
- [ ] Monitor for issues
- [ ] Full rollout to all users

### Post-Deployment
- [ ] Monitor performance metrics
- [ ] Track error rates
- [ ] Collect user feedback
- [ ] Address any issues
- [ ] Optimize based on real usage

**Deliverables**:
- Complete documentation set
- Successful production deployment
- Monitoring dashboards
- Post-deployment report

---

## Metrics & Success Criteria

### Current Status
- Profile Fields in Schema: ❌ Not Started
- UserVenue Table: ❌ Not Started
- Profile Management UI: ❌ Not Started
- Display Updates: ❌ Not Started
- Venue Filtering: ❌ Not Started

### Success Metrics (Target)
- [ ] 100% of users have firstName/lastName
- [ ] 100% of active users have profileCompleted=true
- [ ] Profile image upload success rate > 95%
- [ ] Zero cross-venue data leaks
- [ ] Query performance p95 < 500ms
- [ ] Error rate < 0.1%
- [ ] User satisfaction > 85%

---

## Blockers & Risks

### Current Blockers
- None - ready to start

### Identified Risks
1. **Data Migration Complexity**: Migrating existing users
   - Mitigation: Thorough testing, rollback plan

2. **Performance Impact**: Venue joins may slow queries
   - Mitigation: Indexes, caching, optimization

3. **User Adoption**: Profile completion friction
   - Mitigation: Smooth onboarding flow, clear benefits

4. **Data Leaks**: Venue isolation bugs
   - Mitigation: Comprehensive testing, security audit

---

## Notes

### Design Decisions Made
- Multi-venue via junction table (UserVenue)
- Strict data isolation enforced at query level
- Profile completion forced on next login for existing users
- firstName/lastName collected at registration for new users
- Profile images stored in Supabase storage

### Pending Decisions
- None - all major decisions made

### Questions for Stakeholders
- None currently

---

## Daily Progress Log

### 2025-11-10
- ✅ Completed deep system analysis
- ✅ Gathered requirements from stakeholder
- ✅ Created comprehensive implementation plan
- ✅ Created progress tracking document
- 📝 Ready to begin Phase 1

---

**Next Steps**: Begin Phase 1 - Database schema changes and migrations
