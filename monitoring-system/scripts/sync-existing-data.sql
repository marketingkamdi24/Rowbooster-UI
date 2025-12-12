-- Sync existing token_usage data to monitoring system
-- This imports all existing token usage data from the main app

-- First, sync token usage data with usernames
INSERT INTO token_usage_logs (
  user_id, username, model_provider, model_name,
  input_tokens, output_tokens, total_tokens,
  input_cost, output_cost, total_cost,
  api_call_type, timestamp
)
SELECT 
  tu.user_id,
  COALESCE(u.username, 'Unknown') as username,
  tu.model_provider,
  tu.model_name,
  tu.input_tokens,
  tu.output_tokens,
  tu.total_tokens,
  tu.input_cost,
  tu.output_cost,
  tu.total_cost,
  tu.api_call_type,
  tu.created_at as timestamp
FROM token_usage tu
LEFT JOIN users u ON tu.user_id = u.id
WHERE tu.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Initialize user statistics from existing data
INSERT INTO user_statistics (
  user_id, username, total_api_calls, total_tokens_used, 
  total_cost, total_errors, total_sessions, last_activity, first_seen
)
SELECT 
  u.id as user_id,
  u.username,
  COALESCE(token_stats.call_count, 0) as total_api_calls,
  COALESCE(token_stats.total_tokens, 0) as total_tokens_used,
  COALESCE(token_stats.total_cost, '0') as total_cost,
  0 as total_errors,
  0 as total_sessions,
  token_stats.last_activity,
  u.created_at as first_seen
FROM users u
LEFT JOIN (
  SELECT 
    user_id,
    COUNT(*) as call_count,
    SUM(total_tokens)::BIGINT as total_tokens,
    SUM(CAST(total_cost AS DECIMAL))::TEXT as total_cost,
    MAX(created_at) as last_activity
  FROM token_usage
  WHERE user_id IS NOT NULL
  GROUP BY user_id
) token_stats ON u.id = token_stats.user_id
ON CONFLICT (user_id) DO UPDATE SET
  total_api_calls = EXCLUDED.total_api_calls,
  total_tokens_used = EXCLUDED.total_tokens_used,
  total_cost = EXCLUDED.total_cost,
  last_activity = EXCLUDED.last_activity,
  last_updated = NOW();

-- Log initial activity for users with token usage
INSERT INTO user_activity_logs (
  user_id, username, activity_type, action, 
  success, timestamp
)
SELECT DISTINCT
  tu.user_id,
  u.username,
  'api_call' as activity_type,
  'Historical AI API usage imported' as action,
  true as success,
  tu.created_at as timestamp
FROM token_usage tu
JOIN users u ON tu.user_id = u.id
WHERE tu.user_id IS NOT NULL
LIMIT 100 -- Limit to prevent overwhelming the activity log
ON CONFLICT DO NOTHING;

-- Show summary
SELECT 
  COUNT(DISTINCT user_id) as users_with_data,
  COUNT(*) as total_token_logs,
  SUM(total_tokens) as total_tokens,
  SUM(CAST(total_cost AS DECIMAL)) as total_cost
FROM token_usage_logs;

SELECT 
  user_id,
  username,
  total_api_calls,
  total_tokens_used,
  total_cost
FROM user_statistics
ORDER BY total_api_calls DESC;