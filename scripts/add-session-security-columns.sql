-- Migration: Add session security columns
-- This migration adds tracking columns to the sessions table for security improvements
-- Run this migration to enable:
-- - Last activity tracking (for idle timeout)
-- - User agent tracking (for session security)
-- - IP address tracking (for audit logs)

-- Add lastActivity column with default to current timestamp
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP DEFAULT NOW();

-- Add userAgent column for tracking the browser/device
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Add ipAddress column for tracking login location
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Update existing sessions to have current timestamp as last_activity
UPDATE sessions 
SET last_activity = COALESCE(created_at, NOW())
WHERE last_activity IS NULL;

-- Add index on last_activity for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity 
ON sessions (last_activity);

-- Add index on expires_at for efficient expiry queries
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at 
ON sessions (expires_at);

-- Add composite index for user session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_id_expires 
ON sessions (user_id, expires_at);

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Session security columns migration completed successfully';
END $$;