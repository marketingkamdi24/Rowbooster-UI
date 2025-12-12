# Token Tracking & Pricing Fix - Complete Implementation

## Issue Summary

The user reported that token usage and costs were being calculated incorrectly. For example:
- **Reported**: 436,360 tokens for gpt-4.1-mini showing $2.4762
- **Expected**: With gpt-4.1-mini pricing ($0.40/1M input, $1.60/1M output), this should be approximately:
  - If mostly input: ~$0.17
  - If mostly output: ~$0.70
  - The $2.4762 was clearly wrong

## Root Causes Identified

1. **Incorrect pricing in multiple locations** - Different parts of the codebase had different (wrong) hardcoded pricing
2. **No separate input/output cost tracking** - Costs were estimated by proportionally splitting total cost instead of calculating separately
3. **No unique API call ID** - Each API request lacked a unique identifier for tracking

## Fixes Implemented

### 1. Centralized Pricing Configuration (`server/services/tokenTracker.ts`)

The correct pricing is now centralized in the PRICING constant:

```typescript
const PRICING = {
  "gpt-4.1": {
    INPUT_PRICE_PER_MILLION: 3.0,    // $3.00 per 1M input tokens
    OUTPUT_PRICE_PER_MILLION: 12.0,  // $12.00 per 1M output tokens
  },
  "gpt-4.1-mini": {
    INPUT_PRICE_PER_MILLION: 0.4,    // $0.40 per 1M input tokens
    OUTPUT_PRICE_PER_MILLION: 1.6,   // $1.60 per 1M output tokens
  },
  "gpt-4o": {
    INPUT_PRICE_PER_MILLION: 5.0,    // $5.00 per 1M input tokens
    OUTPUT_PRICE_PER_MILLION: 15.0,  // $15.00 per 1M output tokens
  },
  "gpt-4o-mini": {
    INPUT_PRICE_PER_MILLION: 0.15,   // $0.15 per 1M input tokens
    OUTPUT_PRICE_PER_MILLION: 0.60,  // $0.60 per 1M output tokens
  },
  // ... other models
};
```

### 2. Unique API Call ID Generation

Each API call now receives a unique ID for tracking:

```typescript
static generateApiCallId(): string {
  const timestamp = Date.now();
  const shortUuid = uuidv4().split('-')[0]; // First 8 characters of UUID
  return `api_${timestamp}_${shortUuid}`;
}
```

Format: `api_1733234567890_a1b2c3d4`

### 3. Token Reading from OpenAI API Response

The system correctly reads tokens from the OpenAI API response:

```typescript
// In openaiService.ts
const inputTokens = response.usage.prompt_tokens || 0;
const outputTokens = response.usage.completion_tokens || 0;
```

### 4. Separate Input/Output Cost Calculation

Costs are now calculated separately for input and output tokens:

```typescript
static calculateCost(modelName, numInputTokens, numOutputTokens) {
  const pricing = PRICING[normalizedModelName] || PRICING.default;
  
  const inputCost = (numInputTokens / 1_000_000) * pricing.INPUT_PRICE_PER_MILLION;
  const outputCost = (numOutputTokens / 1_000_000) * pricing.OUTPUT_PRICE_PER_MILLION;
  const totalCost = inputCost + outputCost;

  return { inputCost, outputCost, totalCost };
}
```

### 5. Database Schema Updates

The `token_usage` table now includes:
- `api_call_id` - Unique identifier for each API call
- `input_cost` - Separate cost for input tokens
- `output_cost` - Separate cost for output tokens
- `total_cost` - Sum of input and output costs

### 6. Frontend Pricing Configuration

The TokenMonitoringDashboard.tsx has matching pricing:

```typescript
const MODEL_PRICING = {
  'gpt-4.1': { input: 3.0 / 1000000, output: 12.0 / 1000000 },
  'gpt-4.1-mini': { input: 0.4 / 1000000, output: 1.6 / 1000000 },
  'gpt-4o': { input: 5.0 / 1000000, output: 15.0 / 1000000 },
  'gpt-4o-mini': { input: 0.15 / 1000000, output: 0.60 / 1000000 },
  'default': { input: 3.0 / 1000000, output: 12.0 / 1000000 }
};
```

## Files Modified

1. **`server/services/tokenTracker.ts`**
   - Added correct pricing configuration
   - Added `generateApiCallId()` method
   - Added `apiCallId` to token usage record
   - Added `validateTokenCounts()` helper
   - Added `getAllModelPricing()` for UI

2. **`server/services/openaiService.ts`**
   - Uses `TokenTracker.calculateCost()` for accurate pricing
   - Passes `inputCost`, `outputCost`, and `apiCallId` to monitoring

3. **`server/services/monitoringLogger.ts`**
   - Updated `AiApiCallLogEntry` interface with `inputCost`, `outputCost`, `apiCallId`
   - Uses correctly calculated costs instead of estimates

4. **`shared/schema.ts`**
   - Added `apiCallId` column to token_usage table
   - Added cost fields to recentCalls schema

5. **`client/src/components/TokenMonitoringDashboard.tsx`**
   - Fixed MODEL_PRICING to match server-side

6. **`scripts/migrate-api-call-id.sql`** (NEW)
   - Migration script to add api_call_id column to existing databases

## Verification

### Cost Calculation Examples

**Example 1: gpt-4.1-mini with 100,000 input + 50,000 output tokens**
```
Input cost:  100,000 / 1,000,000 × $0.40 = $0.04
Output cost:  50,000 / 1,000,000 × $1.60 = $0.08
Total cost: $0.12
```

**Example 2: gpt-4.1 with 100,000 input + 50,000 output tokens**
```
Input cost:  100,000 / 1,000,000 × $3.00 = $0.30
Output cost:  50,000 / 1,000,000 × $12.00 = $0.60
Total cost: $0.90
```

**Verifying the original issue (436,360 tokens for gpt-4.1-mini)**

Assuming a typical 3:1 input:output ratio:
- Input tokens: ~327,000
- Output tokens: ~109,000

```
Input cost:  327,000 / 1,000,000 × $0.40 = $0.1308
Output cost: 109,000 / 1,000,000 × $1.60 = $0.1744
Total cost: $0.3052
```

The original reported $2.4762 was indeed incorrect - the correct cost should be around $0.31.

## Database Migration

To apply the database migration and recalculate costs for existing data:

```bash
# Run the migration and recalculation script (recommended)
npm run db:recalculate-costs
```

This script will:
1. Add the `api_call_id` column if it doesn't exist
2. Add `input_cost` and `output_cost` columns if they don't exist
3. Recalculate all existing token usage records with correct pricing
4. Show a summary of the changes (old vs new costs)

## Console Logging

All token tracking now includes detailed console logging:

```
[TOKEN-TRACKER] api_1733234567890_a1b2c3d4 | user 123 | gpt-4.1-mini | extract | 
100000 input + 50000 output = 150000 total tokens | 
Cost: $0.12000000 (input: $0.04000000, output: $0.08000000)
```

## Summary

The token tracking system now:
1. ✅ Uses correct pricing from centralized configuration
2. ✅ Reads tokens correctly from OpenAI API response
3. ✅ Calculates input and output costs separately
4. ✅ Assigns unique IDs to each API call
5. ✅ Stores all cost details in the database
6. ✅ Displays correct pricing in the frontend dashboard