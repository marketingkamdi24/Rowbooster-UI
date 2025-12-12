# Per-User Token and API Call Tracking

## Overview

The application now tracks tokens and API calls **separately for each user**, allowing you to monitor usage and costs on a per-user basis. This is essential for multi-user environments where you need to track individual usage for billing, quotas, or analytics.

## Features

✅ **Per-User Token Tracking** - Each user's API calls are tracked separately  
✅ **Accurate Cost Calculation** - Precise cost tracking using tiktoken with model-specific pricing  
✅ **Anonymous/System Calls** - Support for tracking system calls without a user ID  
✅ **Time-based Statistics** - Daily, weekly, and monthly usage breakdowns per user  
✅ **API Endpoints** - RESTful endpoints for retrieving per-user statistics  
✅ **Database Indexes** - Optimized queries with proper indexing  

## Database Schema

The `token_usage` table includes:

```sql
CREATE TABLE token_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- NULL for system calls
  model_provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  input_cost TEXT NOT NULL DEFAULT '0',
  output_cost TEXT NOT NULL DEFAULT '0',
  total_cost TEXT NOT NULL DEFAULT '0',
  api_call_type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_token_usage_user_id ON token_usage(user_id);
CREATE INDEX idx_token_usage_user_date ON token_usage(user_id, created_at);
CREATE INDEX idx_token_usage_created_at ON token_usage(created_at);
```

## Usage in Code

### Tracking Token Usage

The `TokenTracker` service automatically tracks usage when you make API calls:

```typescript
import { TokenTracker } from "./services/tokenTracker";

// Track usage for a specific user
await TokenTracker.trackOpenAIUsage(
  userId,           // User ID from authenticated request
  "gpt-4.1",       // Model name
  inputTokens,     // Number of input tokens
  outputTokens,    // Number of output tokens
  "search"         // API call type
);

// Track system/anonymous calls
await TokenTracker.trackOpenAIUsage(
  null,            // null for system calls
  "gpt-4.1",
  inputTokens,
  outputTokens,
  "background-task"
);
```

### Getting Per-User Statistics

```typescript
import { storage } from "./storage";

// Get statistics for a specific user
const userStats = await storage.getTokenUsageStatsByUser(userId);
console.log(`Total cost for user ${userId}: $${userStats.costEstimate}`);
console.log(`Total calls: ${userStats.totalCalls}`);
console.log(`Today's usage: ${userStats.todayUsage.totalTokens} tokens`);

// Get recent calls for a specific user
const recentCalls = await storage.getRecentTokenUsageByUser(userId, 50);
```

### Getting Global Statistics

```typescript
// Get statistics for all users combined
const globalStats = await storage.getTokenUsageStats();
console.log(`Total system cost: $${globalStats.costEstimate}`);
console.log(`Total API calls: ${globalStats.totalCalls}`);
```

## API Endpoints

### Per-User Endpoints

**Get User Token Usage Statistics**
```http
GET /api/token-usage/stats/user/:userId
Authorization: Required (user must be owner or admin)

Response:
{
  "totalInputTokens": 3000,
  "totalOutputTokens": 1500,
  "totalTokens": 4500,
  "totalCalls": 2,
  "costEstimate": 0.027,
  "todayUsage": {
    "inputTokens": 3000,
    "outputTokens": 1500,
    "totalTokens": 4500,
    "calls": 2
  },
  "weeklyUsage": { ... },
  "monthlyUsage": { ... },
  "recentCalls": [ ... ]
}
```

**Get User Recent Token Usage**
```http
GET /api/token-usage/recent/user/:userId?limit=50
Authorization: Required (user must be owner or admin)

Response:
[
  {
    "id": 123,
    "modelName": "gpt-4.1",
    "inputTokens": 2000,
    "outputTokens": 1000,
    "totalTokens": 3000,
    "totalCost": "0.01800000",
    "apiCallType": "search",
    "createdAt": "2025-11-21T09:30:00.000Z"
  },
  ...
]
```

### Global Endpoints

**Get Global Token Usage Statistics**
```http
GET /api/token-usage/stats
Authorization: Required

Response: Same structure as per-user, but aggregated for all users
```

**Get Global Recent Token Usage**
```http
GET /api/token-usage/recent?limit=50
Authorization: Required

Response: Array of token usage entries from all users
```

## Security

- **Authentication Required**: All endpoints require authentication
- **Authorization**: Users can only view their own statistics unless they are admins
- **User Isolation**: Each user's data is completely isolated in the database
- **Proper Indexing**: Queries are optimized to prevent performance issues

## Cost Calculation

Per-user costs are calculated using model-specific pricing:

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| GPT-4.1 | $3.00 | $12.00 |
| GPT-4o-mini | $0.15 | $0.60 |
| GPT-4.1-nano | $0.15 | $0.60 |

Example:
- User makes call with 1000 input tokens and 500 output tokens using GPT-4.1
- Input cost: (1000 / 1,000,000) × $3.00 = $0.003
- Output cost: (500 / 1,000,000) × $12.00 = $0.006
- **Total cost: $0.009**

## Testing

Run the test script to verify per-user tracking:

```bash
npx tsx server/test-token-tracking.ts
```

The test will:
- Create test users
- Track API calls for different users
- Verify user isolation
- Check cost calculations
- Test all API endpoints

## Integration in Routes

The token tracking is integrated into API routes that use OpenAI:

```typescript
// In /api/analyze-content
const userId = req.user?.id || null;

// TokenTracker is called automatically by openaiService
await openaiService.extractTechnicalSpecifications(
  htmlContents,
  articleNumber,
  productName,
  properties,
  userId  // Pass userId for tracking
);
```

## Example Client Usage

```typescript
// Frontend code to get current user's statistics
const response = await fetch(`/api/token-usage/stats/user/${currentUserId}`, {
  headers: {
    'Authorization': `Bearer ${sessionToken}`
  }
});

const stats = await response.json();
console.log(`You've used ${stats.totalTokens} tokens this month`);
console.log(`Your total cost: $${stats.costEstimate.toFixed(2)}`);
```

## Benefits

1. **Individual Usage Tracking** - Know exactly how much each user is consuming
2. **Cost Attribution** - Accurately attribute costs to specific users
3. **Quota Management** - Implement per-user quotas based on tracked usage
4. **Billing** - Generate accurate bills for each user
5. **Analytics** - Understand usage patterns per user
6. **Audit Trail** - Complete history of who used what and when

## Migration

If you have existing token usage data, it will continue to work:
- Existing entries with `user_id = NULL` are treated as system calls
- New entries automatically include the user ID when available
- The schema uses `ON DELETE SET NULL` so deleting a user won't delete their usage history

## Performance

The implementation is optimized for performance:
- Database indexes on `user_id` and `created_at`
- Efficient queries using Drizzle ORM
- Minimal overhead when tracking usage
- Batch operations where possible

## Troubleshooting

**Issue: userId is always null**
- Check that authentication middleware is running before the API routes
- Verify that `req.user?.id` is being passed to the tracking functions

**Issue: Foreign key constraint error**
- Ensure the user exists before tracking usage
- Use `null` for system/anonymous calls

**Issue: Incorrect costs**
- Verify the model name matches the pricing table
- Check that input/output tokens are counted correctly
- Ensure tiktoken is installed: `npm install @dqbd/tiktoken`