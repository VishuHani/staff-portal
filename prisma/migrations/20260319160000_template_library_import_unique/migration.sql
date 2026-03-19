-- Prevent duplicate imports of the same library item into the same venue.
CREATE UNIQUE INDEX IF NOT EXISTS "template_library_imports_library_item_venue_key"
ON "template_library_imports" ("libraryItemId", "venueId");
