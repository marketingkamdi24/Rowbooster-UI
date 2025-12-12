-- Migration: Add product identification columns to token_usage_logs
-- This allows reliable matching between token usage and product searches
-- without relying on tight time windows which don't work with multiple concurrent users
-- 
-- Date: 2025-12-04
-- Purpose: Fix token/price display issue in monitoring-system deployment

-- Add article_number column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'token_usage_logs'
        AND column_name = 'article_number'
    ) THEN
        ALTER TABLE token_usage_logs ADD COLUMN article_number TEXT;
        RAISE NOTICE 'Added article_number column to token_usage_logs';
    ELSE
        RAISE NOTICE 'article_number column already exists in token_usage_logs';
    END IF;
END $$;

-- Add product_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'token_usage_logs'
        AND column_name = 'product_name'
    ) THEN
        ALTER TABLE token_usage_logs ADD COLUMN product_name TEXT;
        RAISE NOTICE 'Added product_name column to token_usage_logs';
    ELSE
        RAISE NOTICE 'product_name column already exists in token_usage_logs';
    END IF;
END $$;

-- Create index on user_id + product_name for efficient lookups
CREATE INDEX IF NOT EXISTS idx_token_usage_logs_product 
ON token_usage_logs(user_id, product_name);

-- Create index on user_id + article_number for efficient lookups
CREATE INDEX IF NOT EXISTS idx_token_usage_logs_article 
ON token_usage_logs(user_id, article_number);

-- Verify the columns exist
DO $$
DECLARE
    col_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'token_usage_logs'
    AND column_name IN ('article_number', 'product_name');
    
    IF col_count = 2 THEN
        RAISE NOTICE 'Migration successful: Both article_number and product_name columns exist';
    ELSE
        RAISE WARNING 'Migration may have issues: Only % of 2 columns found', col_count;
    END IF;
END $$;

-- Show current table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'token_usage_logs'
ORDER BY ordinal_position;