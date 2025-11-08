-- Add messaging enhancements for direct messaging system

-- Add fields to conversations table
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "last_message" TEXT;

-- Add fields to conversation_participants table
ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "last_read_at" TIMESTAMP(3);
ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "muted_until" TIMESTAMP(3);

-- Add fields to messages table
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "media_urls" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "read_by" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
