# Installing PostgreSQL on Windows - Step by Step Guide

## Quick Installation Steps

### Step 1: Download PostgreSQL

1. Visit the official PostgreSQL download page: https://www.postgresql.org/download/windows/
2. Click on "Download the installer" 
3. Download the latest PostgreSQL version (recommended: PostgreSQL 16.x or 15.x)
4. Choose the Windows x86-64 installer

**Direct Download Link:** https://www.enterprisedb.com/downloads/postgres-postgresql-downloads

### Step 2: Run the Installer

1. Double-click the downloaded `.exe` file
2. Click "Next" on the welcome screen
3. **Installation Directory:** Keep default `C:\Program Files\PostgreSQL\16` (or your version)
4. **Select Components:** Keep all selected (PostgreSQL Server, pgAdmin 4, Stack Builder, Command Line Tools)
5. **Data Directory:** Keep default `C:\Program Files\PostgreSQL\16\data`
6. **Password:** Enter a strong password for the `postgres` superuser
   - **IMPORTANT:** Remember this password! You'll need it for the `.env` file
   - Example: `MySecurePassword123!`
7. **Port:** Keep default `5432`
8. **Locale:** Keep default
9. Click "Next" and then "Finish"

### Step 3: Add PostgreSQL to System PATH

1. Open Windows Search and type "Environment Variables"
2. Click "Edit the system environment variables"
3. Click "Environment Variables" button
4. Under "System variables", find and select "Path", then click "Edit"
5. Click "New" and add: `C:\Program Files\PostgreSQL\16\bin` (adjust version number if different)
6. Click "OK" on all windows
7. **Close and reopen** any command prompts or terminals

### Step 4: Verify Installation

Open a **new** Command Prompt and run:
```cmd
psql --version
```

You should see output like: `psql (PostgreSQL) 16.x`

### Step 5: Create the Database

Open Command Prompt and run:
```cmd
psql -U postgres -c "CREATE DATABASE rowbooster;"
```

When prompted, enter the password you set during installation.

### Step 6: Update .env File

Edit the `.env` file in your project and update the DATABASE_URL:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/rowbooster"
```

Replace `YOUR_PASSWORD` with the password you set during PostgreSQL installation.

### Step 7: Initialize Database

Run these commands in your project directory:

```cmd
npm run db:push
npx tsx scripts/init-db.ts
```

### Step 8: Start the Application

```cmd
npm start
```

---

## Troubleshooting

### PostgreSQL Service Not Starting?

Open Services (search "services.msc"):
- Find "postgresql-x64-16" (or your version)
- Right-click and select "Start"

Or use Command Prompt as Administrator:
```cmd
net start postgresql-x64-16
```

### Can't Connect to Database?

Test connection:
```cmd
psql -U postgres -h localhost -p 5432
```

### Forgot PostgreSQL Password?

You'll need to reset it:
1. Open `C:\Program Files\PostgreSQL\16\data\pg_hba.conf`
2. Change `md5` to `trust` for local connections
3. Restart PostgreSQL service
4. Connect and change password:
   ```cmd
   psql -U postgres
   ALTER USER postgres PASSWORD 'new_password';
   ```
5. Change `trust` back to `md5` in pg_hba.conf
6. Restart PostgreSQL service

---

## Quick Reference

- **pgAdmin 4:** GUI tool installed with PostgreSQL
  - Location: Start Menu → PostgreSQL 16 → pgAdmin 4
  - Use this to browse your database visually

- **Command Line Access:**
  ```cmd
  psql -U postgres -d rowbooster
  ```

- **Check Service Status:**
  ```cmd
  sc query postgresql-x64-16
  ```

---

## Next Steps

After installation is complete:
1. ✅ PostgreSQL installed and running
2. ✅ Database "rowbooster" created
3. ✅ .env file updated with credentials
4. ✅ Run `npm run db:push` to create tables
5. ✅ Run `npx tsx scripts/init-db.ts` to add default data
6. ✅ Start your application with `npm start`
