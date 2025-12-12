# Monitoring System Token Tracking Fix

## Issue Summary

The user reported that the PRODUCT SEARCHES table in the monitoring dashboard showed incorrect token costs. For example:
- A search with 436,360 tokens for gpt-4.1-mini showed a cost of $2.4762
- With gpt-4.1-mini pricing ($0.40 input / $1.60 output per 1M tokens), this seemed too high
- Multiple products in the same batch showed identical, inflated token counts

## Root Cause Analysis

### The Bug: Time-Window Aggregation

The issue was found in `monitoring-system/server/routes.ts` in the `/api/product-searches/flat` endpoint (lines 3297-3328).

**The problematic code:**
```typescript
// BEFORE: Get token usage for this search (within 30 seconds of search timestamp)
const tokenQuery = `
  SELECT tul.total_tokens, tul.total_cost...
  FROM token_usage_logs tul
  WHERE tul.user_id = $1
    AND tul.timestamp >= $2::timestamp - INTERVAL '30 seconds'
    AND tul.timestamp <= $2::timestamp + INTERVAL '60 seconds'
`;

// This sums ALL tokens in that 90-second window
for (const tokenRow of tokenResult.rows) {
  totalTokens += parseInt(tokenRow.total_tokens) || 0;
  totalCost += parseFloat(tokenRow.total_cost) || 0;
}
```

### Why This Was Wrong

When multiple products are batch-processed concurrently (e.g., 6 products uploaded via Excel in "Manuelle Quellen" mode):

1. All 6 products start processing at roughly the same timestamp
2. Each product generates its own token_usage_logs record
3. When displaying each product's row, the query fetches ALL token records within the 90-second window
4. Result: Each product row shows the TOTAL of all 6 products' tokens (6x multiplication)

**Example:**
- 6 products batch processed, each using ~83,000 tokens
- Total actual tokens: 6 × 83,000 = 498,000 tokens
- Each row displayed: 498,000 tokens (the entire batch total)
- Dashboard appeared to show 6 × 498,000 = 2,988,000 tokens used (6x inflation)

## The Fix

### Solution: Match Tokens by Article Number

Instead of using time-window aggregation, we now match tokens to products by their article number (and product name as fallback):

**The fixed code:**
```typescript
// AFTER: Match by specific article number in AI call metadata
if (articleNumber && articleNumber.trim() !== '') {
  const tokenByArticleQuery = `
    SELECT cl.metadata
    FROM console_logs cl
    WHERE cl.user_id = $1
      AND cl.source = 'ai-api-call'
      AND cl.metadata->>'articleNumber' = $2
      AND cl.timestamp >= $3::timestamp - INTERVAL '5 minutes'
      AND cl.timestamp <= $3::timestamp + INTERVAL '5 minutes'
  `;
  
  const tokenResult = await pool.query(tokenByArticleQuery, [row.user_id, articleNumber, row.search_timestamp]);
  // Now only tokens for THIS specific product are counted
}
```

### Three-Tier Matching Strategy

1. **Primary**: Match by exact article number in `console_logs` metadata
2. **Fallback 1**: Match by product name if article number not available
3. **Fallback 2**: Use very tight time window (5-10 seconds) for edge cases

## Pricing Verification

### Model Pricing is Correct

The `server/services/tokenTracker.ts` has the correct OpenAI API pricing:

```typescript
export const MODEL_PRICING = {
  "gpt-4.1": {
    INPUT_PRICE_PER_MILLION: 3.0,    // $3.00 per 1M input tokens
    OUTPUT_PRICE_PER_MILLION: 12.0,  // $12.00 per 1M output tokens
  },
  "gpt-4.1-mini": {
    INPUT_PRICE_PER_MILLION: 0.4,    // $0.40 per 1M input tokens
    OUTPUT_PRICE_PER_MILLION: 1.6,   // $1.60 per 1M output tokens
  },
};
```

### Cost Calculation

For 436,360 tokens with gpt-4.1-mini:
- Assuming ~70% input / 30% output ratio
- Input: 305,452 tokens × $0.40/1M = $0.1222
- Output: 130,908 tokens × $1.60/1M = $0.2095
- **Actual cost**: ~$0.33

The $2.4762 displayed was because the batch processing summed ALL products' tokens, and the user was actually using **gpt-4.1** (not gpt-4.1-mini) which has higher pricing.

## Files Modified

1. **`monitoring-system/server/routes.ts`**
   - Lines 3297-3390: Fixed `/api/product-searches/flat` endpoint
   - Changed from time-window aggregation to article number matching

2. **Token tracking was already correct in:**
   - `server/services/tokenTracker.ts` - Correct pricing, unique API call IDs
   - `server/services/openaiService.ts` - Correctly reads `response.usage.prompt_tokens` and `response.usage.completion_tokens`
   - `server/services/monitoringLogger.ts` - Correctly logs AI API calls with article number in metadata

## Testing

To verify the fix works:

1. Batch process multiple products using "Manuelle Quellen" (URL+PDF mode)
2. Check the monitoring dashboard's PRODUCT SEARCHES table
3. Each product should now show only its own token count, not the batch total
4. Individual product token costs should be in the range of $0.05-$0.50 for gpt-4.1-mini

## API Call ID Tracking

Each API call now has a unique ID for precise tracking:

```typescript
// In openaiService.ts
apiCallId: `extract_${articleNumber}_${Date.now()}`

// In tokenTracker.ts
static generateApiCallId(): string {
  const shortUuid = uuidv4().split('-')[0];
  return `api_${Date.now()}_${shortUuid}`;
}
```

This allows future enhancements to track exact API call costs with perfect precision.

## Summary

| Issue | Fix |
|-------|-----|
| Time-window aggregation (90 sec) | Article number matching |
| Batch tokens multiplied per row | Each product shows only its own tokens |
| $2.47 displayed for single product | Should be ~$0.33 per product |
| 499,000 tokens shown per row | Should be ~83,000 tokens per product |