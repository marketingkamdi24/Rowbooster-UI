# Development Guide - Ensuring Changes Apply

## The Problem We Solved

When you make changes to the code, sometimes the browser doesn't show the updated version even after refreshing. This happens because:

1. **Vite's Dev Server Cache**: Vite caches compiled JavaScript bundles for faster development
2. **Browser Cache**: Your browser caches static assets (JS, CSS)
3. **Hot Module Replacement (HMR)**: Sometimes HMR doesn't trigger properly for all file changes

## Solution Implemented

### 1. Enhanced Vite Configuration

We updated [`vite.config.ts`](vite.config.ts:31-44) with:
- **File Polling**: Checks for file changes every 100ms
- **Auto Port Finding**: Automatically uses next available port if default (5173) is occupied
- **Better HMR**: Enhanced Hot Module Replacement with error overlay

### 2. Recommended Workflow

When making code changes, follow this workflow:

#### Option A: Quick Reload (For Small Changes)
```bash
# Just hard refresh your browser
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

#### Option B: Full Restart (For Major Changes)
```bash
# 1. Stop the server (Ctrl+C)
# 2. Clear Vite cache
rm -rf node_modules/.vite
# 3. Restart server
node run fresh
# 4. Hard refresh browser
```

#### Option C: Force Rebuild (If Nothing Works)
```bash
# 1. Stop the server (Ctrl+C)  
# 2. Build fresh
npm run build
# 3. Restart
node run fresh
# 4. Hard refresh browser with DevTools
F12 → Network tab → Check "Disable cache" → Refresh
```

### 3. Browser DevTools Settings

To prevent caching issues during development:

1. Open DevTools (F12)
2. Go to **Network** tab
3. Check ☑ **Disable cache**
4. Keep DevTools open while developing

### 4. Port Management

The system now handles port conflicts automatically:
- Default frontend: 5173 (Vite)
- Default backend: 5001
- If occupied, automatically tries next ports: 5174, 5175, etc.

## What Changed for Scraped Data Feature

Added expandable "Gescrapte Daten" section in automated search results:

1. **Backend** ([`server/routes.ts`](server/routes.ts:1378-1407)): Added `rawContent` to API responses
2. **Frontend** ([`client/src/components/ResultsSection.tsx`](client/src/components/ResultsSection.tsx:1007-1061)): Added collapsible component showing scraped data
3. **Schema** ([`shared/schema.ts`](shared/schema.ts:188)): Already supported `rawContent` field

The section shows:
- Number of scraped sources
- URL and title for each source
- Content preview (first 2000 characters)
- Content size in KB
- Collapsed by default, expandable on click