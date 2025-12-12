# RBManager Monitoring System - Render Deployment Guide

## 📋 Overview

The RBManager monitoring system is deployed as a **separate Render web service** from your main RowBooster application. This ensures:
- Independent scaling and resource management
- Isolated monitoring without affecting main app performance
- Separate access control and security
- Different URLs for main app and monitoring dashboard

---

## 🏗️ Architecture on Render

```
┌─────────────────────────────────────────────┐
│   Main App                                   │
│   https://rowbooster.onrender.com            │
│   Port: 10000 (Render default)              │
└─────────────────────────────────────────────┘
               ↓
         Logs activities to
               ↓
┌─────────────────────────────────────────────┐
│   PostgreSQL Database                        │
│   Shared monitoring tables                   │
└─────────────────────────────────────────────┘
               ↑
         Reads from
               ↑
┌─────────────────────────────────────────────┐
│   RBManager Monitoring System                │
│   https://rowbooster-monitor.onrender.com    │
│   Port: 10000 (Render default)              │
│   Username: RBManager                        │
│   Password: SysObserve@24                    │
└─────────────────────────────────────────────┘
```

---

## 🚀 Deployment Steps

### **Step 1: Prepare Repository**

Your monitoring system is already in the `monitoring-system/` directory. Ensure it's committed to GitHub:

```bash
git add monitoring-system/
git commit -m "Add monitoring system for separate deployment"
git push origin main
```

### **Step 2: Create New Web Service on Render**

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Click "New +"** → **"Web Service"**
3. **Connect Repository**: Select your `rowbooster` repository
4. **Configure Service:**

   ```yaml
   Name: rowbooster-monitoring
   # or any name you prefer: rowbooster-monitor, rbmanager, etc.
   
   Region: Frankfurt (EU Central)
   # Match your database region
   
   Branch: main
   
   Root Directory: monitoring-system
   # CRITICAL: This tells Render to deploy only this subdirectory
   
   Runtime: Node
   
   Build Command:
   npm install && npm run build
   
   Start Command:
   npm start
   
   Instance Type: Free
   # Or upgrade to Starter/Professional as needed
   ```

### **Step 3: Configure Environment Variables**

Add these environment variables in Render:

**REQUIRED:**
```env
DATABASE_URL=postgresql://rowboosteradmin:YOUR_PASSWORD@dpg-xxxxx.frankfurt-postgres.render.com/rowbooster
# ⚠️ Use the SAME database as your main app - monitoring shares the database

NODE_ENV=production

SESSION_SECRET=generate-a-random-secret-key-here
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**OPTIONAL:**
```env
MONITORING_PORT=10000
# Not usually needed - Render assigns port automatically via PORT env var
```

### **Step 4: Deploy**

1. Click **"Create Web Service"**
2. Render will:
   - Clone your repository
   - Navigate to `monitoring-system/` directory
   - Run `npm install && npm run build`
   - Start server with `npm start`
   - Automatically initialize monitoring database tables
   - Create RBManager user with default credentials

3. **Monitor deployment logs** for:
   ```
   [MONITORING-INIT] ✅ Created table: rb_manager
   [MONITORING-INIT] ✅ Created table: user_activity_logs
   [MONITORING-INIT] ✅ Created table: token_usage_logs
   [MONITORING-INIT] ✅ Created table: api_call_logs
   [MONITORING-INIT] ✅ Created table: error_logs
   [MONITORING-INIT] ✅ RBManager user created successfully
   ═══════════════════════════════════════════════
      🔍 ROWBOOSTER MONITORING SYSTEM
   ═══════════════════════════════════════════════
   ✅ Server ready on 0.0.0.0:10000
   📊 Environment: production
   🔗 Database: Connected
   👤 Login: RBManager / SysObserve@24
   ```

---

## 🌐 Accessing Your Monitoring Dashboard

### **Public URL**
Render provides a URL like:
```
https://rowbooster-monitoring.onrender.com
```

### **Custom Domain (Optional)**
You can add a custom domain:
```
https://monitor.yourdomain.com
```

1. Go to service settings
2. Add custom domain
3. Configure DNS as instructed

---

## 🔐 Security Configuration

### **1. Change Default Password (CRITICAL)**

**After first deployment, immediately:**

```sql
-- Connect to your database
psql "postgresql://rowboosteradmin:PASSWORD@dpg-xxxxx.frankfurt-postgres.render.com/rowbooster"

-- Change RBManager password
UPDATE rb_manager 
SET password = '$2a$10$YOUR_NEW_BCRYPT_HASH'
WHERE username = 'RBManager';
```

**Generate new password hash:**
```javascript
// Run locally with Node.js
const bcrypt = require('bcryptjs');
const newPassword = 'YourStrongP@ssw0rd!';
const hash = bcrypt.hashSync(newPassword, 10);
console.log(hash);
```

### **2. Restrict Access (Optional)**

Add IP restrictions in Render dashboard if needed:
- Dashboard → Your Service → Settings → IP Allow List

### **3. Environment Variables Security**

- Never commit `.env` files
- Store all secrets in Render environment variables
- Use strong SESSION_SECRET (32+ random characters)

---

## 📊 Features Available

Once deployed, you'll have access to:

### **Dashboard** (`/`)
- Total users & active count
- Total API calls
- Total costs
- Error statistics  
- Recent activity feed
- System resource monitoring

### **User Management** (`/users`)
- List all users
- Per-user statistics
- API calls, tokens, costs
- Click through to detailed view

### **User Details** (`/users/:id`)
- Individual user profile
- Activity logs
- Token usage breakdown
- API call history
- Error logs for user

### **Activity Logs** (`/activity`)
- Real-time activity tracking
- Filter by type (login, api_call, etc.)
- Search by user/action
- Export to CSV

### **Error Logs** (`/errors`)
- System-wide error tracking
- Filter by severity
- Mark errors as resolved
- Stack traces and details

---

## 🔗 Integration with Main App

Your main app logs data to the monitoring system automatically:

### **Already Integrated ✅**
- Token usage tracking (via `tokenTracker.ts`)
- API costs per user
- Model usage statistics

### **To Be Integrated:**

Add to your main app's [`server/index.ts`](server/index.ts):

```typescript
import { MonitoringLogger } from './services/monitoringLogger';

// Log user login
app.post('/api/auth/login', async (req, res) => {
  // ... your login logic
  
  await MonitoringLogger.logActivity({
    userId: user.id,
    username: user.username,
    activityType: 'login',
    action: 'User logged in successfully',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    success: true,
  });
});

// Log API calls
app.use('/api', async (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', async () => {
    await MonitoringLogger.logApiCall({
      userId: req.user?.id,
      username: req.user?.username,
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      duration: Date.now() - startTime,
      ipAddress: req.ip,
    });
  });
  
  next();
});

// Log errors
app.use((err, req, res, next) => {
  await MonitoringLogger.logError({
    userId: req.user?.id,
    username: req.user?.username,
    errorType: 'runtime',
    errorMessage: err.message,
    errorStack: err.stack,
    endpoint: req.path,
    method: req.method,
    severity: 'error',
  });
  
  // ... your error handling
});
```

---

## 🔄 Updating the Monitoring System

### **Automatic Deployments**
Render automatically redeploys when you push to GitHub:

```bash
cd monitoring-system
# Make your changes
git add .
git commit -m "Update monitoring system"
git push origin main
```

### **Manual Deploy**
In Render Dashboard:
1. Go to your monitoring service
2. Click **"Manual Deploy"** → **"Deploy latest commit"**

---

## 🐛 Troubleshooting

### **Issue: Cannot Access Dashboard**

**Check:**
1. Service is running (green in Render dashboard)
2. Deployment succeeded (no build errors)
3. URL is correct
4. Database connection is working

**Solution:**
View logs: Render Dashboard → Service → Logs

---

### **Issue: Login Failed**

**Check:**
1. RBManager user was created (check logs)
2. Using correct credentials: `RBManager` / `SysObserve@24`
3. Database connection is stable

**Solution:**
```sql
-- Verify user exists
SELECT username, created_at FROM rb_manager WHERE username = 'RBManager';

-- Reset password if needed
UPDATE rb_manager 
SET password = '$2a$10$rqR5FpXhQYZKN2YhGMVbLOF1QgXj8H5vZN3xN/Z6K8yL.xJ4P0nQG'
WHERE username = 'RBManager';
-- Password: SysObserve@24
```

---

### **Issue: No Data Showing**

**Possible causes:**
1. Main app not integrated with MonitoringLogger
2. Database tables not created
3. Main app not running

**Solution:**
1. Check monitoring tables exist:
   ```sql
   \dt *_logs
   \dt user_statistics
   ```
2. Verify main app is logging data
3. Check token tracking is working in main app

---

### **Issue: Database Connection Error**

**Check:**
1. `DATABASE_URL` environment variable is set correctly
2. Database service is running
3. Connection string format is correct

**Correct format:**
```
postgresql://username:password@host:port/database
```

**Test connection:**
```bash
psql "YOUR_DATABASE_URL"
```

---

## 📈 Performance & Scaling

### **Resource Usage**
- **Free Tier**: Suitable for monitoring up to ~1000 users
- **Starter** ($7/mo): Recommended for production (1-5K users)
- **Professional**: For larger deployments (5K+ users)

### **Optimization Tips**
1. Enable auto-refresh intervals (5-30 seconds)
2. Use pagination for large datasets
3. Archive old logs periodically
4. Monitor Render metrics for performance

---

## 💾 Data Management

### **Backup Monitoring Data**

```bash
# Backup all monitoring tables
pg_dump -U rowboosteradmin \
  -d rowbooster \
  -t user_activity_logs \
  -t token_usage_logs \
  -t api_call_logs \
  -t error_logs \
  -t user_statistics \
  > monitoring_backup.sql
```

### **Data Retention**

Consider implementing cleanup for old data:

```sql
-- Delete activity logs older than 90 days
DELETE FROM user_activity_logs 
WHERE timestamp < NOW() - INTERVAL '90 days';

-- Delete token logs older than 1 year
DELETE FROM token_usage_logs 
WHERE timestamp < NOW() - INTERVAL '1 year';

-- Keep errors indefinitely or implement custom retention
```

---

## ✅ Deployment Checklist

- [ ] Monitoring system code committed to GitHub
- [ ] New Render web service created
- [ ] Root directory set to `monitoring-system`
- [ ] Build command: `npm install && npm run build`
- [ ] Start command: `npm start`
- [ ] `DATABASE_URL` environment variable configured (same as main app)
- [ ] `NODE_ENV=production` set
- [ ] `SESSION_SECRET` generated and set
- [ ] Service deployed successfully
- [ ] Can access monitoring dashboard
- [ ] Can login with RBManager credentials
- [ ] Default password changed
- [ ] Main app integration planned/completed

---

## 🎯 Quick Reference

**Monitoring System URL Pattern:**
```
https://[your-service-name].onrender.com
```

**Default Credentials:**
```
Username: RBManager
Password: SysObserve@24
⚠️ Change in production!
```

**Database Tables:**
```
- rb_manager              # Authentication
- user_activity_logs      # All activities
- token_usage_logs        # Token consumption
- api_call_logs          # API requests
- error_logs             # Errors
- user_sessions          # Sessions
- user_statistics        # Aggregated stats
- system_metrics         # Performance data
```

**Important Ports:**
```
Main App:       Port 10000 (Render assigns this)
Monitoring:     Port 10000 (Render assigns this - separate service)
Local Dev:      Main: 5000, Monitoring: 5001
```

---

## 🆘 Support

**Documentation:**
- [`monitoring-system/README.md`](README.md) - Full feature documentation
- [`monitoring-system/QUICK_START.md`](QUICK_START.md) - Local development guide
- [`monitoring-system/IMPLEMENTATION_SUMMARY.md`](IMPLEMENTATION_SUMMARY.md) - Feature overview

**Common Issues:**
1. Check Render deployment logs
2. Verify environment variables
3. Test database connection
4. Review this troubleshooting section

---

**Last Updated:** November 24, 2024  
**Version:** 1.0.0  
**Status:** Production Ready ✅