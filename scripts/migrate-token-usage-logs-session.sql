-- Migration script to add session-based tracking columns to token_usage_logs table
-- This enables accurate token attribution to specific product searches
-- Run this script on existing databases to add the missing columns

-- Add session_id column for linking token usage to specific search sessions
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_usage_logs' AND column_name = 'session_id'
    ) THEN
        ALTER TABLE token_usage_logs ADD COLUMN session_id TEXT;
        RAISE NOTICE 'Added session_id column to token_usage_logs table';
    ELSE
        RAISE NOTICE 'session_id column already exists in token_usage_logs table';
    END IF;
END $$;

-- Add product_name column for direct product identification
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_usage_logs' AND column_name = 'product_name'
    ) THEN
        ALTER TABLE token_usage_logs ADD COLUMN product_name TEXT;
        RAISE NOTICE 'Added product_name column to token_usage_logs table';
    ELSE
        RAISE NOTICE 'product_name column already exists in token_usage_logs table';
    END IF;
END $$;

-- Add article_number column for product identification
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_usage_logs' AND column_name = 'article_number'
    ) THEN
        ALTER TABLE token_usage_logs ADD COLUMN article_number TEXT;
        RAISE NOTICE 'Added article_number column to token_usage_logs table';
    ELSE
        RAISE NOTICE 'article_number column already exists in token_usage_logs table';
    END IF;
END $$;

-- Add activity_log_id column for linking to user_activity_logs
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_usage_logs' AND column_name = 'activity_log_id'
    ) THEN
        ALTER TABLE token_usage_logs ADD COLUMN activity_log_id INTEGER;
        RAISE NOTICE 'Added activity_log_id column to token_usage_logs table';
    ELSE
        RAISE NOTICE 'activity_log_id column already exists in token_usage_logs table';
    END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_token_usage_logs_session_id ON token_usage_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_logs_product_name ON token_usage_logs(product_name);

-- Verify the migration
DO $$
DECLARE
    has_session_id BOOLEAN;
    has_product_name BOOLEAN;
    has_article_number BOOLEAN;
    has_activity_log_id BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_usage_logs' AND column_name = 'session_id'
    ) INTO has_session_id;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_usage_logs' AND column_name = 'product_name'
    ) INTO has_product_name;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_usage_logs' AND column_name = 'article_number'
    ) INTO has_article_number;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_usage_logs' AND column_name = 'activity_log_id'
    ) INTO has_activity_log_id;
    
    IF has_session_id AND has_product_name AND has_article_number AND has_activity_log_id THEN
        RAISE NOTICE '✓ Migration successful! All session tracking columns exist in token_usage_logs table';
    ELSE
        RAISE WARNING '✗ Migration incomplete! Missing columns:';
        IF NOT has_session_id THEN RAISE WARNING '  - session_id'; END IF;
        IF NOT has_product_name THEN RAISE WARNING '  - product_name'; END IF;
        IF NOT has_article_number THEN RAISE WARNING '  - article_number'; END IF;
        IF NOT has_activity_log_id THEN RAISE WARNING '  - activity_log_id'; END IF;
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN token_usage_logs.session_id IS 'Unique identifier linking token usage to a specific search session';
COMMENT ON COLUMN token_usage_logs.product_name IS 'Name of the product being searched during this token usage';
COMMENT ON COLUMN token_usage_logs.article_number IS 'Article number of the product if available';
COMMENT ON COLUMN token_usage_logs.activity_log_id IS 'Reference to user_activity_logs entry for this search';