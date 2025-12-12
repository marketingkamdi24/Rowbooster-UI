# 🚨 Fix Monitoring System Build Error

## Problem Identified

```
sh: 1: vite: not found
==> Build failed 😞
```

The monitoring system can't find `vite` during build. This happens because of the build command configuration.

---

## ✅ SOLUTION: Update Build Command

### **Go to Render Dashboard**

**rowbooster-monitoring** service → **"Settings"** tab → Scroll to **"Build Command"**

### **Current (Wrong):**
```bash
npm install && npm run build
```

### **Change To (Correct):**
```bash
npm ci && npm run build
```

**OR if that doesn't work, use:**
```bash
npm install --include=dev && npm run build
```

**OR the most reliable:**
```bash
rm -rf node_modules && npm install && npm run build
```

---

## 🎯 Why This Fixes It

**The issue:** 
- `vite` is in `devDependencies`
- Sometimes `npm install` on Render doesn't install dev dependencies properly
- Using `npm ci` or forcing dev dependencies fixes this

**What each does:**
- `npm ci` = Clean install (more reliable on Render)
- `--include=dev` = Forces dev dependencies installation
- `rm -rf node_modules && npm install` = Fresh install every time

---

## 📋 Complete Fix Steps

### **Step 1: Update Build Command**

**Render Dashboard** → **rowbooster-monitoring** → **"Settings"** tab

Find **"Build Command"** and change to:
```bash
npm ci && npm run build
```

Click **"Save Changes"**

---

### **Step 2: Redeploy**

**Render Dashboard** → **rowbooster-monitoring**

Click **"Manual Deploy"** → **"Deploy latest commit"**

---

### **Step 3: Watch Logs**

**Logs tab** should now show:

```
✅ Running build command: 'npm ci && npm run build'
✅ vite v5.4.14 building for production...
✅ transforming...
✅ rendering chunks...
✅ built in 2.90s
✅ Build succeeded
```

---

## 🔧 Alternative Solution (If npm ci doesn't work)

If `npm ci` fails, try this build command instead:

```bash
npm install --legacy-peer-deps && npm run build
```

This handles dependency conflicts better.

---

## ✅ Complete Current Configuration

After fix, your monitoring service should have:

**Settings:**
```yaml
Root Directory: monitoring-system
Build Command: npm ci && npm run build
Start Command: npm start
```

**Environment Variables:**
```env
DATABASE_URL = [your database URL]
SESSION_SECRET = [your secret]
NODE_ENV = production
```

---

## 🎯 Expected Result

After successful build and deploy:

**Build logs will show:**
```
==> Running build command 'npm ci && npm run build'
added 421 packages in 15s
vite v5.4.14 building for production...
✓ 1660 modules transformed.
✓ built in 2.90s
Build succeeded
```

**Server logs will show:**
```
═══════════════════════════════════════════════
   🔍 ROWBOOSTER MONITORING SYSTEM
═══════════════════════════════════════════════
✅ Server ready on 0.0.0.0:10000
📊 Environment: production
🔗 Database: Connected
👤 Login: RBManager / SysObserve@24
```

---

## 🐛 If Still Not Working

Try these build commands in order until one works:

**Option 1:**
```bash
npm ci && npm run build
```

**Option 2:**
```bash
npm install --include=dev && npm run build
```

**Option 3:**
```bash
rm -rf node_modules package-lock.json && npm install && npm run build
```

**Option 4:**
```bash
npm install --legacy-peer-deps && npm run build
```

---

## 📊 Summary

**Current Issue:** `vite: not found` during build  
**Cause:** Dev dependencies not installed properly  
**Fix:** Change build command to `npm ci && npm run build`  
**Result:** Build will succeed, monitoring system will deploy  

Update the build command and redeploy - should work! 🚀