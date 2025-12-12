-- Migration: Add session-based token tracking
-- This fixes the issue where tokens were incorrectly attributed using timestamp proximity
-- Now tokens will be directly linked to specific product searches via session_id

-- Step 1: Add session_id column to token_usage_logs
ALTER TABLE token_usage_logs 
ADD COLUMN IF NOT EXISTS session_id VARCHAR(100);

-- Step 2: Add product context columns to token_usage_logs for direct linking
ALTER TABLE token_usage_logs 
ADD COLUMN IF NOT EXISTS product_name VARCHAR(500);

ALTER TABLE token_usage_logs 
ADD COLUMN IF NOT EXISTS article_number VARCHAR(100);

-- Step 3: Add activity_log_id to directly link to the user_activity_logs entry
ALTER TABLE token_usage_logs 
ADD COLUMN IF NOT EXISTS activity_log_id INTEGER;

-- Step 4: Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_token_usage_logs_session_id 
ON token_usage_logs(session_id);

CREATE INDEX IF NOT EXISTS idx_token_usage_logs_activity_log_id 
ON token_usage_logs(activity_log_id);

CREATE INDEX IF NOT EXISTS idx_token_usage_logs_user_product 
ON token_usage_logs(user_id, product_name);

-- Step 5: Add session_id to console_logs for AI call tracking
ALTER TABLE console_logs 
ADD COLUMN IF NOT EXISTS extraction_session_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_console_logs_extraction_session_id 
ON console_logs(extraction_session_id);

-- Step 6: Add session tracking to user_activity_logs
ALTER TABLE user_activity_logs 
ADD COLUMN IF NOT EXISTS session_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_session_id 
ON user_activity_logs(session_id);

-- Verify the migration
SELECT 'Migration completed successfully. New columns added:' as status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'token_usage_logs' 
AND column_name IN ('session_id', 'product_name', 'article_number', 'activity_log_id');