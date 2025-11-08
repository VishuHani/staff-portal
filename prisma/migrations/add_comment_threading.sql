-- Migration to add comment threading (replies)

-- Step 1: Add parentId column (nullable)
ALTER TABLE comments ADD COLUMN IF NOT EXISTS "parentId" TEXT;

-- Step 2: Add foreign key constraint for parentId (self-referencing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'comments_parentId_fkey'
    ) THEN
        ALTER TABLE comments
        ADD CONSTRAINT comments_parentId_fkey
        FOREIGN KEY ("parentId") REFERENCES comments(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 3: Create index for parentId for better query performance
CREATE INDEX IF NOT EXISTS comments_parentId_idx ON comments("parentId");

-- Display the updated table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'comments'
ORDER BY ordinal_position;
