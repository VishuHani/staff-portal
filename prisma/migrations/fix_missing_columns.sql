-- Migration to add missing columns that are in schema.prisma but not in database
-- Generated to fix PrismaClientValidationError issues

-- Add missing Channel columns
ALTER TABLE channels ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS icon VARCHAR(255);
ALTER TABLE channels ADD COLUMN IF NOT EXISTS color VARCHAR(7);
ALTER TABLE channels ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP;

-- Add missing Post columns
ALTER TABLE posts ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP;

-- Add missing Comment columns
ALTER TABLE comments ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT false;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP;

-- Update existing rows to have default values for archived
UPDATE channels SET archived = false WHERE archived IS NULL;

-- Update existing rows to have default values for edited
UPDATE posts SET edited = false WHERE edited IS NULL;
UPDATE comments SET edited = false WHERE edited IS NULL;
