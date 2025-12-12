#!/bin/bash

# Local PostgreSQL Database Setup Script for RowBooster
# This script creates the database and initial admin user

set -e

echo "======================================"
echo "Local PostgreSQL Setup for RowBooster"
echo "======================================"
echo ""

# Default values
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-rowbooster}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"

echo "Configuration:"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "ERROR: PostgreSQL (psql) is not installed or not in PATH"
    echo "Please install PostgreSQL first:"
    echo "  Ubuntu/Debian: sudo apt-get install postgresql postgresql-contrib"
    echo "  CentOS/RHEL: sudo yum install postgresql postgresql-server"
    echo "  macOS: brew install postgresql"
    exit 1
fi

# Check if PostgreSQL service is running
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" &> /dev/null; then
    echo "WARNING: PostgreSQL service is not running on $DB_HOST:$DB_PORT"
    echo "Please start PostgreSQL service:"
    echo "  Linux: sudo systemctl start postgresql"
    echo "  macOS: brew services start postgresql"
    echo ""
    read -p "Press Enter after starting PostgreSQL to continue..."
fi

echo "Creating database '$DB_NAME'..."

# Create database (will fail if already exists, which is fine)
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;"

if [ $? -eq 0 ]; then
    echo "✓ Database '$DB_NAME' is ready"
else
    echo "✓ Database '$DB_NAME' already exists"
fi

echo ""
echo "======================================"
echo "Database setup complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Update .env file with your PostgreSQL credentials"
echo "2. Run: npm install"
echo "3. Run: npm run db:push (to create tables)"
echo "4. Run: tsx scripts/init-db.ts (to initialize default data)"
echo "5. Run: npm run dev (to start the application)"
echo ""
echo "Your DATABASE_URL should be:"
echo "DATABASE_URL=\"postgresql://$DB_USER:YOUR_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME\""
echo ""