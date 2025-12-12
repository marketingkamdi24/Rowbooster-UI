# 🔄 Server Restart Required for Token Tracking

## Why Restart Is Needed

The token tracking code changes won't take effect until you restart the server because:
1. Node.js loads code into memory at startup
2. The updated TokenTracker service with tiktoken needs to be loaded
3. The updated routes with userId extraction need to be active

## How to Restart the Server

### Option 1: Stop and Restart in VS Code
1. In VS Code, find the terminal running the server (usually shows `npm run dev`)
2. Press `Ctrl+C` to stop the server
3. Wait for it to fully stop
4. Run `npm run dev` again

### Option 2: Kill All Node Processes and Restart
```bash
# Windows:
taskkill /F /IM node.exe
npm run dev

# Linux/Mac:
killall node
npm run dev
```

### Option 3: Use npm Script
```bash
npm run dev
```

## ⚠️ Important: ValueSERP vs AI Processing

**Token tracking only happens when using OpenAI/GPT models, not during ValueSERP searches!**

### ValueSERP Search (Step 1)
- ❌ No GPT calls
- ❌ No token usage
- ✅ Just finds URLs

### AI Analysis (Step 2)
- ✅ Uses GPT-4.1
- ✅ Tracks tokens
- ✅ Records costs

### Complete Flow:
1. Enter product name → Click "Search" (ValueSERP)
   - Finds web pages
   - **NO TOKEN USAGE YET**
   
2. Click "Analyze Content" button
   - Scrapes web pages
   - Sends to GPT-4.1
   - **TOKENS ARE TRACKED HERE** ✅

3. View results in database:
```bash
psql -U postgres -d rowbooster -c "SELECT * FROM token_usage ORDER BY created_at DESC LIMIT 5;"
```

## 🔍 Troubleshooting

### If tokens still show 0 after restart:

1. **Check server logs** for `[TOKEN-TRACKER]` messages
2. **Verify you clicked "Analyze Content"** (not just search)
3. **Check database directly**:
```bash
psql -U postgres -d rowbooster -c "SELECT COUNT(*) FROM token_usage;"
```

4. **Check server console** for errors:
```bash
# Look for:
[TOKEN-TRACKER] user X | gpt-4.1 | extract | ... tokens | Cost: $...
```

## ✅ Verification Steps

After restarting and making an AI analysis:

1. Server console should show:
```
[TOKEN-TRACKER] user 1 | gpt-4.1 | batch-extract | 1500 input + 800 output = 2300 total tokens | Cost: $0.01410000
```

2. Database should show:
```sql
SELECT user_id, input_tokens, output_tokens, total_cost 
FROM token_usage 
ORDER BY created_at DESC LIMIT 1;

-- Should return something like:
-- user_id: 1
-- input_tokens: 1500  
-- output_tokens: 800
-- total_cost: 0.01410000
```

3. Dashboard should update automatically (refresh page if needed)

## 🎯 Quick Test

After restarting the server:

1. Login to the app
2. Search for a product (e.g., "Justus Usedom 5")
3. **Important:** Click "Analyze Content" button
4. Wait for analysis to complete
5. Check console logs for `[TOKEN-TRACKER]` messages
6. Refresh Token Monitoring Dashboard

You should now see token usage!