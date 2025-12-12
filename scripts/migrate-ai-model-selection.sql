-- Migration script to add selected_ai_model column to users table
-- This column stores the user's preferred AI model for OpenAI API calls

-- Add the selected_ai_model column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'selected_ai_model'
    ) THEN
        ALTER TABLE users ADD COLUMN selected_ai_model TEXT DEFAULT 'gpt-4.1';
        RAISE NOTICE 'Column selected_ai_model added to users table';
    ELSE
        RAISE NOTICE 'Column selected_ai_model already exists in users table';
    END IF;
END $$;

-- Update all existing users to have the default model if they don't have one set
UPDATE users 
SET selected_ai_model = 'gpt-4.1' 
WHERE selected_ai_model IS NULL;

-- Verify the migration
SELECT 
    id, 
    username, 
    selected_ai_model 
FROM users 
ORDER BY id;