-- Phase 3, Task 3.1: Notification Preferences Schema
-- This migration adds notification preferences and channels

-- Create NotificationChannel enum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'SMS');

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "channels" "NotificationChannel"[] NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "notification_preferences_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_userId_type_key" 
  ON "notification_preferences"("userId", "type");

-- Create indexes
CREATE INDEX IF NOT EXISTS "notification_preferences_userId_idx" 
  ON "notification_preferences"("userId");

CREATE INDEX IF NOT EXISTS "notification_preferences_type_idx" 
  ON "notification_preferences"("type");
