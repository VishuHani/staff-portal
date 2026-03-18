-- ============================================================================
-- Document Management Storage Bucket Setup
-- ============================================================================
-- Run this script in Supabase SQL Editor to set up the document-uploads bucket
-- with appropriate RLS policies for secure document management.

-- 1. Create the document-uploads storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'document-uploads',
  'document-uploads',
  false, -- Not public - access controlled via RLS
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
) ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS on the storage bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies for document-uploads bucket

-- Policy: Users can view documents in their venue
CREATE POLICY "Users can view documents in their venue"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'document-uploads'
  AND (
    -- Templates: User belongs to the venue
    EXISTS (
      SELECT 1 FROM user_venues uv
      WHERE uv.venue_id::text = (storage.foldername(storage.objects.name))[1]
      AND uv.user_id = auth.uid()
    )
    OR
    -- Submissions: User is the submitter or has venue access
    EXISTS (
      SELECT 1 FROM document_submissions ds
      JOIN document_assignments da ON ds.assignment_id = da.id
      WHERE ds.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM user_venues uv
        WHERE uv.venue_id = da.venue_id
        AND uv.user_id = auth.uid()
      )
    )
    OR
    -- Signatures: User owns the signature
    (storage.foldername(storage.objects.name))[1] = 'signatures'
    AND (storage.foldername(storage.objects.name))[2] = auth.uid()::text
  )
);

-- Policy: Admins and Managers can upload templates
CREATE POLICY "Admins and Managers can upload templates"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'document-uploads'
  AND (
    -- Check if user is admin
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name = 'ADMIN'
    )
    OR
    -- Check if user is manager with venue access
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN user_venues uv ON uv.user_id = u.id
      WHERE u.id = auth.uid()
      AND r.name = 'MANAGER'
      AND uv.venue_id::text = (storage.foldername(storage.objects.name))[1]
    )
  )
);

-- Policy: Users can upload submissions
CREATE POLICY "Users can upload submissions"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'document-uploads'
  AND (
    -- Submissions folder
    (storage.foldername(storage.objects.name))[1] = 'submissions'
    AND EXISTS (
      SELECT 1 FROM document_assignments da
      WHERE da.id::text = (storage.foldername(storage.objects.name))[2]
      AND da.user_id = auth.uid()
    )
    OR
    -- Signatures folder
    (storage.foldername(storage.objects.name))[1] = 'signatures'
    AND (storage.foldername(storage.objects.name))[2] = auth.uid()::text
  )
);

-- Policy: Admins and Managers can update templates
CREATE POLICY "Admins and Managers can update templates"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'document-uploads'
  AND (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name = 'ADMIN'
    )
    OR
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN user_venues uv ON uv.user_id = u.id
      WHERE u.id = auth.uid()
      AND r.name = 'MANAGER'
      AND uv.venue_id::text = (storage.foldername(storage.objects.name))[1]
    )
  )
);

-- Policy: Users can update their own submissions
CREATE POLICY "Users can update their own submissions"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'document-uploads'
  AND (
    (storage.foldername(storage.objects.name))[1] = 'submissions'
    AND EXISTS (
      SELECT 1 FROM document_assignments da
      WHERE da.id::text = (storage.foldername(storage.objects.name))[2]
      AND da.user_id = auth.uid()
    )
    OR
    (storage.foldername(storage.objects.name))[1] = 'signatures'
    AND (storage.foldername(storage.objects.name))[2] = auth.uid()::text
  )
);

-- Policy: Admins can delete documents
CREATE POLICY "Admins can delete documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'document-uploads'
  AND EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.name = 'ADMIN'
  )
);

-- Policy: Managers can delete documents in their venue
CREATE POLICY "Managers can delete documents in their venue"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'document-uploads'
  AND EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    JOIN user_venues uv ON uv.user_id = u.id
    WHERE u.id = auth.uid()
    AND r.name = 'MANAGER'
    AND uv.venue_id::text = (storage.foldername(storage.objects.name))[1]
  )
);

-- ============================================================================
-- Storage Folder Structure:
-- ============================================================================
-- 
-- document-uploads/
-- ├── templates/
-- │   ├── {venueId}/
-- │   │   ├── {templateId}/
-- │   │   │   ├── {version}/
-- │   │   │   │   ├── original.pdf
-- │   │   │   │   └── current.pdf
-- ├── submissions/
-- │   ├── {assignmentId}/
-- │   │   ├── filled.pdf
-- │   │   ├── signature.png
-- │   │   └── attachments/
-- │   │       ├── file1.pdf
-- │   │       └── file2.jpg
-- └── signatures/
--     └── {userId}/
--         └── {signatureId}.png
--
-- ============================================================================
