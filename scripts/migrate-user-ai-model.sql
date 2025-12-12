-- Migration: Add selectedAiModel column to users table
-- This allows each user to select their preferred AI model (gpt-4.1 or gpt-4.1-mini)

-- Add the column with default value
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS selected_ai_model TEXT DEFAULT 'gpt-4.1';

-- Update any NULL values to the default
UPDATE users 
SET selected_ai_model = 'gpt-4.1' 
WHERE selected_ai_model IS NULL;

-- Verify the migration
SELECT 
  'Migration completed successfully' AS status,
  COUNT(*) AS total_users,
  COUNT(selected_ai_model) AS users_with_model_set
FROM users;

-- Show sample of updated users
SELECT id, username, selected_ai_model 
FROM users 
ORDER BY id 
LIMIT 5;