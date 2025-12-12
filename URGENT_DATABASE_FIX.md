# 🔴 URGENT: Database Connection Fix

## Error: "Connection terminated unexpectedly"

This means your Web Service **cannot connect** to your PostgreSQL database.

---

## ✅ STEP 1: Get the Correct DATABASE_URL

### Go to Render Dashboard:

1. Click on your **PostgreSQL service** (rowbooster-postgresql)
2. Look for **"Connections"** section
3. Find **"External Database URL"**
4. Click **"Copy"** - it should look like:

```
postgresql://rowboosteradmin:LONG_PASSWORD_HERE@dpg-XXXXX-XXXXX.frankfurt-postgres.render.com:5432/rowbooster
```

**⚠️ DO NOT use "Internal Database URL" - that only works within private network!**

---

## ✅ STEP 2: Update Your Web Service Environment

### Go to Render Dashboard:

1. Click on your **Web Service** (rowbooster)
2. Go to **"Environment"** tab
3. Find `DATABASE_URL`
4. Click **"Edit"**
5. **Paste the External Database URL** you copied in Step 1
6. Click **"Save Changes"**

**This will trigger automatic redeploy!**

---

## ✅ STEP 3: Wait and Watch Logs

The service will redeploy. Go to **"Logs"** tab and watch for:

### ✅ Success Messages:
```
[DB] Configuring SSL for cloud database connection
[DB] Connecting to: postgresql://rowboosteradmin:****@dpg-...
[DB] New client connected to database
[INIT] ✅ Default admin user created
✅ Server ready on 0.0.0.0:10000
```

### ❌ Still Seeing Errors?

**"Connection terminated unexpectedly"**
- DATABASE_URL is still wrong
- PostgreSQL service is down
- Network connectivity issue

**"password authentication failed"**
- Password in DATABASE_URL is incorrect
- Copy External URL again from PostgreSQL service

**"database 'rowbooster' does not exist"**
- The database wasn't created
- Solution below ⬇️

---

## 🔧 STEP 4: Create Database Manually (If Needed)

If your PostgreSQL service doesn't have the `rowbooster` database:

1. **Go to PostgreSQL Service → Shell**
2. **Run:**
```sql
CREATE DATABASE rowbooster;
\c rowbooster
\dt
```

You should see an empty database ready for tables.

---

## 🔧 STEP 5: Create Admin User Manually

If auto-creation fails, do it manually:

1. **Go to PostgreSQL Service → Shell**
2. **Connect to database:**
```sql
\c rowbooster
```

3. **Create users table:**
```sql
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
```

4. **Create sessions table:**
```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

5. **Create admin user:**
```sql
INSERT INTO users (username, password, email, role, is_active, failed_login_attempts)
VALUES (
  'admin',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYITHqZzXZe',
  'admin@rowbooster.local',
  'admin',
  true,
  0
);
```

6. **Verify:**
```sql
SELECT id, username, email, role, is_active FROM users;
```

Should show the admin user!

---

## 🎯 STEP 6: Test Login

After DATABASE_URL is correct and database is set up:

1. **Wait for redeploy to complete** (3-5 min)
2. **Go to:** https://rowbooster.onrender.com
3. **Login:**
   - Username: `admin`
   - Password: `admin123`

---

## 🔍 Quick Diagnostics

### Check 1: PostgreSQL Service Running?
- Go to PostgreSQL service dashboard
- Status should be "Available" (green)
- If "Suspended", click "Resume"

### Check 2: Web Service Environment Variables?
- DATABASE_URL exists and starts with `postgresql://`
- NODE_ENV is set to `production`
- OPENAI_API_KEY exists
- VALUESERP_API_KEY exists

### Check 3: Services in Same Region?
- Both PostgreSQL and Web Service should be in "Frankfurt"
- Different regions can cause connectivity issues

### Check 4: Firewall Settings?
- PostgreSQL → Settings → Allowed IP Addresses
- Should allow connections from Render services (default)

---

## 💡 Common Mistakes

❌ **Using Internal Database URL instead of External**
- Internal: `postgres://...` (wrong for Web Service)
- External: `postgresql://...@dpg-...render.com:5432/...` (correct)

❌ **Typo in database name**
- DATABASE_URL should end with `/rowbooster`
- Not `/postgres` or `/db` or anything else

❌ **Wrong password**
- Must match exactly what PostgreSQL service shows
- Copy-paste to avoid typos

❌ **Database doesn't exist**
- Create it manually (see Step 4 above)

---

## 📞 Need More Help?

**Check Render service logs for exact error message, then:**

1. PostgreSQL service logs might show connection attempts
2. Web service logs will show the specific error
3. Use the Shell in PostgreSQL service to manually test SQL

**Share the exact error message from logs for specific help!**