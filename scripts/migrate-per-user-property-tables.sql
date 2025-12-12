-- Migration Script: Per-User Property Tables
-- This script adds user ownership to property tables for modular user architecture
-- Each user can have up to 25 property tables

-- Step 1: Add user_id column to property_tables if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'property_tables' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE property_tables ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added user_id column to property_tables';
    ELSE
        RAISE NOTICE 'user_id column already exists in property_tables';
    END IF;
END $$;

-- Step 2: Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_property_tables_user_id ON property_tables(user_id);

-- Step 3: Create unique constraint for table name per user (allows same name across different users)
-- First, drop any existing unique constraint on just the name
DO $$
BEGIN
    -- Check if unique constraint exists on just name and drop it
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'property_tables_name_key' OR conname = 'property_tables_name_unique'
    ) THEN
        ALTER TABLE property_tables DROP CONSTRAINT IF EXISTS property_tables_name_key;
        ALTER TABLE property_tables DROP CONSTRAINT IF EXISTS property_tables_name_unique;
        RAISE NOTICE 'Dropped existing unique constraint on name column';
    END IF;
END $$;

-- Create unique constraint on name + user_id combination
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'property_tables_name_user_id_unique'
    ) THEN
        -- Create unique index instead of constraint to handle NULL user_id values
        CREATE UNIQUE INDEX IF NOT EXISTS property_tables_name_user_id_unique 
        ON property_tables(name, user_id) WHERE user_id IS NOT NULL;
        RAISE NOTICE 'Created unique index on (name, user_id)';
    END IF;
END $$;

-- Step 4: Assign existing unassigned tables to admin user (user_id = 1)
-- This preserves existing data while enabling per-user management
UPDATE property_tables 
SET user_id = (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1)
WHERE user_id IS NULL;

-- Step 5: Verify migration
DO $$
DECLARE
    unassigned_count INTEGER;
    admin_id INTEGER;
BEGIN
    SELECT id INTO admin_id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1;
    SELECT COUNT(*) INTO unassigned_count FROM property_tables WHERE user_id IS NULL;
    
    IF unassigned_count > 0 THEN
        RAISE WARNING 'There are still % unassigned property tables', unassigned_count;
    ELSE
        RAISE NOTICE 'All property tables have been assigned to users';
    END IF;
    
    RAISE NOTICE 'Admin user ID: %', admin_id;
END $$;

-- Step 6: Create function to enforce 25-table limit per user (optional database-level enforcement)
CREATE OR REPLACE FUNCTION check_property_table_limit()
RETURNS TRIGGER AS $$
DECLARE
    table_count INTEGER;
    max_tables INTEGER := 25;
BEGIN
    -- Count existing tables for this user
    SELECT COUNT(*) INTO table_count 
    FROM property_tables 
    WHERE user_id = NEW.user_id;
    
    -- Check if limit would be exceeded
    IF table_count >= max_tables THEN
        RAISE EXCEPTION 'User has reached the maximum limit of % property tables', max_tables;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS enforce_property_table_limit ON property_tables;
CREATE TRIGGER enforce_property_table_limit
    BEFORE INSERT ON property_tables
    FOR EACH ROW
    EXECUTE FUNCTION check_property_table_limit();

-- Step 7: Summary
DO $$
DECLARE
    total_tables INTEGER;
    users_with_tables INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_tables FROM property_tables;
    SELECT COUNT(DISTINCT user_id) INTO users_with_tables FROM property_tables WHERE user_id IS NOT NULL;
    
    RAISE NOTICE '=== Migration Complete ===';
    RAISE NOTICE 'Total property tables: %', total_tables;
    RAISE NOTICE 'Users with property tables: %', users_with_tables;
    RAISE NOTICE 'Maximum tables per user: 25';
END $$;