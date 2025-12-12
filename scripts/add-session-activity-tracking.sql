-- Add last activity tracking to sessions table for inactivity timeout
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP DEFAULT NOW();

-- Update existing sessions to have current timestamp
UPDATE sessions 
SET last_activity_at = created_at 
WHERE last_activity_at IS NULL;

-- Create index for faster session cleanup queries
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity 
ON sessions(last_activity_at);

-- Create index for faster expiration queries
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at 
ON sessions(expires_at);