-- ===========================================
-- DATA INTEGRITY MIGRATION SCRIPT
-- ===========================================
-- This migration adds:
-- 1. Missing columns from schema.ts
-- 2. Foreign key constraints for referential integrity
-- 3. Version columns for optimistic locking
-- 4. Indexes for performance
-- 5. Constraints for data validation
--
-- Run in staging first: psql -h $HOST -U $USER -d $DB -f scripts/migrate-data-integrity.sql
-- ===========================================

-- Start transaction for safety
BEGIN;

-- ===========================================
-- 1. CREATE MISSING TABLES
-- ===========================================

-- Property Tables (product type categories, e.g., "Kamin", "Grill")
CREATE TABLE IF NOT EXISTS "property_tables" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer,
    "name" text NOT NULL,
    "description" text,
    "is_default" boolean DEFAULT false,
    "version" integer DEFAULT 1 NOT NULL, -- For optimistic locking
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

-- ===========================================
-- 2. ADD MISSING COLUMNS TO EXISTING TABLES
-- ===========================================

-- Users table: Add missing columns
DO $$
BEGIN
    -- Email verification columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_verified') THEN
        ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'verification_token') THEN
        ALTER TABLE "users" ADD COLUMN "verification_token" text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'verification_token_expiry') THEN
        ALTER TABLE "users" ADD COLUMN "verification_token_expiry" timestamp;
    END IF;
    
    -- Password reset columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'reset_token') THEN
        ALTER TABLE "users" ADD COLUMN "reset_token" text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'reset_token_expiry') THEN
        ALTER TABLE "users" ADD COLUMN "reset_token_expiry" timestamp;
    END IF;
    
    -- Last login tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_login') THEN
        ALTER TABLE "users" ADD COLUMN "last_login" timestamp;
    END IF;
    
    -- Version column for optimistic locking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'version') THEN
        ALTER TABLE "users" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;
    END IF;
END $$;

-- Sessions table: Add missing columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'last_activity') THEN
        ALTER TABLE "sessions" ADD COLUMN "last_activity" timestamp DEFAULT now();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'user_agent') THEN
        ALTER TABLE "sessions" ADD COLUMN "user_agent" text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'ip_address') THEN
        ALTER TABLE "sessions" ADD COLUMN "ip_address" text;
    END IF;
END $$;

-- Product Properties table: Add missing columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_properties' AND column_name = 'property_table_id') THEN
        ALTER TABLE "product_properties" ADD COLUMN "property_table_id" integer;
    END IF;
    
    -- Version column for optimistic locking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_properties' AND column_name = 'version') THEN
        ALTER TABLE "product_properties" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;
    END IF;
END $$;

-- Token Usage table: Add missing columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'token_usage' AND column_name = 'user_id') THEN
        ALTER TABLE "token_usage" ADD COLUMN "user_id" integer;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'token_usage' AND column_name = 'input_cost') THEN
        ALTER TABLE "token_usage" ADD COLUMN "input_cost" text NOT NULL DEFAULT '0';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'token_usage' AND column_name = 'output_cost') THEN
        ALTER TABLE "token_usage" ADD COLUMN "output_cost" text NOT NULL DEFAULT '0';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'token_usage' AND column_name = 'total_cost') THEN
        ALTER TABLE "token_usage" ADD COLUMN "total_cost" text NOT NULL DEFAULT '0';
    END IF;
END $$;

-- Manufacturer Domains table: Add missing columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'manufacturer_domains' AND column_name = 'user_id') THEN
        ALTER TABLE "manufacturer_domains" ADD COLUMN "user_id" integer;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'manufacturer_domains' AND column_name = 'created_at') THEN
        ALTER TABLE "manufacturer_domains" ADD COLUMN "created_at" timestamp DEFAULT now();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'manufacturer_domains' AND column_name = 'updated_at') THEN
        ALTER TABLE "manufacturer_domains" ADD COLUMN "updated_at" timestamp DEFAULT now();
    END IF;
    
    -- Version column for optimistic locking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'manufacturer_domains' AND column_name = 'version') THEN
        ALTER TABLE "manufacturer_domains" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;
    END IF;
END $$;

-- Excluded Domains table: Add missing columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'excluded_domains' AND column_name = 'user_id') THEN
        ALTER TABLE "excluded_domains" ADD COLUMN "user_id" integer;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'excluded_domains' AND column_name = 'created_at') THEN
        ALTER TABLE "excluded_domains" ADD COLUMN "created_at" timestamp DEFAULT now();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'excluded_domains' AND column_name = 'updated_at') THEN
        ALTER TABLE "excluded_domains" ADD COLUMN "updated_at" timestamp DEFAULT now();
    END IF;
    
    -- Version column for optimistic locking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'excluded_domains' AND column_name = 'version') THEN
        ALTER TABLE "excluded_domains" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;
    END IF;
END $$;

-- App Settings: Add version column for optimistic locking
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'version') THEN
        ALTER TABLE "app_settings" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;
    END IF;
END $$;

-- Search Results: Add version and user_id columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'search_results' AND column_name = 'user_id') THEN
        ALTER TABLE "search_results" ADD COLUMN "user_id" integer;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'search_results' AND column_name = 'version') THEN
        ALTER TABLE "search_results" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;
    END IF;
END $$;

-- ===========================================
-- 3. ADD FOREIGN KEY CONSTRAINTS FOR REFERENTIAL INTEGRITY
-- ===========================================

-- Sessions -> Users (CASCADE DELETE)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_user_id_users_id_fk') THEN
        ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" 
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    END IF;
END $$;

-- Property Tables -> Users (CASCADE DELETE)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_tables_user_id_users_id_fk') THEN
        ALTER TABLE "property_tables" ADD CONSTRAINT "property_tables_user_id_users_id_fk" 
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    END IF;
END $$;

-- Product Properties -> Property Tables (CASCADE DELETE)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_properties_property_table_id_fk') THEN
        ALTER TABLE "product_properties" ADD CONSTRAINT "product_properties_property_table_id_fk" 
            FOREIGN KEY ("property_table_id") REFERENCES "property_tables"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    END IF;
END $$;

-- Token Usage -> Users (SET NULL on delete - keep usage records)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'token_usage_user_id_users_id_fk') THEN
        ALTER TABLE "token_usage" ADD CONSTRAINT "token_usage_user_id_users_id_fk" 
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    END IF;
END $$;

-- Manufacturer Domains -> Users (CASCADE DELETE)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manufacturer_domains_user_id_users_id_fk') THEN
        ALTER TABLE "manufacturer_domains" ADD CONSTRAINT "manufacturer_domains_user_id_users_id_fk" 
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    END IF;
END $$;

-- Excluded Domains -> Users (CASCADE DELETE)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'excluded_domains_user_id_users_id_fk') THEN
        ALTER TABLE "excluded_domains" ADD CONSTRAINT "excluded_domains_user_id_users_id_fk" 
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    END IF;
END $$;

-- Search Results -> Users (SET NULL on delete - keep search history)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'search_results_user_id_users_id_fk') THEN
        ALTER TABLE "search_results" ADD CONSTRAINT "search_results_user_id_users_id_fk" 
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    END IF;
END $$;

-- ===========================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ===========================================

-- Users indexes
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users"("email");
CREATE INDEX IF NOT EXISTS "idx_users_username" ON "users"("username");
CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users"("role");
CREATE INDEX IF NOT EXISTS "idx_users_is_active" ON "users"("is_active");
CREATE INDEX IF NOT EXISTS "idx_users_verification_token" ON "users"("verification_token") WHERE "verification_token" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_users_reset_token" ON "users"("reset_token") WHERE "reset_token" IS NOT NULL;

-- Sessions indexes
CREATE INDEX IF NOT EXISTS "idx_sessions_user_id" ON "sessions"("user_id");
CREATE INDEX IF NOT EXISTS "idx_sessions_expires_at" ON "sessions"("expires_at");

-- Property Tables indexes
CREATE INDEX IF NOT EXISTS "idx_property_tables_user_id" ON "property_tables"("user_id");

-- Product Properties indexes
CREATE INDEX IF NOT EXISTS "idx_product_properties_property_table_id" ON "product_properties"("property_table_id");

-- Token Usage indexes
CREATE INDEX IF NOT EXISTS "idx_token_usage_user_id" ON "token_usage"("user_id");
CREATE INDEX IF NOT EXISTS "idx_token_usage_created_at" ON "token_usage"("created_at");
CREATE INDEX IF NOT EXISTS "idx_token_usage_model_provider" ON "token_usage"("model_provider");

-- Manufacturer Domains indexes
CREATE INDEX IF NOT EXISTS "idx_manufacturer_domains_user_id" ON "manufacturer_domains"("user_id");

-- Excluded Domains indexes
CREATE INDEX IF NOT EXISTS "idx_excluded_domains_user_id" ON "excluded_domains"("user_id");
CREATE INDEX IF NOT EXISTS "idx_excluded_domains_domain" ON "excluded_domains"("domain");

-- Search Results indexes
CREATE INDEX IF NOT EXISTS "idx_search_results_user_id" ON "search_results"("user_id");
CREATE INDEX IF NOT EXISTS "idx_search_results_created_at" ON "search_results"("created_at");
CREATE INDEX IF NOT EXISTS "idx_search_results_article_number" ON "search_results"("article_number");

-- ===========================================
-- 5. ADD CHECK CONSTRAINTS FOR DATA VALIDATION
-- ===========================================

-- Users: Valid role constraint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check') THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_role_check" 
            CHECK ("role" IN ('admin', 'user', 'guest'));
    END IF;
END $$;

-- Token Usage: Non-negative token counts
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'token_usage_positive_tokens') THEN
        ALTER TABLE "token_usage" ADD CONSTRAINT "token_usage_positive_tokens" 
            CHECK ("input_tokens" >= 0 AND "output_tokens" >= 0 AND "total_tokens" >= 0);
    END IF;
END $$;

-- Product Properties: Valid order index
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_properties_order_index_check') THEN
        ALTER TABLE "product_properties" ADD CONSTRAINT "product_properties_order_index_check" 
            CHECK ("order_index" >= 0);
    END IF;
END $$;

-- ===========================================
-- 6. CREATE TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- ===========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1; -- Also increment version for optimistic locking
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for property_tables
DROP TRIGGER IF EXISTS update_property_tables_updated_at ON property_tables;
CREATE TRIGGER update_property_tables_updated_at
    BEFORE UPDATE ON property_tables
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for manufacturer_domains
DROP TRIGGER IF EXISTS update_manufacturer_domains_updated_at ON manufacturer_domains;
CREATE TRIGGER update_manufacturer_domains_updated_at
    BEFORE UPDATE ON manufacturer_domains
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for excluded_domains
DROP TRIGGER IF EXISTS update_excluded_domains_updated_at ON excluded_domains;
CREATE TRIGGER update_excluded_domains_updated_at
    BEFORE UPDATE ON excluded_domains
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for app_settings
DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
CREATE TRIGGER update_app_settings_updated_at
    BEFORE UPDATE ON app_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- 7. VERIFY MIGRATION
-- ===========================================

-- Output summary of changes
DO $$
DECLARE
    table_count integer;
    constraint_count integer;
    index_count integer;
BEGIN
    SELECT COUNT(*) INTO table_count FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    
    SELECT COUNT(*) INTO constraint_count FROM pg_constraint 
    WHERE connamespace = 'public'::regnamespace;
    
    SELECT COUNT(*) INTO index_count FROM pg_indexes 
    WHERE schemaname = 'public';
    
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Migration Summary:';
    RAISE NOTICE 'Total tables: %', table_count;
    RAISE NOTICE 'Total constraints: %', constraint_count;
    RAISE NOTICE 'Total indexes: %', index_count;
    RAISE NOTICE '===========================================';
END $$;

-- Commit the transaction
COMMIT;

-- ===========================================
-- ROLLBACK SCRIPT (Run manually if needed)
-- ===========================================
-- To rollback, run the following commands manually:
--
-- BEGIN;
-- 
-- -- Drop triggers
-- DROP TRIGGER IF EXISTS update_users_updated_at ON users;
-- DROP TRIGGER IF EXISTS update_property_tables_updated_at ON property_tables;
-- DROP TRIGGER IF EXISTS update_manufacturer_domains_updated_at ON manufacturer_domains;
-- DROP TRIGGER IF EXISTS update_excluded_domains_updated_at ON excluded_domains;
-- DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
-- 
-- -- Drop function
-- DROP FUNCTION IF EXISTS update_updated_at_column();
--
-- -- Drop foreign keys
-- ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_user_id_users_id_fk;
-- ALTER TABLE property_tables DROP CONSTRAINT IF EXISTS property_tables_user_id_users_id_fk;
-- ALTER TABLE product_properties DROP CONSTRAINT IF EXISTS product_properties_property_table_id_fk;
-- ALTER TABLE token_usage DROP CONSTRAINT IF EXISTS token_usage_user_id_users_id_fk;
-- ALTER TABLE manufacturer_domains DROP CONSTRAINT IF EXISTS manufacturer_domains_user_id_users_id_fk;
-- ALTER TABLE excluded_domains DROP CONSTRAINT IF EXISTS excluded_domains_user_id_users_id_fk;
-- ALTER TABLE search_results DROP CONSTRAINT IF EXISTS search_results_user_id_users_id_fk;
--
-- -- Drop check constraints
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
-- ALTER TABLE token_usage DROP CONSTRAINT IF EXISTS token_usage_positive_tokens;
-- ALTER TABLE product_properties DROP CONSTRAINT IF EXISTS product_properties_order_index_check;
--
-- COMMIT;