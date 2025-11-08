-- Migration to modify reactions table to support both posts and comments

-- Step 1: Add commentId column (nullable)
ALTER TABLE reactions ADD COLUMN IF NOT EXISTS "commentId" TEXT;

-- Step 2: Make postId nullable (by dropping NOT NULL constraint if it exists)
ALTER TABLE reactions ALTER COLUMN "postId" DROP NOT NULL;

-- Step 3: Add foreign key constraint for commentId
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'reactions_commentId_fkey'
    ) THEN
        ALTER TABLE reactions
        ADD CONSTRAINT reactions_commentId_fkey
        FOREIGN KEY ("commentId") REFERENCES comments(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 4: Create index for commentId
CREATE INDEX IF NOT EXISTS reactions_commentId_idx ON reactions("commentId");

-- Step 5: Add unique constraint for commentId, userId, emoji
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'reactions_commentId_userId_emoji_key'
    ) THEN
        ALTER TABLE reactions
        ADD CONSTRAINT reactions_commentId_userId_emoji_key
        UNIQUE ("commentId", "userId", emoji);
    END IF;
END $$;

-- Display the updated table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'reactions'
ORDER BY ordinal_position;
