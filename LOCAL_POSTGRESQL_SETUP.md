# Local PostgreSQL Setup Guide for RowBooster

This guide will help you configure RowBooster to use a local PostgreSQL database instead of an online service.

## Prerequisites

- **PostgreSQL 12+** installed on your local machine
- **Node.js 20.16.11+** installed
- **npm** package manager

---

## Step 1: Install PostgreSQL

### Windows

1. Download PostgreSQL from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
2. Run the installer and follow the setup wizard
3. Remember the password you set for the `postgres` user
4. Default port is `5432` (recommended to keep as default)

### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
```

### Linux (CentOS/RHEL)

```bash
sudo yum install postgresql postgresql-server
sudo postgresql-setup initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### macOS

```bash
brew install postgresql
brew services start postgresql
```

---

## Step 2: Create the Database

### Option A: Automated Setup (Recommended)

#### Windows
```cmd
cd scripts
setup-local-db.bat
```

#### Linux/macOS
```bash
cd scripts
chmod +x setup-local-db.sh
./setup-local-db.sh
```

### Option B: Manual Setup

1. Access PostgreSQL prompt:
   ```bash
   # Linux/macOS
   sudo -u postgres psql
   
   # Windows (from Command Prompt)
   psql -U postgres
   ```

2. Create the database:
   ```sql
   CREATE DATABASE rowbooster;
   \q
   ```

---

## Step 3: Configure Environment Variables

1. Update the `.env` file in the project root with your PostgreSQL credentials:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/rowbooster"
```

**Replace:**
- `postgres` - with your PostgreSQL username (default is `postgres`)
- `YOUR_PASSWORD` - with your PostgreSQL password
- `localhost` - with your PostgreSQL host (use `localhost` for local setup)
- `5432` - with your PostgreSQL port (default is `5432`)
- `rowbooster` - with your database name (recommended to keep as `rowbooster`)

**Example:**
```env
DATABASE_URL="postgresql://postgres:mySecurePassword123@localhost:5432/rowbooster"
```

---

## Step 4: Install Dependencies

Install or update the npm packages to use the standard PostgreSQL driver:

```bash
npm install
```

This will install `pg` (node-postgres) instead of the Neon serverless driver.

---

## Step 5: Initialize Database Schema

Create all the required tables using Drizzle ORM:

```bash
npm run db:push
```

This command will:
- Connect to your local PostgreSQL database
- Create all necessary tables (users, sessions, product_properties, etc.)
- Set up proper relationships and constraints

---

## Step 6: Initialize Default Data

Populate the database with default properties and settings:

```bash
npx tsx scripts/init-db.ts
```

This will add default product properties like:
- Artikelnummer, URL, Page
- Hersteller, Material, Farbe
- Höhe, Breite, Tiefe, Gewicht
- And many more...

---

## Step 7: Start the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

The application will be available at `http://localhost:5000`

---

## Verification

To verify your setup is working correctly:

1. The application should start without database connection errors
2. You can log in with default credentials:
   - **Username:** `admin`
   - **Password:** `admin123`
3. All features should work (user management, settings, searches, etc.)

---

## Troubleshooting

### Connection Error: "password authentication failed"

**Solution:** Verify your PostgreSQL password in the `.env` file is correct.

```bash
# Test connection manually
psql -U postgres -d rowbooster -h localhost -p 5432
```

### Connection Error: "database does not exist"

**Solution:** Create the database first:
```bash
psql -U postgres -c "CREATE DATABASE rowbooster;"
```

### Connection Error: "could not connect to server"

**Solution:** Ensure PostgreSQL service is running:

**Windows:**
```cmd
# Check service status
sc query postgresql-x64-14  # version number may vary

# Start service
net start postgresql-x64-14
```

**Linux:**
```bash
# Check status
sudo systemctl status postgresql

# Start service
sudo systemctl start postgresql

# Enable on boot
sudo systemctl enable postgresql
```

**macOS:**
```bash
# Start PostgreSQL
brew services start postgresql

# Check if running
brew services list
```

### Connection Timeout

**Solution:** Check PostgreSQL is listening on the correct port:

```bash
# Linux/macOS
sudo netstat -plnt | grep 5432

# Windows
netstat -ano | findstr :5432
```

### Permission Denied

**Solution:** You may need to update `pg_hba.conf` to allow local connections:

1. Find `pg_hba.conf`:
   - **Linux:** `/etc/postgresql/[version]/main/pg_hba.conf`
   - **Windows:** `C:\Program Files\PostgreSQL\[version]\data\pg_hba.conf`
   - **macOS:** `/usr/local/var/postgres/pg_hba.conf`

2. Add or modify this line:
   ```
   host    all             all             127.0.0.1/32            md5
   ```

3. Restart PostgreSQL service

---

## Database Management

### Viewing Data

```bash
# Connect to database
psql -U postgres -d rowbooster

# List all tables
\dt

# View users
SELECT * FROM users;

# View product properties
SELECT * FROM product_properties;

# Exit
\q
```

### Backup Database

```bash
# Create backup
pg_dump -U postgres rowbooster > rowbooster_backup.sql

# Restore backup
psql -U postgres -d rowbooster < rowbooster_backup.sql
```

### Reset Database

```bash
# Drop and recreate database
psql -U postgres -c "DROP DATABASE rowbooster;"
psql -U postgres -c "CREATE DATABASE rowbooster;"

# Re-run migrations
npm run db:push

# Re-initialize data
npx tsx scripts/init-db.ts
```

---

## Performance Optimization

### Connection Pool Settings

The default configuration in `server/db.ts` uses these settings:

```typescript
{
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // 30 seconds idle timeout
  connectionTimeoutMillis: 2000 // 2 seconds connection timeout
}
```

Adjust based on your needs in [`server/db.ts`](server/db.ts:11).

### PostgreSQL Configuration

For better performance, consider adjusting PostgreSQL settings in `postgresql.conf`:

```conf
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
```

---

## Migration from Neon/Online PostgreSQL

If you're migrating from Neon or another online PostgreSQL service:

1. **Export data from old database:**
   ```bash
   pg_dump -h old-host -U old-user -d old-database > migration.sql
   ```

2. **Create local database:**
   ```bash
   psql -U postgres -c "CREATE DATABASE rowbooster;"
   ```

3. **Import data:**
   ```bash
   psql -U postgres -d rowbooster < migration.sql
   ```

4. **Update `.env` with local connection string**

5. **Test the application**

---

## Security Best Practices

1. **Use strong passwords** for PostgreSQL users
2. **Never commit `.env` file** to version control
3. **Restrict database access** to localhost only (unless needed otherwise)
4. **Regular backups** of your database
5. **Update PostgreSQL** to the latest stable version regularly

---

## Additional Resources

- [PostgreSQL Official Documentation](https://www.postgresql.org/docs/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Node-Postgres (pg) Documentation](https://node-postgres.com/)

---

## Getting Help

If you encounter any issues:

1. Check PostgreSQL service is running
2. Verify connection credentials in `.env`
3. Review PostgreSQL logs for errors
4. Test connection using `psql` command-line tool
5. Ensure firewall allows connections to port 5432

For more help, refer to the main [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md) file.