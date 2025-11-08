# Supabase Storage Setup Guide

This guide explains how to set up Supabase Storage for the Posts & Communication System.

## Prerequisites

- Supabase project already configured (from initial setup)
- Access to Supabase Dashboard
- Service role key in `.env.local`

## Step 1: Create Storage Bucket

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Configure the bucket:
   - **Name**: `post-media`
   - **Public bucket**: ✅ Yes (checked)
   - **File size limit**: 5MB
   - **Allowed MIME types**: Leave empty (we validate in code)

## Step 2: Configure Row Level Security (RLS)

After creating the bucket, set up RLS policies:

### Policy 1: Allow authenticated users to upload their own files

```sql
-- Allow INSERT for authenticated users in their own folder
CREATE POLICY "Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'post-media' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### Policy 2: Allow public read access

```sql
-- Allow SELECT for everyone (public bucket)
CREATE POLICY "Public read access"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'post-media');
```

### Policy 3: Allow users to delete their own files

```sql
-- Allow DELETE for authenticated users on their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'post-media' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

## Step 3: Apply Policies via Dashboard

1. Go to **Storage** → **Policies** in Supabase Dashboard
2. Select the `post-media` bucket
3. Click **New Policy**
4. For each policy above:
   - Click **Create policy from scratch**
   - Set the policy name (e.g., "Users can upload to their own folder")
   - Select the operation (INSERT, SELECT, or DELETE)
   - Choose the target role (authenticated or public)
   - Add the USING or WITH CHECK clause
   - Click **Review** and then **Save policy**

## Step 4: Verify Configuration

Test the setup:

1. Ensure `.env.local` has these variables:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. Restart your Next.js development server

3. The media upload actions in `src/lib/actions/media.ts` should now work

## Storage Structure

Files will be organized as:
```
post-media/
├── <user-id-1>/
│   ├── <uuid-1>.jpg
│   ├── <uuid-2>.png
│   └── <uuid-3>.mp4
├── <user-id-2>/
│   └── <uuid-4>.jpg
└── ...
```

## File Constraints

- **Max file size**: 5MB per file
- **Max files per post**: 4 files
- **User storage quota**: 100MB per user
- **Allowed types**:
  - Images: JPEG, PNG, GIF, WebP
  - Videos: MP4, WebM
  - Documents: PDF

## Security Features

✅ **User isolation**: Files stored in user-specific folders
✅ **Type validation**: Server-side MIME type checking
✅ **Size limits**: Enforced at upload time
✅ **Permission checks**: Users can only delete their own files
✅ **Quota management**: 100MB limit per user
✅ **Service role key**: Used for admin operations (delete, stats)

## Troubleshooting

### Issue: "Failed to upload file"

**Solution**: Check that:
- Bucket `post-media` exists
- Bucket is set to public
- RLS policies are created
- Service role key is correct in `.env.local`

### Issue: "You don't have permission to delete this file"

**Solution**: Ensure RLS delete policy exists and the file path starts with the user's ID

### Issue: Storage quota exceeded

**Solution**: User has uploaded more than 100MB. They need to delete old files or contact admin.

## Next Steps

After completing this setup:

1. ✅ Storage bucket created
2. ✅ RLS policies configured
3. ✅ Environment variables verified
4. 🔄 Test file upload via UI components (coming next)
5. 🔄 Monitor storage usage in Supabase Dashboard

---

**Note**: This is a development setup. For production, consider:
- Implementing file scanning for malware
- Adding image optimization/resizing
- Setting up CDN for faster delivery
- Implementing backup strategy
- Adding detailed audit logging
