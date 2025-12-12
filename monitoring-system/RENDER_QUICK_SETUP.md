# 🚀 RBManager Monitoring - Render Quick Setup

## One-Time Setup (5 minutes)

### 1️⃣ Create New Render Service

```yaml
Name:           rowbooster-monitoring
Repository:     your-github-repo/rowbooster
Branch:         main
Root Directory: monitoring-system  ⚠️ IMPORTANT
Runtime:        Node
```

### 2️⃣ Build & Start Commands

```bash
Build Command:  npm install && npm run build
Start Command:  npm start
```

### 3️⃣ Environment Variables

```env
DATABASE_URL=postgresql://[same-as-main-app]
NODE_ENV=production
SESSION_SECRET=[generate-random-32-chars]
```

Generate SESSION_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4️⃣ Deploy & Access

Click "Create Web Service" → Wait 3-5 minutes

Access at: `https://rowbooster-monitoring.onrender.com`

---

## 🔐 First Login

**Default Credentials:**
```
Username: RBManager
Password: SysObserve@24
```

⚠️ **CHANGE PASSWORD IMMEDIATELY AFTER FIRST LOGIN**

---

## 📱 Two Ways to Access

### Option 1: Separate Browser Window/Tab
```
Main App:      https://rowbooster.onrender.com
Monitoring:    https://rowbooster-monitoring.onrender.com
```

Open both in separate tabs - they run independently.

### Option 2: Bookmark Both URLs
Save both URLs in your browser:
- 📊 Main RowBooster App
- 🔍 RBManager Monitoring

---

## 🎯 What You Get

✅ **Dashboard** - System overview, user stats, costs  
✅ **User Management** - View all users and their activity  
✅ **Activity Logs** - Real-time user actions  
✅ **Error Tracking** - Monitor and resolve errors  
✅ **Token Usage** - Track AI API consumption  
✅ **Cost Monitoring** - Per-user spending  

---

## 🔄 Automatic Updates

```bash
# Any changes to monitoring-system/ folder:
git add monitoring-system/
git commit -m "Update monitoring"
git push

# Render auto-deploys in ~3 minutes
```

---

## 🆘 Quick Troubleshooting

**Can't access?**
→ Check Render dashboard - service must be "Live"

**Login fails?**
→ Verify credentials: `RBManager` / `SysObserve@24`

**No data?**
→ Run main app first to generate activity

**Need help?**
→ See [`RENDER_DEPLOYMENT_GUIDE.md`](RENDER_DEPLOYMENT_GUIDE.md)

---

## 🎨 Cyberpunk Theme Features

- 🌟 Neon yellow/cyan aesthetics
- 📺 CRT scanline effects  
- 🎯 Real-time auto-refresh
- 💫 Animated progress bars
- 🔴 Pulsing status indicators
- ⚡ Digital clock display

---

**Ready in 5 minutes! 🚀**