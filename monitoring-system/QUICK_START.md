# Quick Start Guide - RowBooster Monitoring System

## Step 1: Navigate and Install

**Windows PowerShell:**
```powershell
cd monitoring-system
npm install
```

**Or simply double-click:** `start-monitoring.bat` in the monitoring-system folder

## Step 2: Verify Environment

Ensure your main application's `.env` file has:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/rowbooster
```

The monitoring system shares the same database.

## Step 3: Start the Monitoring System

**Option 1 - Using Batch File (Easiest):**
Double-click `start-monitoring.bat` in the monitoring-system folder

**Option 2 - Using PowerShell:**
```powershell
cd monitoring-system
npm run dev
```

**Option 3 - Using Command Prompt:**
```cmd
cd monitoring-system
npm run dev
```

You should see:

```
═══════════════════════════════════════════════════════════
   🔍 ROWBOOSTER MONITORING SYSTEM
═══════════════════════════════════════════════════════════
✅ Server ready on 127.0.0.1:5001
📊 Environment: development
🔗 Database: Connected
👤 Login: RBManager / SysObserve@24
═══════════════════════════════════════════════════════════
```

## Step 4: Access the Dashboard

Open your browser and navigate to:
```
http://localhost:5001
```

## Step 5: Login

Use the default credentials:
- **Username**: `RBManager`
- **Password**: `SysObserve@24`

## Step 6: Explore the Dashboard

You should now see:
- **Dashboard**: System overview with statistics
- **Users**: List of all users with their activity
- **Activity Logs**: Real-time user activities
- **Error Logs**: System errors and issues

## Running Both Systems

**Windows - Two PowerShell Terminals:**

### Terminal 1 - Main Application
```powershell
# In rowbooster-nov-22 directory
npm run dev
```
Runs on: `http://localhost:5000`

### Terminal 2 - Monitoring System
```powershell
cd monitoring-system
npm run dev
```
Runs on: `http://localhost:5001`

**Or use the batch file:**
- Terminal 1: Run main app with `npm run dev`
- Terminal 2: Double-click `monitoring-system/start-monitoring.bat`

## What Gets Monitored?

✅ **Automatic Monitoring** (Already Integrated):
- Token usage from all AI API calls
- Token costs per user
- Model usage statistics

🔧 **Manual Integration Needed**:
- User login/logout activities
- API endpoint calls
- Search operations
- Error tracking
- User sessions

See README.md for integration examples.

## Verifying It Works

1. **Check Database Tables**
   ```sql
   -- Connect to your database
   psql -U postgres -d rowbooster
   
   -- List monitoring tables
   \dt *_logs
   \dt user_statistics
   \dt rb_manager
   ```

2. **Test Token Tracking**
   - Use the main application to perform a search
   - Check the monitoring dashboard
   - You should see token usage appear

3. **Check Logs**
   Look at the terminal output for:
   ```
   [MONITORING-INIT] ✅ RBManager user created successfully
   [MONITORING-DB] New client connected to database
   ```

## Troubleshooting

### Port 5001 Already in Use
The system automatically kills the process. If it fails:

**Windows PowerShell/CMD:**
```cmd
netstat -ano | findstr :5001
taskkill /F /PID <PID>
```

**Mac/Linux:**
```bash
lsof -ti:5001 | xargs kill -9
```

### Cannot Connect to Database
Check your DATABASE_URL in the main `.env` file:

**Test connection (if psql installed):**
```bash
psql postgresql://postgres:password@localhost:5432/rowbooster
```

**Or check in pgAdmin or your preferred PostgreSQL client**

### No Data Showing
1. Ensure main app is running
2. Wait for token tracking to log data
3. Check database for monitoring tables
4. Review server logs for errors

### Login Failed
Reset RBManager password:
```sql
-- Connect to database
psql -U postgres -d rowbooster

-- Update password (hash for 'SysObserve@24')
UPDATE rb_manager 
SET password = '$2a$10$rqR5FpXhQYZKN2YhGMVbLOF1QgXj8H5vZN3xN/Z6K8yL.xJ4P0nQG'
WHERE username = 'RBManager';
```

## Production Deployment

### 1. Build for Production
```bash
npm run build
```

### 2. Set Environment Variables
```env
NODE_ENV=production
DATABASE_URL=your_production_database_url
MONITORING_PORT=5001
SESSION_SECRET=your_secure_random_secret
```

### 3. Start Production Server
```bash
npm start
```

### 4. Change Default Password
Login and update password via database:
```sql
UPDATE rb_manager 
SET password = '$2a$10$YOUR_NEW_HASHED_PASSWORD'
WHERE username = 'RBManager';
```

## Next Steps

1. **Change Default Password** (Important for production!)
2. **Integrate more logging** (See README.md)
3. **Set up data retention policies**
4. **Configure backup schedule**
5. **Monitor system performance**

## Support

If you encounter issues:
1. Check terminal logs
2. Review README.md
3. Verify database connectivity
4. Check environment variables

Happy Monitoring! 🔍