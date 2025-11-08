-- Seed dummy channels for testing
-- Only inserts if channels don't already exist

INSERT INTO channels (id, name, description, type, icon, color, archived, "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  'General Announcements',
  'Company-wide announcements and important updates',
  'ALL_STAFF',
  '📢',
  '#3b82f6',
  false,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM channels WHERE name = 'General Announcements'
);

INSERT INTO channels (id, name, description, type, icon, color, archived, "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  'Team Updates',
  'Updates and news from different teams',
  'ALL_STAFF',
  '👥',
  '#10b981',
  false,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM channels WHERE name = 'Team Updates'
);

INSERT INTO channels (id, name, description, type, icon, color, archived, "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  'Social',
  'Casual conversations, celebrations, and fun',
  'ALL_STAFF',
  '🎉',
  '#f59e0b',
  false,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM channels WHERE name = 'Social'
);

INSERT INTO channels (id, name, description, type, icon, color, archived, "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  'Help & Questions',
  'Ask questions and get help from the team',
  'ALL_STAFF',
  '❓',
  '#8b5cf6',
  false,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM channels WHERE name = 'Help & Questions'
);

INSERT INTO channels (id, name, description, type, icon, color, archived, "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  'Managers Only',
  'Private channel for management discussions',
  'MANAGERS',
  '🔒',
  '#ef4444',
  false,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM channels WHERE name = 'Managers Only'
);

-- Display created channels
SELECT name, type, icon, color, archived FROM channels ORDER BY "createdAt" DESC;
