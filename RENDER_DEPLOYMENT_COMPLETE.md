# Render Deployment - Complete Guide

## ✅ Changes Made

### 1. Auto-Initialize Admin User
Created [`server/init-admin-user.ts`](server/init-admin-user.ts) that automatically creates an admin user on first deployment if none exists.

### 2. Updated Server Startup
Modified [`server/index.ts`](server/index.ts) to call admin initialization on startup.

---

## 🚀 Deployment Steps

### **Step 1: Deploy PostgreSQL**
✅ Already completed

**Database Details:**
- Name: `rowbooster-postgresql`
- Database: `rowbooster`
- User: `rowboosteradmin`
- Version: PostgreSQL 18

**Connection String Format:**
```
postgresql://rowboosteradmin:PASSWORD@dpg-xxxxx.frankfurt-postgres.render.com/rowbooster
```

---

### **Step 2: Deploy Backend (Single Service)**

**Service Type:** Web Service

**Configuration:**
```
Name: rowbooster
Repository: marketingkamdi24/rowbooster
Branch: main
Region: Frankfurt (EU Central)
Root Directory: (leave empty)

Build Command:
npm install; npm run build

Start Command:
npm start
```

**Environment Variables:**
```env
# REQUIRED
DATABASE_URL=postgresql://rowboosteradmin:YOUR_PASSWORD@dpg-xxxxx.frankfurt-postgres.render.com/rowbooster
OPENAI_API_KEY=sk-your_openai_api_key
VALUESERP_API_KEY=your_valueserp_api_key
NODE_ENV=production

# OPTIONAL
PERPLEXITY_API_KEY=pplx-your_key
GOOGLE_API_KEY=your_google_key
GOOGLE_CX=your_google_cx
```

---

### **Step 3: Push Changes to GitHub**

```bash
git add .
git commit -m "Add auto-admin user initialization for deployment"
git push origin main
```

Render will automatically deploy when it detects the push.

---

### **Step 4: Verify Deployment**

1. **Wait for build to complete** (3-5 minutes)
2. **Check deployment logs** for:
   ```
   [INIT] Checking property_tables table...
   [INIT] Checking for admin user...
   [INIT] ✅ Default admin user created
   [INIT] Username: admin
   [INIT] Password: admin123
   ```
3. **Visit your app:** `https://rowbooster.onrender.com`
4. **Login with default credentials:**
   - Username: `admin`
   - Password: `admin123`

---

## 🔐 Post-Deployment Security

### ⚠️ CRITICAL: Change Default Password

**Immediately after first login:**

1. Go to Settings or User Profile
2. Change password from `admin123` to a strong password
3. Use a password manager to store it securely

### Security Checklist

- [ ] Changed default admin password
- [ ] Verified all environment variables are set
- [ ] Confirmed DATABASE_URL uses SSL (`render.com` PostgreSQL includes SSL by default)
- [ ] API keys are stored in Render environment variables (not in code)
- [ ] `.env` file is in `.gitignore` (already configured)

---

## 📊 Database Tables (Auto-Created)

On first deployment, the app automatically creates:

1. ✅ `users` - User accounts & authentication
2. ✅ `sessions` - Session management
3. ✅ `property_tables` - Product type definitions
4. ✅ `product_properties` - Property definitions
5. ✅ `search_results` - Search history
6. ✅ `app_settings` - Application settings
7. ✅ `token_usage` - AI usage tracking

**AND** creates the default admin user:
- Username: `admin`
- Password: `admin123`
- Email: `admin@rowbooster.local`
- Role: `admin`

---

## 🔍 Troubleshooting

### "Cannot Login"

**Check:**
1. Database connection in logs
2. Admin user was created (check logs for `[INIT]` messages)
3. Environment variable `DATABASE_URL` is correct

**Solution:**
View logs in Render Dashboard → Your Service → Logs

---

### "Tables Not Created"

**Check deployment logs for errors**

If tables weren't created automatically, you can create them manually:

1. Go to Render Dashboard → PostgreSQL Service
2. Click "Connect" → Use web shell or external connection
3. Run:
```sql
-- Check if tables exist
\dt

-- If not, check logs for migration errors
```

---

### "Database Connection Error"

**Verify:**
- `DATABASE_URL` environment variable is set
- PostgreSQL service is running
- Connection string includes proper format

**Format should be:**
```
postgresql://username:password@host:port/database
```

---

## 🎯 Architecture

```
┌─────────────────────────────────────────┐
│   https://rowbooster.onrender.com       │
│   Single Render Web Service             │
├─────────────────────────────────────────┤
│                                         │
│  📦 Backend (Express + Node.js)         │
│     ├── API Routes (/api/*)             │
│     ├── Authentication                  │
│     ├── Database Connection             │
│     └── AI Services Integration         │
│                                         │
│  🎨 Frontend (React)                    │
│     ├── Served from dist/public/        │
│     ├── All UI routes (/)               │
│     └── Communicates with /api/*        │
│                                         │
└─────────────────────────────────────────┘
              ↕
    ┌──────────────────────┐
    │  PostgreSQL Database │
    │  (Render PostgreSQL) │
    └──────────────────────┘
```

---

## 📚 Required API Services

### 1. OpenAI (REQUIRED)
- **Get Key:** https://platform.openai.com/api-keys
- **Purpose:** AI content analysis & data extraction
- **Cost:** ~$0.01-0.03 per search

### 2. ValueSERP (REQUIRED)
- **Get Key:** https://www.valueserp.com/
- **Purpose:** Google search API
- **Cost:** ~$0.001 per search

### 3. Perplexity AI (OPTIONAL)
- **Get Key:** https://www.perplexity.ai/
- **Purpose:** Enhanced AI search

---

## ✅ Success Indicators

Your deployment is successful when:

✅ Build completes without errors  
✅ App starts and shows "serving on 0.0.0.0:XXXX"  
✅ Logs show "[INIT] Default admin user created"  
✅ You can access https://rowbooster.onrender.com  
✅ Login page loads correctly  
✅ Login with admin/admin123 works  
✅ Dashboard displays after login  

---

## 🆘 Need Help?

1. Check Render deployment logs
2. Verify all environment variables
3. Ensure PostgreSQL service is running
4. Review this guide's troubleshooting section

---

**Deployment Date:** November 20, 2024  
**Version:** 1.0.0  
**Status:** Production Ready ✅