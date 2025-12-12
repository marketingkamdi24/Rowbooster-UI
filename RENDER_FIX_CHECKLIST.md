# Render Deployment Fix Checklist

## 🔴 Current Issue: SSL/TLS Required Error

This error occurs when the database connection doesn't have SSL properly configured.

---

## ✅ Step 1: Verify Database URL Format

**Go to Render Dashboard → Your PostgreSQL Service**

Your `DATABASE_URL` should look like:
```
postgresql://user:password@host.postgres.render.com:5432/database
```

**Important:** Render PostgreSQL requires SSL by default!

---

## ✅ Step 2: Check Environment Variables in Web Service

**Go to Render Dashboard → Your Web Service → Environment**

Verify these variables exist:

### Required:
```
DATABASE_URL=postgresql://rowboosteradmin:PASSWORD@dpg-xxxxx.frankfurt-postgres.render.com/rowbooster
NODE_ENV=production
OPENAI_API_KEY=sk-your_key_here
VALUESERP_API_KEY=your_key_here
```

### Optional:
```
PERPLEXITY_API_KEY=your_key_here
GOOGLE_API_KEY=your_key_here
GOOGLE_CX=your_cx_here
```

**⚠️ CRITICAL:** The `DATABASE_URL` should be the **External Database URL** from your PostgreSQL service, NOT the Internal URL!

---

## ✅ Step 3: Push Latest Code

The code fixes have been applied. Now deploy:

```bash
git add .
git commit -m "Fix SSL database connection for Render"
git push origin main
```

Render will automatically redeploy.

---

## ✅ Step 4: Monitor Deployment Logs

**Go to Render Dashboard → Your Web Service → Logs**

Look for these messages during deployment:

### ✅ Good Signs:
```
[DB] Configuring SSL for cloud database connection
[DB] Connecting to: postgresql://rowboosteradmin:****@dpg-...
[DB] New client connected to database
[STARTUP] Initializing property tables...
[INIT] property_tables table already exists
[STARTUP] Initializing admin user...
[INIT] ✅ Default admin user created
[INIT] Username: admin
[INIT] Password: admin123
✅ Server ready on 0.0.0.0:10000
```

### ❌ Bad Signs (and how to fix):
```
SSL/TLS required
```
→ **Fix:** DATABASE_URL is wrong or missing. Use External Database URL from PostgreSQL service.

```
password authentication failed
```
→ **Fix:** Wrong password in DATABASE_URL. Check PostgreSQL service credentials.

```
database "rowbooster" does not exist
```
→ **Fix:** Database wasn't created. Go to PostgreSQL service and create it.

```
[INIT] Error initializing admin user
```
→ **Fix:** Database connection might be working but tables aren't created. Check logs for SQL errors.

---

## ✅ Step 5: Test the Application

1. **Wait for deployment to complete** (usually 3-5 minutes)

2. **Open your app:** `https://rowbooster.onrender.com`

3. **Try logging in:**
   - Username: `admin`
   - Password: `admin123`

4. **Check browser console** (F12) for errors

### Common Browser Errors:

**Error:** `GET /api/auth/me 401 (Unauthorized)`
- This is NORMAL before login
- After login, if you still see this, check cookies are enabled

**Error:** `POST /api/auth/login 400 (Bad Request)`
- Look at the response body for details
- Common causes: Database not connected, admin user not created

**Error:** `Unexpected token '<', "<!DOCTYPE"...`
- Backend isn't running or routes not set up
- Check deployment logs for server startup errors

---

## 🔍 Step 6: Debugging in Render Shell

If login still fails, you can manually check the database:

**Go to Render Dashboard → PostgreSQL Service → Shell**

Run these commands:

```sql
-- Connect to database
\c rowbooster

-- Check if users table exists
\dt

-- Check if admin user exists
SELECT id, username, email, role, is_active FROM users;

-- If no users exist, you can create one manually:
INSERT INTO users (username, password, email, role, is_active, failed_login_attempts, created_at, updated_at)
VALUES (
  'admin',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYITHqZzXZe',
  'admin@rowbooster.local',
  'admin',
  true,
  0,
  NOW(),
  NOW()
);

-- Verify user was created
SELECT username, email, role FROM users;
```

---

## 📊 Step 7: Verify All Components

### Check 1: Database Tables Created
```sql
\dt
```
Should show: users, sessions, property_tables, product_properties, search_results, app_settings, token_usage

### Check 2: Admin User Exists
```sql
SELECT * FROM users WHERE role = 'admin';
```
Should show at least one admin user

### Check 3: Server Logs Show Success
Look for: `✅ Server ready on 0.0.0.0:10000`

### Check 4: App Loads in Browser
Visit: `https://rowbooster.onrender.com`
Should show login page, not error page

---

## 🆘 Still Not Working?

### Option 1: Manual Database Setup

If automatic initialization fails, manually run SQL:

1. **Go to PostgreSQL Service → Shell**
2. **Run:**
```sql
\c rowbooster

-- Create tables (if they don't exist)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  failed_login_attempts INTEGER DEFAULT 0,
  last_failed_login TIMESTAMP,
  locked_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create admin user
INSERT INTO users (username, password, email, role, is_active)
VALUES ('admin', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYITHqZzXZe', 'admin@rowbooster.local', 'admin', true)
ON CONFLICT (username) DO NOTHING;
```

### Option 2: Check Render Service Logs

**Web Service → Events tab**

Look for deployment failures or errors during startup.

### Option 3: Verify Network/Firewall

Make sure PostgreSQL allows connections from the Web Service:
- **PostgreSQL Service → Settings → Allowed IP Addresses**
- Should allow connections from Render services (default)

---

## ✅ Success Indicators

You know everything is working when:

1. ✅ Deployment logs show "Server ready"
2. ✅ Database shows admin user exists
3. ✅ Login page loads at https://rowbooster.onrender.com
4. ✅ Login with admin/admin123 succeeds
5. ✅ Dashboard displays after login

---

## 🔐 Security Reminder

**After successful first login:**
1. Go to Settings/Profile
2. Change password from `admin123`
3. Use a strong, unique password
4. Store it securely

---

**Last Updated:** 2024-11-20
**Status:** Deployment Fix In Progress