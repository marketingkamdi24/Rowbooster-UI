-- Migration: Add search_session_id column to token_usage_logs and user_activity_logs
-- Purpose: Enable reliable token tracking across concurrent users by using unique session IDs
-- Format: userId_productHash_timestamp (e.g., "1_aduro9_2025-12-04T14-30-00")
--
-- Run this on Render PostgreSQL production database:
-- psql -h <host> -U <user> -d <database> -f scripts/migrate-search-session-id.sql

-- Add columns to token_usage_logs if they don't exist
DO $$
BEGIN
    -- Add search_session_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_usage_logs' AND column_name = 'search_session_id'
    ) THEN
        ALTER TABLE token_usage_logs ADD COLUMN search_session_id TEXT;
        RAISE NOTICE 'Added search_session_id column to token_usage_logs';
    ELSE
        RAISE NOTICE 'search_session_id column already exists in token_usage_logs';
    END IF;

    -- Add article_number column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_usage_logs' AND column_name = 'article_number'
    ) THEN
        ALTER TABLE token_usage_logs ADD COLUMN article_number TEXT;
        RAISE NOTICE 'Added article_number column to token_usage_logs';
    ELSE
        RAISE NOTICE 'article_number column already exists in token_usage_logs';
    END IF;

    -- Add product_name column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_usage_logs' AND column_name = 'product_name'
    ) THEN
        ALTER TABLE token_usage_logs ADD COLUMN product_name TEXT;
        RAISE NOTICE 'Added product_name column to token_usage_logs';
    ELSE
        RAISE NOTICE 'product_name column already exists in token_usage_logs';
    END IF;
END $$;

-- Add column to user_activity_logs if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_activity_logs' AND column_name = 'search_session_id'
    ) THEN
        ALTER TABLE user_activity_logs ADD COLUMN search_session_id TEXT;
        RAISE NOTICE 'Added search_session_id column to user_activity_logs';
    ELSE
        RAISE NOTICE 'search_session_id column already exists in user_activity_logs';
    END IF;
END $$;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_token_usage_logs_session 
    ON token_usage_logs(search_session_id);
    
CREATE INDEX IF NOT EXISTS idx_token_usage_logs_article 
    ON token_usage_logs(article_number);
    
CREATE INDEX IF NOT EXISTS idx_token_usage_logs_product 
    ON token_usage_logs(product_name);

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_session 
    ON user_activity_logs(search_session_id);

-- Verify columns were added
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name IN ('token_usage_logs', 'user_activity_logs')
    AND column_name IN ('search_session_id', 'article_number', 'product_name')
ORDER BY table_name, column_name;

-- Show current indexes
SELECT 
    tablename, 
    indexname 
FROM pg_indexes 
WHERE tablename IN ('token_usage_logs', 'user_activity_logs')
    AND indexname LIKE '%session%' OR indexname LIKE '%article%' OR indexname LIKE '%product%'
ORDER BY tablename;

SELECT 'Migration complete! New columns added for reliable token tracking.' AS status;