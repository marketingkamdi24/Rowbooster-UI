# ✅ Per-User Token Tracking - FINAL SETUP INSTRUCTIONS

## Current Status

All code is in place and tested. The system is ready but requires a **server restart** to activate.

## 🔄 CRITICAL: Restart Server NOW

The changes won't take effect until you restart the server:

```bash
# In your terminal running the server:
# 1. Press Ctrl+C to stop
# 2. Wait for it to fully stop
# 3. Run:
npm run dev
```

## What Changed (Since Your Last Server Start)

### 1. ✅ Authentication Required
These endpoints now require login (`requireAuth` middleware added):
- `/api/analyze-content`
- `/api/batch-analyze-content`
- `/api/extract-url-product-data`
- `/api/search/pdf-extract`

**Before restart:** userId was always `null` (anonymous)  
**After restart:** userId will be your user ID (e.g., 9 for user "Rahmat")

### 2. ✅ Token Tracking Active
All GPT-4.1 API calls now track:
- Input tokens (counted with tiktoken)
- Output tokens (counted with tiktoken)
- Costs (precise calculation)
- User ID (who made the call)

### 3. ✅ Database Ready
- `token_usage` table has userId and cost columns
- Indexes created for fast queries
- Old incorrect data removed

## 🧪 After Restart - How to Test

### Step 1: Restart Server
```bash
npm run dev
```

### Step 2: Login
- Go to your app
- Login with your username (e.g., "Rahmat")

### Step 3: Make a Search
- Enter product name: "justus usedom 5"
- Click "Search" button
- Click "Analyze Content" button (this triggers GPT calls)

### Step 4: Check Server Logs
You should now see (this was MISSING before):
```
[ANALYZE-CONTENT] Processing request for user 9 (username: Rahmat)
...
[SOURCE-1] Token usage: 1234 input + 567 output tokens for user 9
[TOKEN-TRACKER] user 9 | gpt-4.1-nano | extract-source-1 | 1234 input + 567 output = 1801 total tokens | Cost: $0.00850200
[SOURCE-2] Token usage: ...
[TOKEN-TRACKER] user 9 | gpt-4.1-nano | extract-source-2 | ...
```

### Step 5: Check Database
```bash
psql -U postgres -d rowbooster -c "SELECT user_id, model_name, input_tokens, output_tokens, total_cost, api_call_type FROM token_usage ORDER BY created_at DESC LIMIT 10;"
```

Should show records like:
```
user_id | model_name   | input_tokens | output_tokens | total_cost   | api_call_type
--------|--------------|--------------|---------------|--------------|----------------
9       | gpt-4.1-nano | 1234         | 567           | 0.00850200   | extract-source-1
9       | gpt-4.1-nano | 2100         | 890           | 0.01380000   | extract-source-2
...
```

### Step 6: Check Dashboard
- Refresh the page
- Go to Settings / Token Monitoring
- You should see non-zero values now!

## 🎯 Expected Results After Restart

### Before Restart (What You Saw):
```
[ANALYZE-CONTENT] Processing request for user anonymous  ← Wrong!
...AI extraction happens...
NO [TOKEN-TRACKER] messages  ← Missing!
Token Dashboard shows: 0 tokens, 0 calls, $0.00  ← Wrong!
```

### After Restart (What You Should See):
```
[ANALYZE-CONTENT] Processing request for user 9 (username: Rahmat)  ← Correct!
...AI extraction happens...
[SOURCE-1] Token usage: 1234 input + 567 output tokens for user 9
[TOKEN-TRACKER] user 9 | gpt-4.1-nano | extract-source-1 | ... | Cost: $...  ← New!
[SOURCE-2] Token usage: ...
[TOKEN-TRACKER] user 9 | gpt-4.1-nano | extract-source-2 | ...  ← New!
...
Token Dashboard shows: 15000 tokens, 7 calls, $0.0234  ← Working!
```

## 🔍 Troubleshooting

### If Still Shows 0 After Restart:

1. **Verify server restarted:**
   - Check console shows: `8:xx:xx AM [express] 🚀 Application fully initialized`
   - Should be recent timestamp

2. **Verify you're logged in:**
   - Check corner of app shows your username
   - If not, login again

3. **Check server logs for errors:**
   - Look for `[TOKEN-TRACKER] Failed` messages
   - Look for database connection errors

4. **Verify database has table:**
   ```bash
   psql -U postgres -d rowbooster -c "\d token_usage"
   ```

5. **Manual test:**
   ```bash
   npx tsx server/test-token-tracking.ts
   ```

## 📊 Pricing Reference

When you do see usage, costs will be:

| Model | Usage | Cost per 1M tokens |
|-------|-------|-------------------|
| GPT-4.1 | Input | $3.00 |
| GPT-4.1 | Output | $12.00 |
| gpt-4.1-nano | Input | $0.15 |
| gpt-4.1-nano | Output | $0.60 |

Example: 10,000 input + 5,000 output tokens with gpt-4.1-nano:
- Input cost: (10,000 / 1,000,000) × $0.15 = $0.0015
- Output cost: (5,000 / 1,000,000) × $0.60 = $0.0030
- Total: $0.0045

## ✅ Checklist

Before testing:
- [ ] Server restarted with `npm run dev`
- [ ] Logged into app with username/password
- [ ] Can see username in app header

After making a search:
- [ ] Server logs show `[TOKEN-TRACKER]` messages
- [ ] Database has records: `SELECT COUNT(*) FROM token_usage;`
- [ ] Dashboard shows non-zero values

---

**The system is ready - just restart the server and try again!**