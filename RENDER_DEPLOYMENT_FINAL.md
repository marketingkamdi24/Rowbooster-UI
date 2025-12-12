# RBManager Monitoring System - Render Deployment Guide (Final)

## 🎯 Simplified Approach

After testing, the **best approach** is to deploy the monitoring system as a **completely separate Render web service**. Render DOES support deploying subdirectories - we just need to configure it correctly.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│   Main App Service                          │
│   https://rowbooster.onrender.com           │
│   Root: (empty) - deploys main app          │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│   Monitoring Service                         │
│   https://rowbooster-monitoring.onrender.com │
│   Root: monitoring-system                    │
└─────────────────────────────────────────────┘
                    ↓
          ┌──────────────────────┐
          │  PostgreSQL Database  │
          │  Shared by both       │
          └──────────────────────┘
```

---

## 🚀 Step-by-Step Deployment

### **Service 1: Main Application** (Already Deployed)

```yaml
Name: rowbooster
Repository: your-repo/rowbooster
Branch: main
Root Directory: (leave empty)
Build: npm install && npm run build
Start: npm start
```

### **Service 2: Monitoring System** (NEW)

1. **Go to Render Dashboard** → Click **"New +"** → **"Web Service"**

2. **Connect Your Repository** → Select your rowbooster repository

3. **Configure the Service:**

```yaml
Name: rowbooster-monitoring
  (or any name you prefer)

Repository: your-repo/rowbooster
  (same repository as main app)

Branch: main

Root Directory: monitoring-system
  ⚠️ CRITICAL: Type "monitoring-system" here
  This tells Render to deploy ONLY this folder

Runtime: Node

Build Command:
npm install && npm run build

Start Command:
npm start

Instance Type: Free
  (or upgrade as needed)
```

4. **Environment Variables:**

Click **"Advanced"** → **"Add Environment Variable"**

```env
DATABASE_URL=postgresql://rowboosteradmin:PASSWORD@your-db-host/rowbooster
  ⚠️ Use the SAME database URL as your main app

NODE_ENV=production

SESSION_SECRET=<generate-with-command-below>
```

**Generate SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

5. **Click "Create Web Service"**

---

## 🌐 Accessing After Deployment

### **Main App:**
```
https://rowbooster.onrender.com
```
Your regular RowBooster application

### **Monitoring Dashboard:**
```
https://rowbooster-monitoring.onrender.com
```

**Login Credentials:**
- Username: `RBManager`
- Password: `SysObserve@24`

⚠️ **Change password immediately after first login!**

---

## 🖥️ How to Use Both Screens

### **Method 1: Browser Tabs** (Recommended)
```
Tab 1: https://rowbooster.onrender.com              (Main App)
Tab 2: https://rowbooster-monitoring.onrender.com   (Monitoring)
```

### **Method 2: Split Screen**
- Left half: Main app
- Right half: Monitoring dashboard
- Perfect for real-time monitoring while using the app

### **Method 3: Dual Monitors**
- Monitor 1: Main application
- Monitor 2: Monitoring dashboard

### **Method 4: Different Devices**
- Desktop: Main app
- Tablet/Phone: Monitoring dashboard

### **Method 5: Bookmarks**
Create browser bookmarks:
- 📊 **RowBooster App**
- 🔍 **RBManager Dashboard**

---

## ✅ Verification Checklist

After deployment, verify everything works:

### **Main App Service:**
- [ ] Build completed successfully
- [ ] App accessible at main URL
- [ ] Can login to main app
- [ ] Database connected
- [ ] Features working normally

### **Monitoring Service:**
- [ ] Build completed successfully
- [ ] Accessible at monitoring URL
- [ ] Login page loads
- [ ] Can login with RBManager credentials
- [ ] Dashboard shows data
- [ ] User list visible
- [ ] Activity logs working

---

## 🔐 Post-Deployment Security

### **1. Change RBManager Password**

Connect to database:
```bash
psql "YOUR_DATABASE_URL"
```

Generate new password hash:
```javascript
const bcrypt = require('bcryptjs');
const newPassword = 'YourStrongPassword123!';
const hash = bcrypt.hashSync(newPassword, 10);
console.log(hash);
// Copy the hash output
```

Update in database:
```sql
UPDATE rb_manager 
SET password = 'paste-bcrypt-hash-here'
WHERE username = 'RBManager';
```

### **2. Custom Domain (Optional)**

You can add custom domains to both services:

**Main App:**
```
app.yourdomain.com → rowbooster.onrender.com
```

**Monitoring:**
```
monitor.yourdomain.com → rowbooster-monitoring.onrender.com
```

1. Go to service settings in Render
2. Add custom domain
3. Update DNS records as instructed

---

## 🐛 Troubleshooting

### **Issue: Build Fails for Monitoring**

**Check:**
- Root directory is set to `monitoring-system`
- Build command is `npm install && npm run build`
- All dependencies in monitoring-system/package.json

**Solution:**
Review build logs in Render dashboard for specific errors.

---

### **Issue: Can't Access Monitoring Dashboard**

**Check:**
1. Service is "Live" (green) in Render
2. Using correct URL
3. No typos in URL

**Solution:**
Check service logs for startup errors.

---

### **Issue: Login Fails**

**Verify:**
- Username: `RBManager` (case-sensitive!)
- Password: `SysObserve@24` (default)

**Reset:**
```sql
UPDATE rb_manager 
SET password = '$2a$10$rqR5FpXhQYZKN2YhGMVbLOF1QgXj8H5vZN3xN/Z6K8yL.xJ4P0nQG'
WHERE username = 'RBManager';
-- Password: SysObserve@24
```

---

### **Issue: No Data in Monitoring**

**Possible Causes:**
1. Main app not running
2. Database not shared correctly
3. Token tracking not integrated

**Solution:**
1. Verify DATABASE_URL is identical in both services
2. Use main app to generate activity
3. Check monitoring database tables exist

---

## 💰 Cost Considerations

### **Free Tier:**
- **Main App**: Free (spins down after inactivity)
- **Monitoring**: Free (spins down after inactivity)
- **Database**: Free (1GB storage)
- **Total**: $0/month

### **If You Need Always-On:**
- **Main App**: $7/month (Starter plan)
- **Monitoring**: $7/month (Starter plan)
- **Database**: Free or $7/month for more storage
- **Total**: $14-21/month

**Recommendation:** Start with free tier, upgrade main app first if needed.

---

## 🔄 Updating Services

### **Update Main App:**
```bash
git add .
git commit -m "Update main app"
git push origin main
```
Render auto-deploys main service.

### **Update Monitoring:**
```bash
cd monitoring-system
# Make changes
git add .
git commit -m "Update monitoring"
git push origin main
```
Render auto-deploys monitoring service.

Both can be updated independently!

---

## 📋 Complete Setup Summary

### **Two Render Web Services:**

**Service 1: rowbooster**
```yaml
Root: (empty)
Build: npm install && npm run build
Start: npm start
Env: DATABASE_URL, OPENAI_API_KEY, VALUESERP_API_KEY, etc.
```

**Service 2: rowbooster-monitoring**
```yaml
Root: monitoring-system
Build: npm install && npm run build
Start: npm start
Env: DATABASE_URL (same as main), NODE_ENV, SESSION_SECRET
```

### **Environment Variables Needed:**

**Main App:**
```env
DATABASE_URL
OPENAI_API_KEY
VALUESERP_API_KEY
NODE_ENV=production
SESSION_SECRET
```

**Monitoring (only needs 3):**
```env
DATABASE_URL (must match main app)
NODE_ENV=production
SESSION_SECRET
```

---

## ✨ Benefits of This Approach

✅ **Independent Scaling** - Scale each service separately  
✅ **Independent Updates** - Update without affecting the other  
✅ **Clear Separation** - Separate URLs, separate logs  
✅ **Easy Management** - Each service has its own dashboard  
✅ **Cost Effective** - Both can use free tier  
✅ **Better Security** - Monitoring isolated from main app  

---

## 🆘 Need Help?

**Documentation:**
- [`monitoring-system/README.md`](monitoring-system/README.md)
- [`monitoring-system/QUICK_START.md`](monitoring-system/QUICK_START.md)
- [`SESSION_SECRET_GUIDE.md`](SESSION_SECRET_GUIDE.md)

**Support:**
1. Check Render service logs
2. Verify environment variables
3. Test database connection
4. Review error messages

---

**Last Updated:** November 24, 2024  
**Version:** 3.0.0 (Separate Services)  
**Status:** Production Ready ✅