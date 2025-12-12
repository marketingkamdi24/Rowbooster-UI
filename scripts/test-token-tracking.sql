-- Test script to verify per-user token tracking implementation

-- 1. Check table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'token_usage'
ORDER BY ordinal_position;

-- 2. Check indexes
SELECT 
    indexname, 
    indexdef
FROM pg_indexes 
WHERE tablename = 'token_usage';

-- 3. View recent token usage (if any)
SELECT 
    id,
    user_id,
    model_provider,
    model_name,
    input_tokens,
    output_tokens,
    total_tokens,
    input_cost,
    output_cost,
    total_cost,
    api_call_type,
    created_at
FROM token_usage 
ORDER BY created_at DESC 
LIMIT 10;

-- 4. Per-user usage summary
SELECT 
    user_id,
    COUNT(*) as total_calls,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    SUM(total_tokens) as total_tokens,
    SUM(CAST(total_cost AS DECIMAL(10,8))) as total_cost_usd
FROM token_usage 
GROUP BY user_id
ORDER BY total_cost_usd DESC;

-- 5. Daily usage breakdown
SELECT 
    DATE(created_at) as usage_date,
    user_id,
    model_name,
    COUNT(*) as calls,
    SUM(total_tokens) as tokens,
    SUM(CAST(total_cost AS DECIMAL(10,8))) as cost_usd
FROM token_usage 
GROUP BY DATE(created_at), user_id, model_name
ORDER BY usage_date DESC, cost_usd DESC;

-- 6. API call type breakdown
SELECT 
    api_call_type,
    COUNT(*) as call_count,
    AVG(input_tokens) as avg_input_tokens,
    AVG(output_tokens) as avg_output_tokens,
    SUM(CAST(total_cost AS DECIMAL(10,8))) as total_cost_usd
FROM token_usage 
GROUP BY api_call_type
ORDER BY total_cost_usd DESC;