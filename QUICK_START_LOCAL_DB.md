# Quick Start: Local PostgreSQL Setup

This is a quick reference guide for setting up RowBooster with local PostgreSQL. For detailed instructions, see [LOCAL_POSTGRESQL_SETUP.md](LOCAL_POSTGRESQL_SETUP.md).

## Prerequisites

- PostgreSQL 12+ installed and running
- Node.js 20.16.11+
- npm package manager

---

## Quick Setup Steps

### 1. Create Database

**Windows:**
```cmd
cd scripts
setup-local-db.bat
```

**Linux/macOS:**
```bash
cd scripts
chmod +x setup-local-db.sh
./setup-local-db.sh
```

**Or manually:**
```bash
psql -U postgres -c "CREATE DATABASE rowbooster;"
```

### 2. Configure Environment

Edit `.env` file with your PostgreSQL credentials:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/rowbooster"
```

Replace `YOUR_PASSWORD` with your actual PostgreSQL password.

### 3. Install Dependencies

```bash
npm install
```

### 4. Initialize Database

```bash
# Create tables
npm run db:push

# Add default data
npx tsx scripts/init-db.ts
```

### 5. Start Application

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

---

## Default Login

- **URL:** http://localhost:5000
- **Username:** admin
- **Password:** admin123

⚠️ Change the password after first login!

---

## Common Issues

### Can't connect to database?
- Check PostgreSQL is running
- Verify password in `.env`
- Ensure database exists

### Database doesn't exist?
```bash
psql -U postgres -c "CREATE DATABASE rowbooster;"
```

### PostgreSQL not running?

**Windows:** `net start postgresql-x64-14`  
**Linux:** `sudo systemctl start postgresql`  
**macOS:** `brew services start postgresql`

---

## What Changed?

The project has been reconfigured from Neon Database (online) to local PostgreSQL:

- ✅ Replaced `@neondatabase/serverless` with `pg` (node-postgres)
- ✅ Updated [`server/db.ts`](server/db.ts) to use local connection pool
- ✅ Updated [`drizzle.config.ts`](drizzle.config.ts) for local setup
- ✅ Created setup scripts for Windows and Linux
- ✅ Updated `.env` with local database URL template

---

## Need Help?

See the comprehensive guide: [LOCAL_POSTGRESQL_SETUP.md](LOCAL_POSTGRESQL_SETUP.md)