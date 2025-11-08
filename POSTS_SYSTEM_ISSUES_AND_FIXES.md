# Posts System Issues & Solutions

## ✅ ALL ISSUES FIXED

**Date Fixed**: November 8, 2025
**Status**: All database schema issues resolved, dummy channels created, system is now fully functional

### What Was Done

1. **Created SQL Migration** (`prisma/migrations/fix_missing_columns.sql`)
   - Added missing columns to `channels` table: description, icon, color, archived, archivedAt
   - Added missing columns to `posts` table: edited, editedAt
   - Added missing columns to `comments` table: edited, editedAt
   - Set default values for existing rows

2. **Executed Migration**
   - Ran `npx prisma db execute --file prisma/migrations/fix_missing_columns.sql`
   - Migration completed successfully

3. **Created Dummy Channels** (`prisma/migrations/seed_channels.sql`)
   - Created 5 test channels:
     - 📢 General Announcements (ALL_STAFF, #3b82f6)
     - 👥 Team Updates (ALL_STAFF, #10b981)
     - 🎉 Social (ALL_STAFF, #f59e0b)
     - ❓ Help & Questions (ALL_STAFF, #8b5cf6)
     - 🔒 Managers Only (MANAGERS, #ef4444)

4. **Cleared Caches and Regenerated Prisma Client**
   - Removed `.next` directory (Next.js cache)
   - Removed `node_modules/.prisma` directory
   - Ran `npx prisma generate`
   - Restarted development server

5. **Verified Fix**
   - Posts page loads successfully (200 OK)
   - No more "Unknown argument 'archived'" errors
   - No more "Unknown field 'color'" errors
   - Post creation working correctly
   - All 5 channels visible in channel list

### Remaining Setup Required

⚠️ **Supabase Storage Bucket** - File uploads will fail until you create the `post-media` bucket
   - See `SUPABASE_STORAGE_SETUP.md` for detailed instructions
   - This is a **manual step** requiring Supabase Dashboard access
   - Posts work fine without media uploads if bucket isn't set up yet

---

## Issues That Were Fixed

### 1. ✅ Database Schema Not Synced (FIXED)
**Error**: `PrismaClientValidationError: Unknown argument 'archived'`

**Issue**: The database is missing the new fields we added to Channel, Post, and Comment models:
- Channel: `description`, `icon`, `color`, `archived`, `archivedAt`
- Post: `edited`, `editedAt`
- Comment: `edited`, `editedAt`

**Why**: Even though `prisma db push` says "database is in sync", Prisma might be caching old schema metadata.

**Solution Applied**:
```bash
# Executed SQL migration directly
npx prisma db execute --file prisma/migrations/fix_missing_columns.sql
# Cleared caches and regenerated
rm -rf .next node_modules/.prisma
npx prisma generate
# Restarted dev server
```

### 2. ✅ No Channels Exist (FIXED)
**Issue**: You cannot create posts without channels. Channels must exist first.

**Who can create channels**:
- Only users with `posts:manage` permission
- Typically: ADMIN and MANAGER roles
- Staff cannot create channels

**Solution Applied**:
- Executed SQL script to seed 5 dummy channels
- Script: `prisma/migrations/seed_channels.sql`
- Channels created:
  - General Announcements (ALL_STAFF)
  - Team Updates (ALL_STAFF)
  - Social (ALL_STAFF)
  - Help & Questions (ALL_STAFF)
  - Managers Only (MANAGERS)
- All channels are now visible and functional

### 3. ⚠️ Supabase Storage Bucket Missing (PENDING MANUAL SETUP)
**Error**: `StorageApiError: Bucket not found`

**Issue**: The "post-media" bucket for file uploads hasn't been created in Supabase.

**Solution**: Follow the instructions in `SUPABASE_STORAGE_SETUP.md`:
1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Name: `post-media`
4. Make it public
5. Set up RLS policies (see the setup guide)

### 4. 🔍 Permission System Explanation

**How permissions work**:
- Permissions are tied to **ROLES**, not individual users
- Each role has a set of permissions for different resources
- Resources include: `posts`, `users`, `roles`, `stores`, etc.
- Actions include: `create`, `read`, `update`, `delete`, `manage`

**Posts Permission Breakdown**:

| Permission | Who Has It | What It Allows |
|------------|------------|----------------|
| `posts:create` | Staff, Manager, Admin | Create posts and comments |
| `posts:read` | Everyone (authenticated) | View posts and comments |
| `posts:update` | Staff (own), Manager, Admin | Edit own posts/comments |
| `posts:delete` | Staff (own), Manager, Admin | Delete own posts/comments |
| `posts:manage` | Manager, Admin | Pin posts, manage any post/comment, create/manage channels |

**Your Situation (sharma089.vishal@gmail.com)**:
- You need to check what role you have
- If you're STAFF, you should have `posts:create` permission
- If you don't, an admin needs to grant it to your role

### 5. 🔍 Why You Can't Create Posts

**Possible Reasons**:

1. **No channels exist** (most likely)
   - Solution: Admin creates channels first

2. **You don't have `posts:create` permission**
   - Solution: Admin grants permission to your role

3. **Database schema out of sync** (currently happening)
   - Solution: Clear Prisma cache and resync (see #1)

4. **Channel selector is empty/broken**
   - Solution: Refresh page after channels are created

## Step-by-Step Fix Process

### For Admins:

**Step 1: Fix Database Schema**
```bash
cd /Users/officerdevil/Downloads/staff-portal
rm -rf node_modules/.prisma
npx prisma generate
npx prisma db push
```

**Step 2: Create Supabase Storage Bucket**
1. Open Supabase Dashboard
2. Navigate to Storage
3. Create "post-media" bucket (public)
4. Set up RLS policies (see SUPABASE_STORAGE_SETUP.md)

**Step 3: Create First Channel**
1. Log in as admin
2. Go to http://localhost:3000/admin/channels
3. Click "Create Channel"
4. Example:
   - Name: "General Announcements"
   - Description: "Company-wide announcements and updates"
   - Type: "All Staff"
   - Icon: 📢 (or any emoji)
   - Color: #3b82f6 (blue)
5. Click "Create Channel"

**Step 4: Grant Permissions to Staff Role**
1. Go to /admin/roles
2. Select "STAFF" role
3. Ensure these permissions are checked:
   - ✅ posts:create
   - ✅ posts:read
   - ✅ posts:update
   - ✅ posts:delete

### For Staff Users:

**Once admins complete the above**:
1. Refresh the /posts page
2. You should now see channels in the sidebar
3. Click "New Post" button
4. Select a channel from the dropdown
5. Write your content
6. Optionally upload media (images/videos/PDFs)
7. Click "Create Post"

## Permission Matrix

### What Each Role Can Do:

| Action | Staff | Manager | Admin |
|--------|-------|---------|-------|
| View posts | ✅ | ✅ | ✅ |
| Create posts | ✅ | ✅ | ✅ |
| Edit own posts | ✅ | ✅ | ✅ |
| Delete own posts | ✅ | ✅ | ✅ |
| Edit any post | ❌ | ✅ | ✅ |
| Delete any post | ❌ | ✅ | ✅ |
| Pin posts | ❌ | ✅ | ✅ |
| Create channels | ❌ | ✅ | ✅ |
| Manage channels | ❌ | ✅ | ✅ |
| Add reactions | ✅ | ✅ | ✅ |
| Add comments | ✅ | ✅ | ✅ |
| Edit own comments | ✅ | ✅ | ✅ |
| Delete any comment | ❌ | ✅ | ✅ |

## Verification Commands

**Check if user has posts permissions**:
```bash
# Run this in the browser console on the /posts page
// This will show if the current user can create posts
fetch('/api/...') // TODO: Add verification endpoint
```

**Check if channels exist**:
Open browser console on /posts page, look for:
- "Failed to load channels" errors
- Empty channel sidebar
- "No channels available" message

## Next Steps After Fixing

1. ✅ Create 3-5 channels for different purposes:
   - General Announcements
   - Team Updates
   - Social
   - Help & Questions
   - Celebrations

2. ✅ Create a welcome post in "General Announcements"

3. ✅ Test the following features:
   - Creating posts with text
   - Uploading images
   - Adding comments
   - Adding reactions
   - Editing/deleting own content
   - (Admin only) Pinning important posts

## Common Errors and Solutions

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "You don't have permission to create posts" | Missing `posts:create` permission | Admin grants permission to role |
| "Please select a channel" | No channel selected or none exist | Admin creates channels |
| "Channel not found" | Trying to post to deleted/archived channel | Select active channel |
| "Failed to upload file" | Supabase bucket not configured | Set up storage bucket |
| "Bucket not found" | Missing post-media bucket | Create bucket in Supabase |
| "Unknown argument 'archived'" | Database schema out of sync | Clear Prisma cache, resync |

## Files to Review

- **Server Actions**: `/src/lib/actions/posts.ts`, `/src/lib/actions/channels.ts`
- **Permissions**: `/src/lib/rbac/permissions.ts`, `/src/lib/rbac/access.ts`
- **Components**: `/src/components/posts/` directory
- **Database Schema**: `/prisma/schema.prisma`
- **Storage Setup**: `/SUPABASE_STORAGE_SETUP.md`

---

**If you're still experiencing issues after following these steps, please check:**
1. Browser console for JavaScript errors
2. Server logs for permission/database errors
3. Your user's role and permissions in the database
