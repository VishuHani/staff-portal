-- Migration to create post_reads table for unread tracking
CREATE TABLE IF NOT EXISTS post_reads (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "readAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT post_reads_userId_fkey FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT post_reads_postId_fkey FOREIGN KEY ("postId") REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT post_reads_userId_postId_unique UNIQUE ("userId", "postId")
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS post_reads_userId_idx ON post_reads("userId");
CREATE INDEX IF NOT EXISTS post_reads_postId_idx ON post_reads("postId");

-- Display the table structure
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'post_reads'
ORDER BY ordinal_position;
