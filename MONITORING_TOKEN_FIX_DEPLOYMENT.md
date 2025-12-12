# Monitoring System Token/Price Fix - Deployment Guide

## Problem Summary

The monitoring system dashboard shows tokens and costs as **0** because:

1. **Code Issues (FIXED)**: 
   - `logAiApiCall()` wasn't calling `ensureInitialized()` to create tables
   - Cost calculations used incorrect hardcoded values instead of TokenTracker prices

2. **Deployment Issue (REQUIRES ACTION)**:
   - The monitoring system is deployed as a **separate Render service**
   - It needs the **same DATABASE_URL** as the main app
   - Without this, it connects to a different/empty database

## Code Fixes Applied

### 1. MonitoringLogger Table Initialization
File: `server/services/monitoringLogger.ts`
- Added `initialize()` method that creates all monitoring tables if they don't exist
- Added `ensureInitialized()` calls to all logging methods including `logAiApiCall()`

### 2. Accurate Cost Calculation  
File: `server/services/optimizedOpenaiService.ts`
- Now uses `TokenTracker.calculateCost()` for accurate pricing
- Passes `inputCost` and `outputCost` separately to monitoring
- Logs detailed cost breakdown: `input=$X, output=$Y, total=$Z`

### 3. Pricing Configuration
File: `server/services/tokenTracker.ts`
- GPT-4.1: $3.00 input / $12.00 output per million tokens
- GPT-4.1-mini: $0.40 input / $1.60 output per million tokens

## ⚠️ CRITICAL: Render Deployment Configuration

### The monitoring system and main app MUST use the SAME PostgreSQL database.

### Step 1: Get Main App's DATABASE_URL

1. Go to Render Dashboard → Your main RowBooster app
2. Click on **Environment** tab
3. Copy the `DATABASE_URL` value (looks like `postgresql://user:password@host:5432/database?sslmode=require`)

### Step 2: Set DATABASE_URL on Monitoring Service

1. Go to Render Dashboard → **rowbooster-monitoring** service
2. Click on **Environment** tab
3. Add/Update environment variable:
   ```
   DATABASE_URL = <paste the exact same DATABASE_URL from main app>
   ```

### Step 3: Verify Other Required Environment Variables

Ensure these are set on the monitoring service:
```
DATABASE_URL=<same as main app>
SESSION_SECRET=<any strong random string>
RB_MANAGER_DEFAULT_PASSWORD=<your monitoring login password>
NODE_ENV=production
```

### Step 4: Redeploy Both Services

1. Trigger a redeploy of the **main RowBooster app** (to deploy code fixes)
2. Trigger a redeploy of **rowbooster-monitoring** service

### Step 5: Test

1. Log into main RowBooster app
2. Perform a product search (to generate token usage)
3. Log into monitoring dashboard (`https://rowbooster-monitoring.onrender.com`)
4. Check Dashboard - tokens and costs should now appear

## Verification Steps

### Check Database Connection on Monitoring Service

In Render logs for monitoring service, look for:
```
[MONITORING-DB] Connecting to: postgresql://***@host:5432/database
[MONITORING-DB] New client connected to database
```

### Check Token Logging in Main App Logs

When a search is performed, look for:
```
[OPTIMIZED] Token usage: X input + Y output tokens for user Z
[OPTIMIZED] Cost breakdown: input=$0.000XXX, output=$0.000XXX, total=$0.000XXX
[MONITORING] Logged AI API call for batch extraction: ProductName (1234 tokens, $0.001234)
[TOKEN-TRACKER] api_XXX | user Y | gpt-4.1-mini | batch-extract | 500 input + 700 output = 1200 total tokens | Cost: $0.001320
```

### Check Data in Database

Connect to database and run:
```sql
-- Check if token_usage_logs has data
SELECT COUNT(*), SUM(total_tokens), SUM(CAST(total_cost AS DECIMAL)) 
FROM token_usage_logs;

-- Check recent entries
SELECT * FROM token_usage_logs ORDER BY timestamp DESC LIMIT 5;
```

## Troubleshooting

### Still showing 0?

1. **Check DATABASE_URL matches exactly** between both services
2. **Check Render logs** for any database connection errors
3. **Perform a new search** after deployment - old searches won't have data
4. **Check token_usage_logs table** exists and has data

### Database Connection Errors?

Make sure:
- DATABASE_URL is correct (no typos)
- SSL is enabled (`?sslmode=require` in URL for Render PostgreSQL)
- Database is accessible from both services

### Tables Don't Exist?

The `MonitoringLogger.initialize()` creates tables automatically on first use. 
If tables are missing, check main app logs for:
```
[MONITORING-LOGGER] Initializing monitoring tables...
[MONITORING-LOGGER] ✅ Monitoring tables initialized successfully
```

## Architecture Overview

```
┌─────────────────────┐         ┌─────────────────────┐
│   Main RowBooster   │         │ Monitoring Service  │
│   (Render Service)  │         │ (Render Service)    │
├─────────────────────┤         ├─────────────────────┤
│ optimizedOpenaiService       │   routes.ts          │
│    ↓                │         │    ↓                │
│ TokenTracker        │         │ Dashboard Stats     │
│    ↓                │         │    ↓                │
│ MonitoringLogger    │         │ SELECT SUM(...)     │
│    ↓                │         │    ↓                │
└────────┬────────────┘         └─────────┬───────────┘
         │                                │
         │ INSERT INTO token_usage_logs   │ SELECT FROM token_usage_logs
         │                                │
         ▼                                ▼
┌─────────────────────────────────────────────────────┐
│              PostgreSQL Database                     │
│   (Render PostgreSQL - SAME DATABASE_URL)           │
│                                                      │
│   ┌─────────────────────────────────────────────┐   │
│   │  token_usage_logs                           │   │
│   │  - user_id                                  │   │
│   │  - input_tokens, output_tokens              │   │
│   │  - input_cost, output_cost, total_cost     │   │
│   │  - timestamp                                │   │
│   └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Files Modified

1. `server/services/monitoringLogger.ts` - Added table initialization
2. `server/services/optimizedOpenaiService.ts` - Fixed cost calculation
3. `monitoring-system/server/db.ts` - Uses DATABASE_URL env var
4. `monitoring-system/server/routes.ts` - Dashboard stats queries