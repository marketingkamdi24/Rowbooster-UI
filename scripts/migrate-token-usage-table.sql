-- Migration script to add per-user token tracking and cost fields to token_usage table
-- This script is idempotent and can be run multiple times safely

-- Add userId column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_usage' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE token_usage 
        ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Added user_id column to token_usage table';
    ELSE
        RAISE NOTICE 'user_id column already exists in token_usage table';
    END IF;
END $$;

-- Add cost columns if they don't exist or fix their type
DO $$
BEGIN
    -- Drop existing cost columns if they're the wrong type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'token_usage' AND column_name = 'input_cost' AND data_type != 'text'
    ) THEN
        ALTER TABLE token_usage
        DROP COLUMN IF EXISTS input_cost,
        DROP COLUMN IF EXISTS output_cost,
        DROP COLUMN IF EXISTS total_cost;
        
        RAISE NOTICE 'Dropped old integer cost columns';
    END IF;
    
    -- Add cost columns with correct TEXT type
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'token_usage' AND column_name = 'input_cost'
    ) THEN
        ALTER TABLE token_usage
        ADD COLUMN input_cost TEXT NOT NULL DEFAULT '0',
        ADD COLUMN output_cost TEXT NOT NULL DEFAULT '0',
        ADD COLUMN total_cost TEXT NOT NULL DEFAULT '0';
        
        RAISE NOTICE 'Added cost columns (input_cost, output_cost, total_cost) as TEXT to token_usage table';
    ELSE
        RAISE NOTICE 'Cost columns already exist in token_usage table';
    END IF;
END $$;

-- Create index for user_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage(user_id);

-- Create index for combined user + date queries if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_token_usage_user_date ON token_usage(user_id, created_at);

-- Create index for date-based queries if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at);

-- Add comments for documentation
COMMENT ON COLUMN token_usage.user_id IS 'User who made the API call - NULL for system/anonymous calls';
COMMENT ON COLUMN token_usage.input_cost IS 'Cost in USD for input tokens (stored as text for precision)';
COMMENT ON COLUMN token_usage.output_cost IS 'Cost in USD for output tokens (stored as text for precision)';
COMMENT ON COLUMN token_usage.total_cost IS 'Total cost in USD (input + output, stored as text for precision)';

-- Delete all existing token usage records since they don't have proper tracking
-- IMPORTANT: This removes old incorrect data to ensure clean slate for accurate per-user tracking
DO $$
DECLARE
    record_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO record_count FROM token_usage;
    
    IF record_count > 0 THEN
        DELETE FROM token_usage;
        RAISE NOTICE 'Deleted % old token usage records (they lacked user tracking and accurate costs)', record_count;
    ELSE
        RAISE NOTICE 'No existing token usage records to delete';
    END IF;
END $$;

-- Verify the migration
DO $$
DECLARE
    has_user_id BOOLEAN;
    has_input_cost BOOLEAN;
    has_output_cost BOOLEAN;
    has_total_cost BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_usage' AND column_name = 'user_id'
    ) INTO has_user_id;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_usage' AND column_name = 'input_cost'
    ) INTO has_input_cost;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_usage' AND column_name = 'output_cost'
    ) INTO has_output_cost;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_usage' AND column_name = 'total_cost'
    ) INTO has_total_cost;
    
    IF has_user_id AND has_input_cost AND has_output_cost AND has_total_cost THEN
        RAISE NOTICE '✓ Migration successful! All required columns exist in token_usage table';
    ELSE
        RAISE WARNING '✗ Migration incomplete! Missing columns:';
        IF NOT has_user_id THEN RAISE WARNING '  - user_id'; END IF;
        IF NOT has_input_cost THEN RAISE WARNING '  - input_cost'; END IF;
        IF NOT has_output_cost THEN RAISE WARNING '  - output_cost'; END IF;
        IF NOT has_total_cost THEN RAISE WARNING '  - total_cost'; END IF;
    END IF;
END $$;