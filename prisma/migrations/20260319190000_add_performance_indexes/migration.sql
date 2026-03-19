-- Composite indexes for high-frequency list and permission-related queries
CREATE INDEX IF NOT EXISTS "messages_conversation_deleted_created_idx"
  ON "messages" ("conversationId", "deletedAt", "createdAt");

CREATE INDEX IF NOT EXISTS "messages_conversation_sender_deleted_created_idx"
  ON "messages" ("conversationId", "senderId", "deletedAt", "createdAt");

CREATE INDEX IF NOT EXISTS "rosters_venue_status_start_created_idx"
  ON "rosters" ("venueId", "status", "startDate", "createdAt");

CREATE INDEX IF NOT EXISTS "email_campaigns_venue_status_created_idx"
  ON "email_campaigns" ("venueId", "status", "createdAt");
