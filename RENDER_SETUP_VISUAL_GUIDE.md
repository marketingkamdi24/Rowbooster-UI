# 🎯 Visual Guide: Deploy RBManager Monitoring on Render

## Quick Answer

**YES, Render CAN deploy subdirectories!** You just need to create TWO separate web services from the SAME repository.

---

## 📸 Step-by-Step with Screenshots Description

### **Step 1: Create Monitoring Service**

Go to **Render Dashboard** → Click **"New +"** → Select **"Web Service"**

```
┌─────────────────────────────────────┐
│  [+] New                             │
│   ├── Web Service      ← Click this │
│   ├── Static Site                   │
│   └── ...                           │
└─────────────────────────────────────┘
```

---

### **Step 2: Connect Repository**

Select your **existing rowbooster repository** (the same one your main app uses)

```
┌─────────────────────────────────────────────┐
│  Connect a repository                        │
│                                              │
│  ✓ marketingkamdi24/rowbooster  ← Same repo │
│                                              │
└─────────────────────────────────────────────┘
```

---

### **Step 3: Configure Service Settings**

**🔴 CRITICAL: The "Root Directory" field**

```
┌─────────────────────────────────────────────┐
│  Name                                        │
│  rowbooster-monitoring                       │
│  ─────────────────────────────────────────  │
│  Branch                                      │
│  main                                        │
│  ─────────────────────────────────────────  │
│  Root Directory  ⚠️ IMPORTANT!              │
│  monitoring-system     ← Type this exactly! │
│  ─────────────────────────────────────────  │
│  Runtime                                     │
│  Node                                        │
│  ─────────────────────────────────────────  │
│  Build Command                               │
│  npm install && npm run build                │
│  ─────────────────────────────────────────  │
│  Start Command                               │
│  npm start                                   │
└─────────────────────────────────────────────┘
```

**What this does:**
- Tells Render to look INSIDE the `monitoring-system/` folder
- Uses the `package.json` from that folder
- Runs npm commands in that directory
- Deploys ONLY the monitoring system

---

### **Step 4: Add Environment Variables**

Click **"Advanced"** → **"Add Environment Variable"**

**Required Variables (only 3!):**

```
┌─────────────────────────────────────────────┐
│  Key: DATABASE_URL                           │
│  Value: postgresql://user:pass@host/db      │
│  ⚠️ Must be SAME as your main app!          │
├─────────────────────────────────────────────┤
│  Key: NODE_ENV                               │
│  Value: production                           │
├─────────────────────────────────────────────┤
│  Key: SESSION_SECRET                         │
│  Value: [paste generated secret]             │
│  Generate: node -e "console.log(            │
│    require('crypto').randomBytes(32)        │
│    .toString('hex'))"                       │
└─────────────────────────────────────────────┘
```

---

### **Step 5: Create Service**

Click the **"Create Web Service"** button at the bottom

```
┌─────────────────────────────────────────────┐
│                                              │
│  [Create Web Service]  ← Click!             │
│                                              │
└─────────────────────────────────────────────┘
```

---

### **Step 6: Wait for Deployment**

Render will:
1. Clone your repository
2. Navigate to `monitoring-system/` folder
3. Run `npm install`
4. Run `npm run build`
5. Start with `npm start`

**Watch the logs:**
```
==> Cloning from https://github.com/...
==> Using Node.js version 18.x
==> Running build command: 'npm install && npm run build'
    ...
==> Build complete
==> Starting service with 'npm start'
    ✅ Server ready on 0.0.0.0:10000
    🔍 ROWBOOSTER MONITORING SYSTEM
    Login: RBManager / SysObserve@24
```

---

## 🌐 Result: Two Services, Same Repo

After setup, you'll have:

```
Repository: marketingkamdi24/rowbooster
    │
    ├── Service 1: "rowbooster"
    │   ├── Root: (empty)
    │   ├── URL: https://rowbooster.onrender.com
    │   └── Purpose: Main application
    │
    └── Service 2: "rowbooster-monitoring"
        ├── Root: monitoring-system
        ├── URL: https://rowbooster-monitoring.onrender.com
        └── Purpose: Monitoring dashboard
```

---

## 🎯 How to Access Both

### **Main App:**
```
🌐 URL: https://rowbooster.onrender.com
👤 Login: Your regular user account
📊 Features: All your normal app features
```

### **Monitoring:**
```
🌐 URL: https://rowbooster-monitoring.onrender.com  
👤 Login: RBManager / SysObserve@24
📊 Features: User monitoring, activity logs, errors, costs
```

---

## 💻 Opening Both Screens

### **Browser Tabs (Easiest):**
```
┌─────────────────────────────────────────────┐
│ Tab 1: https://rowbooster.onrender.com      │
│        ↑ Main App                            │
├─────────────────────────────────────────────┤
│ Tab 2: https://rowbooster-monitoring...     │
│        ↑ Monitoring                          │
└─────────────────────────────────────────────┘
```

Just **Ctrl+Click** (or Cmd+Click on Mac) the monitoring URL to open in new tab!

### **Side-by-Side Windows:**
```
┌──────────────────┬──────────────────┐
│   Main App       │   Monitoring     │
│   Port: 10000    │   Port: 10000    │
│   Different URL  │   Different URL  │
└──────────────────┴──────────────────┘
```

**Pro Tip:** Use Windows Key + ← and → to snap windows!

---

## ✅ Verification

After deployment, check both services:

### **Main App Service:**
```
Render Dashboard → rowbooster
├── Status: Live ✅
├── URL: https://rowbooster.onrender.com
└── Logs: "Server ready on 0.0.0.0:10000"
```

### **Monitoring Service:**
```
Render Dashboard → rowbooster-monitoring
├── Status: Live ✅
├── URL: https://rowbooster-monitoring.onrender.com
└── Logs: "ROWBOOSTER MONITORING SYSTEM"
```

---

## 🔑 Key Points

✅ **Same Repository** - Both services from one GitHub repo  
✅ **Different Roots** - Main: empty, Monitoring: monitoring-system  
✅ **Different URLs** - Each service gets its own URL  
✅ **Shared Database** - Both use same DATABASE_URL  
✅ **Independent** - Update one without affecting the other  
✅ **Free Tier** - Both can run on free plan  

---

## 🆘 Troubleshooting

### **"Build failed" Error**

**Check:**
- Root Directory says `monitoring-system` (not `/monitoring-system`)
- Build command is `npm install && npm run build`
- No typos in root directory name

---

### **"Service won't start"**

**Check Logs:**
```
Render Dashboard → Your Service → Logs tab
Look for error messages
```

**Common Issues:**
- Missing DATABASE_URL
- Wrong SESSION_SECRET format
- Node version mismatch

---

### **"Can't login to monitoring"**

**Credentials:**
- Username: `RBManager` (capital R, capital B, capital M)
- Password: `SysObserve@24` (capital S, capital O)
- Case-sensitive!

---

## 📚 Summary

**To deploy monitoring system on Render:**

1. ✅ Create NEW web service
2. ✅ Use SAME repository as main app
3. ✅ Set Root Directory to `monitoring-system`
4. ✅ Add 3 environment variables
5. ✅ Deploy and access at separate URL

**Access:**
- Main: `https://rowbooster.onrender.com`
- Monitoring: `https://rowbooster-monitoring.onrender.com`

**Open both in separate browser tabs - done!** 🎉

---

**Need more help?** See [`RENDER_DEPLOYMENT_FINAL.md`](RENDER_DEPLOYMENT_FINAL.md) for complete guide.