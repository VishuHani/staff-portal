-- Create General Announcements channel with proper CUID ID
INSERT INTO channels (id, name, description, type, icon, color, archived, "createdAt", "updatedAt")
VALUES (
  'clz1a2b3c4d5e6f7g8h9i0j1',  -- Valid CUID format
  'General Announcements',
  'Company-wide announcements and important updates',
  'ALL_STAFF',
  '📢',
  '#3b82f6',
  false,
  NOW(),
  NOW()
)
ON CONFLICT (name) DO UPDATE
SET
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  archived = EXCLUDED.archived,
  "updatedAt" = NOW();

-- Display the created channel
SELECT id, name, icon, color, type, archived FROM channels WHERE name = 'General Announcements';
