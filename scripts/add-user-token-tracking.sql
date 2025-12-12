-- Add userId column to token_usage table for per-user tracking
ALTER TABLE token_usage
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Add index for faster user-specific queries
CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage(user_id);

-- Add index for combined queries (user + date)
CREATE INDEX IF NOT EXISTS idx_token_usage_user_date ON token_usage(user_id, created_at);

-- Add cost columns for accurate pricing
ALTER TABLE token_usage
ADD COLUMN IF NOT EXISTS input_cost DECIMAL(10, 6) DEFAULT 0,
ADD COLUMN IF NOT EXISTS output_cost DECIMAL(10, 6) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10, 6) DEFAULT 0;

-- Update existing records to set userId to NULL (anonymous usage)
-- This preserves historical data while allowing new tracking
COMMENT ON COLUMN token_usage.user_id IS 'User who made the API call - NULL for legacy/anonymous calls';
COMMENT ON COLUMN token_usage.input_cost IS 'Cost in USD for input tokens';
COMMENT ON COLUMN token_usage.output_cost IS 'Cost in USD for output tokens';
COMMENT ON COLUMN token_usage.total_cost IS 'Total cost in USD (input + output)';