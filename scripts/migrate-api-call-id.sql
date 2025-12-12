-- Migration: Add api_call_id column to token_usage table
-- This migration adds a unique identifier for each API call for better tracking
-- Run this migration on your database to enable API call tracking

-- Add api_call_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_usage' AND column_name = 'api_call_id'
    ) THEN
        ALTER TABLE token_usage ADD COLUMN api_call_id TEXT;
        
        -- Create index for faster lookups by api_call_id
        CREATE INDEX IF NOT EXISTS idx_token_usage_api_call_id ON token_usage(api_call_id);
        
        RAISE NOTICE 'Added api_call_id column to token_usage table';
    ELSE
        RAISE NOTICE 'api_call_id column already exists in token_usage table';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'token_usage' 
ORDER BY ordinal_position;

-- Display current table structure
\d token_usage

-- Show sample data with new column
SELECT id, api_call_id, user_id, model_name, input_tokens, output_tokens, total_tokens, 
       input_cost, output_cost, total_cost, api_call_type, created_at
FROM token_usage 
ORDER BY created_at DESC 
LIMIT 5;