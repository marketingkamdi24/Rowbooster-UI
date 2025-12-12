# 🚨 CRITICAL: Token Tracking Not Working - Root Cause Analysis

## Problem Identified

From your server logs, I can see:
1. `[ANALYZE-CONTENT] Processing request for user anonymous` ← **userId is NULL**
2. AI extraction is happening (7 sources processed)
3. **NO [TOKEN-TRACKER] log messages** ← Token tracking code is NOT executing

## Root Causes

### Issue #1: Routes Don't Require Authentication
The `/api/analyze-content` endpoint doesn't have the `requireAuth` middleware, so `req.user` is always undefined.

**Current (WRONG):**
```typescript
app.post("/api/analyze-content", async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || null;  // req.user is undefined!
```

**Should Be:**
```typescript
app.post("/api/analyze-content", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || null;  // Now req.user exists
```

### Issue #2: Token Tracking in extractFromSingleSource
The tracking code was added but might have issues with the async import or error handling.

## Required Fixes

### 1. Add `requireAuth` Middleware to Routes

In `server/routes.ts`, add `requireAuth` to these endpoints:

```typescript
// Line ~1330
app.post("/api/analyze-content", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  
// Line ~854  
app.post("/api/batch-analyze-content", requireAuth, async (req: AuthenticatedRequest, res: Response) => {

// Line ~2824
app.post("/api/extract-url-product-data", requireAuth, async (req: AuthenticatedRequest, res: Response) => {

// Line ~3539
app.post("/api/search/pdf-extract", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
```

### 2. Verify Token Tracking Import

In `server/services/openaiService.ts`, ensure TokenTracker is imported at the top:

```typescript
import { TokenTracker } from "./tokenTracker";  // Should be at top of file
```

Not a dynamic import like:
```typescript
const { TokenTracker } = await import('./tokenTracker');  // This can fail silently
```

## Testing After Fix

1. **Restart server:**
```bash
# Stop server (Ctrl+C in terminal)
npm run dev
```

2. **Make a request:**
   - Login to the app
   - Search for a product
   - Click "Analyze Content"

3. **Check logs:**
You should see:
```
[ANALYZE-CONTENT] Processing request for user 9 (username: Rahmat)
...
[SOURCE-1] Token usage: 1234 input + 567 output tokens for user 9
[TOKEN-TRACKER] user 9 | gpt-4.1-nano | extract-source-1 | ... | Cost: $...
```

4. **Check database:**
```bash
psql -U postgres -d rowbooster -c "SELECT user_id, model_name, input_tokens, output_tokens, total_cost, api_call_type FROM token_usage ORDER BY created_at DESC LIMIT 5;"
```

## Quick Verification Command

After making a search, run:
```bash
psql -U postgres -d rowbooster -c "SELECT COUNT(*) as records, SUM(total_tokens) as total_tokens FROM token_usage;"
```

If you see records > 0, it's working!