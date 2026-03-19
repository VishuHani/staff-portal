-- Case-insensitive sibling folder uniqueness for email workspace folders.
CREATE UNIQUE INDEX IF NOT EXISTS "email_folders_module_parent_name_ci_key"
ON "email_folders" ("module", (COALESCE("parentId", '')), (LOWER("name")));

-- Keep venue-scoped email templates/segments as nullable when a venue is deleted.
ALTER TABLE "email_templates"
  DROP CONSTRAINT IF EXISTS "email_templates_venueId_fkey";
ALTER TABLE "email_templates"
  ADD CONSTRAINT "email_templates_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "venues"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "email_segments"
  DROP CONSTRAINT IF EXISTS "email_segments_venueId_fkey";
ALTER TABLE "email_segments"
  ADD CONSTRAINT "email_segments_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "venues"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Template library imports are pure link records and can be removed with either side.
ALTER TABLE "template_library_imports"
  DROP CONSTRAINT IF EXISTS "template_library_imports_libraryItemId_fkey";
ALTER TABLE "template_library_imports"
  ADD CONSTRAINT "template_library_imports_libraryItemId_fkey"
  FOREIGN KEY ("libraryItemId") REFERENCES "template_library_items"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "template_library_imports"
  DROP CONSTRAINT IF EXISTS "template_library_imports_venueId_fkey";
ALTER TABLE "template_library_imports"
  ADD CONSTRAINT "template_library_imports_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "venues"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
