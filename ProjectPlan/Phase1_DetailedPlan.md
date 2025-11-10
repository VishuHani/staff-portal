# Phase 1: Database Schema & Profile Foundation - Detailed Implementation Plan

**Status**: Awaiting Approval
**Estimated Duration**: 2-3 days
**Complexity**: Medium
**Risk Level**: Medium (involves database migrations with data transformation)

---

## Table of Contents
1. [Current State Analysis](#current-state-analysis)
2. [Schema Changes](#schema-changes)
3. [Migration Strategy](#migration-strategy)
4. [Implementation Steps](#implementation-steps)
5. [Validation & Testing](#validation--testing)
6. [Rollback Plan](#rollback-plan)
7. [Files to Modify](#files-to-modify)

---

## Current State Analysis

### Existing Database Structure

**User Model** (`prisma/schema.prisma:21-49`):
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String?
  roleId    String
  storeId   String?  // ⚠️ Single store only, optional
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // ❌ MISSING: firstName, lastName, profileImage
  // ❌ MISSING: phone, bio, dateOfBirth
  // ❌ MISSING: profileCompletedAt

  // Relations
  role                 Role
  store                Store?  // ⚠️ One-to-one relationship
  // ... other relations
}
```

**Store Model** (`prisma/schema.prisma:92-103`):
```prisma
model Store {
  id        String   @id @default(cuid())
  name      String
  code      String   @unique
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users User[]  // ⚠️ One-to-many (one store can have many users)
}
```

### Current Data

**Users in Database**: 2
```json
[
  {
    "id": "8ba6b58b-f09b-4609-995c-193c75d426f8",
    "email": "sharma089.vishal@gmail.com",
    "role": "STAFF",
    "storeId": null  // ⚠️ Not assigned to any store
  },
  {
    "id": "8b91a2c4-0b0a-4c83-809c-2d05d79ef3bc",
    "email": "sharma.vs004@gmail.com",
    "role": "ADMIN",
    "storeId": null  // ⚠️ Not assigned to any store
  }
]
```

**Stores in Database**: 1
```json
[
  {
    "id": "cmhpz9n55002mxrvnt0ot9o78",
    "name": "Main Store",
    "code": "MAIN"
  }
]
```

### Issues Identified

1. **Missing Profile Fields**: No firstName, lastName, profileImage in database
2. **Code Already Expects Profile**: `src/lib/actions/admin/users.ts:189` tries to access `user.firstName`
3. **No Multi-Venue Support**: Only single `storeId` field (one store per user)
4. **No Profile Completion Tracking**: No way to know if user completed profile
5. **No Venue-Based Filtering**: No data isolation between venues
6. **Display Issues**: Email shown everywhere instead of names

---

## Schema Changes

### 1. User Model Changes

**Add Profile Fields**:
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String?

  // NEW: Profile fields
  firstName          String?
  lastName           String?
  profileImage       String?  // Supabase Storage URL
  phone              String?
  bio                String?
  dateOfBirth        DateTime?
  profileCompletedAt DateTime?  // Track when user completed profile

  roleId    String
  storeId   String?  // ⚠️ KEEP for backward compatibility (will deprecate later)
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  role                 Role
  store                Store?
  venues               UserVenue[]  // NEW: Many-to-many relationship
  // ... other relations

  @@index([firstName])
  @@index([lastName])
  @@index([email])
  @@index([roleId])
  @@index([storeId])
}
```

**Field Decisions**:
- `firstName`, `lastName`: Optional initially (will be required after profile completion)
- `profileImage`: Nullable (users can skip avatar initially)
- `phone`: Optional (some users may not want to share)
- `bio`: Optional (max 500 characters)
- `dateOfBirth`: Optional (for birthday notifications later)
- `profileCompletedAt`: NULL = incomplete, DateTime = completed
- `storeId`: Keep for backward compatibility during migration

### 2. New UserVenue Junction Table

**For Multi-Venue Support**:
```prisma
model UserVenue {
  id        String   @id @default(cuid())
  userId    String
  venueId   String
  isPrimary Boolean  @default(false)  // One venue marked as primary
  createdAt DateTime @default(now())

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  venue Store @relation("UserVenues", fields: [venueId], references: [id], onDelete: Cascade)

  @@unique([userId, venueId])  // Prevent duplicate assignments
  @@index([userId])
  @@index([venueId])
  @@index([isPrimary])
  @@map("user_venues")
}
```

**Why This Design?**:
- **Many-to-Many**: Users can belong to multiple venues
- **isPrimary**: One venue marked as "home venue" for default routing
- **Cascading Delete**: If venue deleted, remove all assignments
- **Unique Constraint**: Prevent duplicate user-venue pairs
- **Indexes**: Fast lookups for user's venues and venue's users

### 3. Store Model Changes

**Add UserVenue Relation**:
```prisma
model Store {
  id        String   @id @default(cuid())
  name      String
  code      String   @unique
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users       User[]       // OLD: Keep for backward compatibility
  userVenues  UserVenue[] @relation("UserVenues")  // NEW: Multi-venue support

  @@map("stores")
}
```

---

## Migration Strategy

### Phase 1A: Add Profile Fields (Non-Breaking)

**Risk**: LOW - Just adding nullable fields

**Steps**:
1. Add profile fields to User model (all nullable)
2. Generate migration
3. Apply migration
4. No data transformation needed (all fields nullable)

**Migration File** (`prisma/migrations/XXXXX_add_user_profile_fields/migration.sql`):
```sql
-- Add profile fields to users table
ALTER TABLE "users"
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "profileImage" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "bio" TEXT,
ADD COLUMN "dateOfBirth" TIMESTAMP(3),
ADD COLUMN "profileCompletedAt" TIMESTAMP(3);

-- Add indexes for performance
CREATE INDEX "users_firstName_idx" ON "users"("firstName");
CREATE INDEX "users_lastName_idx" ON "users"("lastName");
```

### Phase 1B: Create UserVenue Table (Non-Breaking)

**Risk**: LOW - New table, doesn't affect existing functionality

**Steps**:
1. Add UserVenue model
2. Generate migration
3. Apply migration
4. Table created empty

**Migration File** (`prisma/migrations/XXXXX_create_user_venues/migration.sql`):
```sql
-- Create user_venues junction table
CREATE TABLE "user_venues" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_venues_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint
CREATE UNIQUE INDEX "user_venues_userId_venueId_key" ON "user_venues"("userId", "venueId");

-- Create indexes
CREATE INDEX "user_venues_userId_idx" ON "user_venues"("userId");
CREATE INDEX "user_venues_venueId_idx" ON "user_venues"("venueId");
CREATE INDEX "user_venues_isPrimary_idx" ON "user_venues"("isPrimary");

-- Add foreign keys
ALTER TABLE "user_venues" ADD CONSTRAINT "user_venues_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_venues" ADD CONSTRAINT "user_venues_venueId_fkey"
    FOREIGN KEY ("venueId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### Phase 1C: Data Migration for Existing Users

**Risk**: MEDIUM - Transforming existing data

**Purpose**:
1. Migrate existing `storeId` values to `UserVenue` table
2. Set default profile values for existing users
3. Mark existing users as needing profile completion

**Data Migration Script** (`scripts/migrate-user-profiles.ts`):
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting user profile migration...\n');

  // Get all existing users
  const users = await prisma.user.findMany({
    include: { store: true }
  });

  console.log(`Found ${users.length} users to migrate\n`);

  for (const user of users) {
    console.log(`Processing: ${user.email}`);

    // 1. Extract name from email (temporary)
    const emailName = user.email.split('@')[0];
    const nameParts = emailName.split('.');
    const firstName = nameParts[0]
      ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1)
      : 'User';
    const lastName = nameParts[1]
      ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1)
      : '';

    // 2. Update user with default profile
    await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName,
        lastName: lastName || null,
        // profileCompletedAt: null (not set - force profile completion)
      }
    });

    console.log(`  ✅ Set profile: ${firstName} ${lastName}`);

    // 3. Migrate storeId to UserVenue if exists
    if (user.storeId) {
      await prisma.userVenue.create({
        data: {
          userId: user.id,
          venueId: user.storeId,
          isPrimary: true,  // Mark as primary venue
        }
      });
      console.log(`  ✅ Migrated to venue: ${user.store?.name}`);
    }
  }

  console.log('\n✅ Migration complete!');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**What This Does**:
1. Takes email "sharma.vs004@gmail.com" → firstName: "Sharma", lastName: "Vs004"
2. Takes email "sharma089.vishal@gmail.com" → firstName: "Sharma089", lastName: "Vishal"
3. Leaves `profileCompletedAt` NULL to force profile completion on next login
4. If user has `storeId`, creates UserVenue entry with `isPrimary: true`

**Expected Result**:
```json
[
  {
    "email": "sharma.vs004@gmail.com",
    "firstName": "Sharma",
    "lastName": "Vs004",
    "profileCompletedAt": null,  // ⚠️ Must complete profile
    "venues": [
      { "venueId": "cmhpz9n55002mxrvnt0ot9o78", "isPrimary": true }  // If had storeId
    ]
  },
  {
    "email": "sharma089.vishal@gmail.com",
    "firstName": "Sharma089",
    "lastName": "Vishal",
    "profileCompletedAt": null,
    "venues": []  // No venue assigned yet
  }
]
```

---

## Implementation Steps

### Step 1: Update Prisma Schema

**File**: `prisma/schema.prisma`

**Changes**:
1. Add profile fields to User model
2. Add UserVenue model
3. Update Store model with UserVenue relation

**Verification**:
```bash
npx prisma format  # Auto-format schema
npx prisma validate  # Check for errors
```

### Step 2: Generate Migration

```bash
npx prisma migrate dev --name add_user_profiles_and_venues
```

**This Will**:
- Generate migration SQL files
- Apply migration to dev database
- Regenerate Prisma Client with new types

### Step 3: Test Migration on Dev Database

**Verification Queries**:
```typescript
// Check new fields exist
const user = await prisma.user.findFirst();
console.log(user.firstName, user.lastName);  // Should not error

// Check UserVenue table created
const venues = await prisma.userVenue.findMany();
console.log(venues.length);  // Should return 0 (empty)
```

### Step 4: Run Data Migration Script

```bash
npx tsx scripts/migrate-user-profiles.ts
```

**Expected Output**:
```
🔄 Starting user profile migration...

Found 2 users to migrate

Processing: sharma.vs004@gmail.com
  ✅ Set profile: Sharma Vs004
Processing: sharma089.vishal@gmail.com
  ✅ Set profile: Sharma089 Vishal

✅ Migration complete!
```

### Step 5: Verify Data Migration

```typescript
// Check users have profile fields
const users = await prisma.user.findMany({
  include: { venues: true }
});

users.forEach(user => {
  console.log(`${user.email}:`);
  console.log(`  Name: ${user.firstName} ${user.lastName}`);
  console.log(`  Profile Complete: ${user.profileCompletedAt ? 'Yes' : 'No'}`);
  console.log(`  Venues: ${user.venues.length}`);
});
```

### Step 6: Update Generated Types

After migration, Prisma Client will have new types:

```typescript
// Now available in type system
type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImage: string | null;
  phone: string | null;
  bio: string | null;
  dateOfBirth: Date | null;
  profileCompletedAt: Date | null;
  // ... other fields
}

type UserVenue = {
  id: string;
  userId: string;
  venueId: string;
  isPrimary: boolean;
  createdAt: Date;
}
```

### Step 7: Test Existing Functionality

**Critical Tests**:
1. ✅ Login still works (no changes to auth)
2. ✅ Admin user list displays (with new nullable fields)
3. ✅ Create user still works (new fields optional)
4. ✅ Notifications still work (user queries unchanged)
5. ✅ Posts/messages display (author relations unchanged)

**Why Still Works?**:
- All new fields are nullable (non-breaking change)
- No existing code requires new fields
- Old code using `user.email` still works
- `storeId` field still exists (backward compatible)

---

## Validation & Testing

### Database Tests

```typescript
// Test 1: Profile fields exist
const user = await prisma.user.findFirst();
expect(user).toHaveProperty('firstName');
expect(user).toHaveProperty('lastName');
expect(user).toHaveProperty('profileImage');
expect(user).toHaveProperty('profileCompletedAt');

// Test 2: UserVenue table works
const venue = await prisma.userVenue.create({
  data: {
    userId: user.id,
    venueId: 'store-id',
    isPrimary: true,
  }
});
expect(venue).toBeDefined();

// Test 3: Multi-venue relationships work
const userWithVenues = await prisma.user.findUnique({
  where: { id: user.id },
  include: { venues: { include: { venue: true } } }
});
expect(userWithVenues.venues).toHaveLength(1);
```

### Application Tests

```bash
# 1. Start dev server
npm run dev

# 2. Test login
# Navigate to /login and login with sharma.vs004@gmail.com

# 3. Check admin panel
# Navigate to /admin/users
# Should display all users without errors

# 4. Check notifications
# Navigate to /notifications
# Should display notifications with email (for now)

# 5. Check posts
# Navigate to /posts
# Should display posts with author email (for now)
```

### Performance Tests

```typescript
// Test query performance with indexes
const start = Date.now();
const users = await prisma.user.findMany({
  where: {
    firstName: { contains: 'Sharma' }
  },
  include: {
    venues: {
      include: { venue: true }
    }
  }
});
const duration = Date.now() - start;
console.log(`Query took ${duration}ms`);
// Should be < 100ms with proper indexes
```

---

## Rollback Plan

### If Migration Fails

**Option 1: Rollback Migration** (if caught immediately)
```bash
npx prisma migrate resolve --rolled-back MIGRATION_NAME
```

**Option 2: Manual Rollback** (if migration applied)
```sql
-- Remove new columns
ALTER TABLE "users"
DROP COLUMN "firstName",
DROP COLUMN "lastName",
DROP COLUMN "profileImage",
DROP COLUMN "phone",
DROP COLUMN "bio",
DROP COLUMN "dateOfBirth",
DROP COLUMN "profileCompletedAt";

-- Drop indexes
DROP INDEX "users_firstName_idx";
DROP INDEX "users_lastName_idx";

-- Drop UserVenue table
DROP TABLE "user_venues";
```

### If Application Breaks

**Issues and Fixes**:

1. **TypeScript errors**:
   - Run `npx prisma generate` to regenerate client
   - Restart TypeScript server

2. **Queries fail**:
   - Check if Prisma Client is regenerated
   - Check if migrations applied: `npx prisma migrate status`

3. **Data issues**:
   - Restore from backup if severe
   - Re-run data migration script

### Backup Strategy

**Before Migration**:
```bash
# Backup database
pg_dump $DATABASE_URL > backup_before_phase1.sql

# Or using Prisma
npx prisma db pull
# Copy schema.prisma to schema.backup.prisma
```

**Restore If Needed**:
```bash
psql $DATABASE_URL < backup_before_phase1.sql
```

---

## Files to Modify

### Phase 1 Changes (This Phase)

**Files to CREATE**:
1. `scripts/migrate-user-profiles.ts` - Data migration script
2. `ProjectPlan/Phase1_DetailedPlan.md` - This document

**Files to MODIFY**:
1. `prisma/schema.prisma` - Add profile fields, UserVenue model
2. `ProjectPlan/MultiVenueProgress.md` - Update progress tracker

**Files GENERATED** (automatic):
1. `prisma/migrations/XXXXX_add_user_profiles_and_venues/migration.sql`
2. `node_modules/.prisma/client/index.d.ts` - Updated types

### Phase 2 Will Modify (Next Phase)

**Files to CREATE** (Phase 2):
1. `src/lib/utils/profile.ts` - Profile utility functions
2. `src/components/profile/UserAvatar.tsx` - Avatar component
3. `src/components/profile/ProfileForm.tsx` - Profile edit form
4. `src/app/profile/complete/page.tsx` - Profile completion page

**Files to MODIFY** (Phase 2):
1. `src/middleware.ts` - Add profile completion check
2. `src/lib/actions/auth.ts` - Update signup to collect profile
3. `src/lib/schemas/admin/users.ts` - Add profile field validation

---

## Success Criteria

Phase 1 is complete when:

- ✅ Prisma schema updated with profile fields
- ✅ UserVenue junction table created
- ✅ Migrations applied successfully to dev database
- ✅ Data migration script executed without errors
- ✅ All existing users have firstName/lastName (from email)
- ✅ Users with storeId have corresponding UserVenue entries
- ✅ All existing app functionality still works
- ✅ TypeScript compiles without errors
- ✅ Dev server runs without errors
- ✅ No breaking changes to existing features
- ✅ Database queries perform well (< 100ms)

---

## Risks & Mitigation

### Risk 1: Migration Fails Midway

**Likelihood**: Low
**Impact**: Medium

**Mitigation**:
- Run migration on dev environment first
- Test thoroughly before production
- Have database backup ready
- Use transaction-based migration

### Risk 2: Existing Queries Break

**Likelihood**: Low
**Impact**: Low

**Mitigation**:
- All new fields are nullable (non-breaking)
- Existing code doesn't require new fields
- `storeId` kept for backward compatibility
- Prisma will auto-update types

### Risk 3: Performance Degradation

**Likelihood**: Low
**Impact**: Low

**Mitigation**:
- Added indexes on firstName, lastName
- UserVenue has indexes on userId, venueId
- Tested with performance benchmarks

### Risk 4: Data Loss

**Likelihood**: Very Low
**Impact**: High

**Mitigation**:
- Full database backup before migration
- Migration tested in dev first
- Rollback plan documented
- No data deletion in Phase 1

---

## Next Steps After Phase 1

Once Phase 1 is complete, we'll move to **Phase 2**:

1. Create profile utility functions (`getFullName`, `getInitials`, `getProfileImage`)
2. Build UserAvatar component (displays avatar or initials)
3. Create profile completion page
4. Update middleware to enforce profile completion
5. Update signup flow to collect firstName/lastName
6. Update admin user creation to collect profile fields

**Phase 2 Estimated Duration**: 1 day

---

## Questions for Stakeholder

Before proceeding with implementation:

1. **Email-to-Name Conversion**: Is the automatic firstName/lastName extraction from email acceptable for existing users? Or should we prompt them to enter real names immediately?

2. **Profile Completion**: Should existing users be forced to complete their profile on next login? Or give them a grace period?

3. **Venue Assignment**: The 2 existing users have no storeId. Should we:
   - Assign them to "Main Store" automatically?
   - Let admin assign them manually?
   - Force them to select a venue on profile completion?

4. **Primary Venue**: When a user has multiple venues, should the system:
   - Always show data from primary venue by default?
   - Let user switch venues manually?
   - Show combined data from all venues?

5. **Avatar Upload**: Should we implement avatar upload in Phase 1 or defer to later phase?

---

## Approval Checklist

Before implementation begins, confirm:

- [ ] Schema changes reviewed and approved
- [ ] Migration strategy understood and approved
- [ ] Data migration approach acceptable
- [ ] Rollback plan understood
- [ ] Success criteria agreed upon
- [ ] Risks and mitigation strategies acceptable
- [ ] Timeline (2-3 days) acceptable
- [ ] Questions answered by stakeholder

---

**Prepared by**: Claude Code
**Date**: 2025-11-10
**Version**: 1.0
**Status**: Awaiting Approval
