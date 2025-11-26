-- Database Constraints - Phase 4 Code Quality (Nov 2025)
--
-- These constraints add database-level validation beyond what Prisma provides.
-- Run these after your Prisma migrations.
--
-- Usage:
--   psql -d your_database -f prisma/constraints.sql
-- Or in Supabase SQL Editor

-- ============================================================================
-- TimeOffRequest Constraints
-- ============================================================================

-- Ensure startDate is before or equal to endDate
ALTER TABLE time_off_requests
  DROP CONSTRAINT IF EXISTS check_time_off_date_range;

ALTER TABLE time_off_requests
  ADD CONSTRAINT check_time_off_date_range
  CHECK ("startDate" <= "endDate");

-- Ensure status is one of the valid values
ALTER TABLE time_off_requests
  DROP CONSTRAINT IF EXISTS check_time_off_status;

ALTER TABLE time_off_requests
  ADD CONSTRAINT check_time_off_status
  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'));

-- Ensure type is one of the valid values
ALTER TABLE time_off_requests
  DROP CONSTRAINT IF EXISTS check_time_off_type;

ALTER TABLE time_off_requests
  ADD CONSTRAINT check_time_off_type
  CHECK (type IN ('VACATION', 'SICK', 'PERSONAL', 'OTHER'));

-- Ensure version is non-negative (for optimistic locking)
ALTER TABLE time_off_requests
  DROP CONSTRAINT IF EXISTS check_time_off_version;

ALTER TABLE time_off_requests
  ADD CONSTRAINT check_time_off_version
  CHECK (version >= 0);

-- ============================================================================
-- Availability Constraints
-- ============================================================================

-- Ensure dayOfWeek is 0-6 (Sunday-Saturday)
ALTER TABLE availability
  DROP CONSTRAINT IF EXISTS check_availability_day;

ALTER TABLE availability
  ADD CONSTRAINT check_availability_day
  CHECK ("dayOfWeek" >= 0 AND "dayOfWeek" <= 6);

-- ============================================================================
-- Channel Constraints
-- ============================================================================

-- Ensure channel type is valid
ALTER TABLE channels
  DROP CONSTRAINT IF EXISTS check_channel_type;

ALTER TABLE channels
  ADD CONSTRAINT check_channel_type
  CHECK (type IN ('GENERAL', 'ANNOUNCEMENTS', 'SOCIAL'));

-- Ensure memberCount is non-negative
ALTER TABLE channels
  DROP CONSTRAINT IF EXISTS check_channel_member_count;

ALTER TABLE channels
  ADD CONSTRAINT check_channel_member_count
  CHECK ("memberCount" >= 0);

-- ============================================================================
-- ChannelMember Constraints
-- ============================================================================

-- Ensure role is valid
ALTER TABLE channel_members
  DROP CONSTRAINT IF EXISTS check_channel_member_role;

ALTER TABLE channel_members
  ADD CONSTRAINT check_channel_member_role
  CHECK (role IN ('CREATOR', 'MODERATOR', 'MEMBER'));

-- ============================================================================
-- Venue Constraints
-- ============================================================================

-- Ensure business hours format is valid (HH:MM)
-- Note: This is a simple check, more complex validation should be in application
ALTER TABLE venues
  DROP CONSTRAINT IF EXISTS check_venue_business_hours_start;

ALTER TABLE venues
  ADD CONSTRAINT check_venue_business_hours_start
  CHECK ("businessHoursStart" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE venues
  DROP CONSTRAINT IF EXISTS check_venue_business_hours_end;

ALTER TABLE venues
  ADD CONSTRAINT check_venue_business_hours_end
  CHECK ("businessHoursEnd" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- ============================================================================
-- Post Constraints
-- ============================================================================

-- Ensure content is not empty
ALTER TABLE posts
  DROP CONSTRAINT IF EXISTS check_post_content;

ALTER TABLE posts
  ADD CONSTRAINT check_post_content
  CHECK (length(content) > 0);

-- ============================================================================
-- Comment Constraints
-- ============================================================================

-- Ensure content is not empty
ALTER TABLE comments
  DROP CONSTRAINT IF EXISTS check_comment_content;

ALTER TABLE comments
  ADD CONSTRAINT check_comment_content
  CHECK (length(content) > 0);

-- ============================================================================
-- Message Constraints
-- ============================================================================

-- Ensure content is not empty
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS check_message_content;

ALTER TABLE messages
  ADD CONSTRAINT check_message_content
  CHECK (length(content) > 0);

-- ============================================================================
-- Notification Constraints
-- ============================================================================

-- Ensure title is not empty
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS check_notification_title;

ALTER TABLE notifications
  ADD CONSTRAINT check_notification_title
  CHECK (length(title) > 0);

-- ============================================================================
-- User Constraints
-- ============================================================================

-- Ensure email format is valid (basic check)
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS check_user_email;

ALTER TABLE users
  ADD CONSTRAINT check_user_email
  CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$');

-- ============================================================================
-- Summary of Constraints Added:
-- ============================================================================
--
-- time_off_requests:
--   - check_time_off_date_range: startDate <= endDate
--   - check_time_off_status: status IN ('PENDING', 'APPROVED', 'REJECTED')
--   - check_time_off_type: type IN ('VACATION', 'SICK', 'PERSONAL', 'OTHER')
--   - check_time_off_version: version >= 0
--
-- availability:
--   - check_availability_day: dayOfWeek BETWEEN 0 AND 6
--
-- channels:
--   - check_channel_type: type IN ('GENERAL', 'ANNOUNCEMENTS', 'SOCIAL')
--   - check_channel_member_count: memberCount >= 0
--
-- channel_members:
--   - check_channel_member_role: role IN ('CREATOR', 'MODERATOR', 'MEMBER')
--
-- venues:
--   - check_venue_business_hours_start: HH:MM format
--   - check_venue_business_hours_end: HH:MM format
--
-- posts:
--   - check_post_content: content not empty
--
-- comments:
--   - check_comment_content: content not empty
--
-- messages:
--   - check_message_content: content not empty
--
-- notifications:
--   - check_notification_title: title not empty
--
-- users:
--   - check_user_email: valid email format
--
-- Total: 15 CHECK constraints
