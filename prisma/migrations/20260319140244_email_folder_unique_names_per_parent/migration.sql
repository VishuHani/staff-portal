-- Enforce case-insensitive unique folder names per module/parent.
-- This prevents sibling duplicates at both root and nested levels.
CREATE UNIQUE INDEX IF NOT EXISTS "email_folders_module_parent_name_ci_key"
ON "email_folders" (
  "module",
  COALESCE("parentId", '__ROOT__'),
  LOWER("name")
);
