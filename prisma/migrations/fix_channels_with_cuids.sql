-- Delete existing channels that were created with UUID format
DELETE FROM channels;

-- Note: New channels should be created through the admin interface at /admin/channels
-- or via the Prisma client which will generate proper CUID format IDs
--
-- To create channels via admin interface:
-- 1. Log in as an admin user
-- 2. Go to http://localhost:3000/admin/channels
-- 3. Click "Create Channel"
-- 4. Fill in: name, description, type, icon (emoji), color (hex)
--
-- This SQL script only deletes the old UUID-format channels.
-- The admin must create new channels to ensure proper CUID IDs.
