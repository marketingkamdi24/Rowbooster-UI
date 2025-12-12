import { sql } from 'drizzle-orm';
import { db } from './db';

export async function initializeDatabase() {
  try {
    console.log('[DB-INIT] Starting database initialization...');
    
    // Create users table
    console.log('[DB-INIT] Creating users table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'user',
        is_active BOOLEAN DEFAULT true,
        email_verified BOOLEAN DEFAULT false,
        verification_token TEXT,
        verification_token_expiry TIMESTAMP,
        reset_token TEXT,
        reset_token_expiry TIMESTAMP,
        failed_login_attempts INTEGER DEFAULT 0,
        last_failed_login TIMESTAMP,
        locked_until TIMESTAMP,
        last_login TIMESTAMP,
        selected_ai_model TEXT DEFAULT 'gpt-4.1',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Add selected_ai_model column if it doesn't exist (migration for existing databases)
    const checkSelectedAiModelColumn = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name = 'selected_ai_model'
    `);
    
    if (checkSelectedAiModelColumn.rows.length === 0) {
      console.log('[DB-INIT] Adding selected_ai_model column to users table...');
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS selected_ai_model TEXT DEFAULT 'gpt-4.1'`);
      await db.execute(sql`UPDATE users SET selected_ai_model = 'gpt-4.1' WHERE selected_ai_model IS NULL`);
      console.log('[DB-INIT] ✅ selected_ai_model column added successfully');
    }
    
    // Create sessions table with security enhancements
    console.log('[DB-INIT] Creating sessions table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL,
        last_activity TIMESTAMP DEFAULT NOW(),
        user_agent TEXT,
        ip_address TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Add session security columns if they don't exist (migration for existing databases)
    const checkLastActivityColumn = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'sessions'
      AND column_name = 'last_activity'
    `);
    
    if (checkLastActivityColumn.rows.length === 0) {
      console.log('[DB-INIT] Adding session security columns...');
      await db.execute(sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP DEFAULT NOW()`);
      await db.execute(sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT`);
      await db.execute(sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address TEXT`);
      await db.execute(sql`UPDATE sessions SET last_activity = COALESCE(created_at, NOW()) WHERE last_activity IS NULL`);
    }
    
    // Create property_tables table with user_id for per-user property management
    console.log('[DB-INIT] Creating property_tables table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS property_tables (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Add user_id column if it doesn't exist (migration for existing databases)
    const checkUserIdColumn = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'property_tables'
      AND column_name = 'user_id'
    `);
    
    if (checkUserIdColumn.rows.length === 0) {
      console.log('[DB-INIT] Adding user_id column to property_tables...');
      await db.execute(sql`ALTER TABLE property_tables ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`);
    }
    
    // Ensure unique constraint on name per user (not globally unique)
    try {
      await db.execute(sql`ALTER TABLE property_tables DROP CONSTRAINT IF EXISTS property_tables_name_key`);
    } catch (e) {
      // Constraint may not exist
    }
    
    // Create unique index for name per user
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_property_tables_name_user_id ON property_tables(name, user_id)
    `);
    
    // Create product_properties table
    console.log('[DB-INIT] Creating product_properties table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS product_properties (
        id SERIAL PRIMARY KEY,
        property_table_id INTEGER REFERENCES property_tables(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        expected_format TEXT,
        order_index INTEGER DEFAULT 0,
        is_required BOOLEAN DEFAULT FALSE
      )
    `);
    
    // Create search_results table
    console.log('[DB-INIT] Creating search_results table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS search_results (
        id SERIAL PRIMARY KEY,
        article_number TEXT NOT NULL,
        product_name TEXT NOT NULL,
        search_method TEXT NOT NULL,
        properties JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create app_settings table
    console.log('[DB-INIT] Creating app_settings table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        id SERIAL PRIMARY KEY,
        openai_api_key TEXT,
        valueserp_api_key TEXT,
        valueserp_location TEXT DEFAULT 'us',
        default_ai_model TEXT DEFAULT 'openai',
        default_search_method TEXT DEFAULT 'google',
        use_valueserp BOOLEAN DEFAULT TRUE,
        use_ai BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create/Update token_usage table with user tracking
    console.log('[DB-INIT] Creating token_usage table...');
    
    // Check if table exists and has correct schema
    const checkTokenUsageSchema = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'token_usage'
      AND column_name = 'user_id'
    `);
    
    if (checkTokenUsageSchema.rows.length === 0) {
      // Table either doesn't exist or has old schema - recreate it
      console.log('[DB-INIT] Recreating token_usage table with new schema...');
      await db.execute(sql`DROP TABLE IF EXISTS token_usage CASCADE`);
    }
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS token_usage (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        model_provider TEXT NOT NULL,
        model_name TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        total_tokens INTEGER NOT NULL,
        input_cost TEXT NOT NULL DEFAULT '0',
        output_cost TEXT NOT NULL DEFAULT '0',
        total_cost TEXT NOT NULL DEFAULT '0',
        api_call_type TEXT NOT NULL,
        api_call_id TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Add api_call_id column if it doesn't exist (migration for existing databases)
    const checkApiCallIdColumn = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'token_usage'
      AND column_name = 'api_call_id'
    `);
    
    if (checkApiCallIdColumn.rows.length === 0) {
      console.log('[DB-INIT] Adding api_call_id column to token_usage table...');
      await db.execute(sql`ALTER TABLE token_usage ADD COLUMN api_call_id TEXT`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_token_usage_api_call_id ON token_usage(api_call_id)`);
      console.log('[DB-INIT] ✅ api_call_id column added to token_usage table');
    }
    
    // Create manufacturer_domains table
    console.log('[DB-INIT] Creating manufacturer_domains table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS manufacturer_domains (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        website_url TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create excluded_domains table
    console.log('[DB-INIT] Creating excluded_domains table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS excluded_domains (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        domain TEXT NOT NULL,
        reason TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create indexes for better performance
    console.log('[DB-INIT] Creating indexes...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions(user_id, expires_at)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_product_properties_table_id ON product_properties(property_table_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_search_results_article_number ON search_results(article_number)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage(user_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_token_usage_model_provider ON token_usage(model_provider)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_property_tables_user_id ON property_tables(user_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_manufacturer_domains_user_id ON manufacturer_domains(user_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_manufacturer_domains_is_active ON manufacturer_domains(is_active)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_excluded_domains_user_id ON excluded_domains(user_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_excluded_domains_is_active ON excluded_domains(is_active)
    `);
    
    // Default property tables are now created per-user when they first access the system
    // The auto-init logic in routes.ts handles this
    console.log('[DB-INIT] Property tables are now per-user. Default tables created on first user access.');
    
    // Migrate existing unassigned property tables to first admin user
    // Handle duplicate names by processing each table individually
    const adminUser = await db.execute(sql`
      SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1
    `);
    
    if (adminUser.rows[0]) {
      const adminId = (adminUser.rows[0] as any).id;
      
      // Get all unassigned tables
      const unassignedTables = await db.execute(sql`
        SELECT id, name FROM property_tables WHERE user_id IS NULL
      `);
      
      if (unassignedTables.rows.length > 0) {
        console.log(`[DB-INIT] Found ${unassignedTables.rows.length} unassigned property tables, processing migration...`);
        
        let migratedCount = 0;
        let deletedCount = 0;
        
        for (const row of unassignedTables.rows) {
          const tableId = (row as any).id;
          const tableName = (row as any).name;
          
          // Check if admin already has a table with this name
          const existingTable = await db.execute(sql`
            SELECT id FROM property_tables
            WHERE name = ${tableName} AND user_id = ${adminId}
            LIMIT 1
          `);
          
          if (existingTable.rows.length > 0) {
            // Admin already has this table name, delete the unassigned one
            // First, migrate any properties to the existing table
            const existingTableId = (existingTable.rows[0] as any).id;
            await db.execute(sql`
              UPDATE product_properties
              SET property_table_id = ${existingTableId}
              WHERE property_table_id = ${tableId}
            `);
            // Then delete the duplicate unassigned table
            await db.execute(sql`
              DELETE FROM property_tables WHERE id = ${tableId}
            `);
            deletedCount++;
            console.log(`[DB-INIT] Deleted duplicate unassigned table "${tableName}" (ID: ${tableId}), merged properties to existing table (ID: ${existingTableId})`);
          } else {
            // No conflict, assign to admin
            await db.execute(sql`
              UPDATE property_tables SET user_id = ${adminId} WHERE id = ${tableId}
            `);
            migratedCount++;
          }
        }
        
        console.log(`[DB-INIT] Migration complete: ${migratedCount} tables migrated, ${deletedCount} duplicates removed`);
      } else {
        console.log('[DB-INIT] No unassigned property tables found');
      }
    } else {
      console.log('[DB-INIT] No admin user found, skipping unassigned table migration');
    }
    
    // Verify all tables were created
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('[DB-INIT] ✅ Database initialization complete!');
    console.log('[DB-INIT] Created tables:', tables.rows.map((r: any) => r.table_name).join(', '));
    
    return true;
  } catch (error) {
    console.error('[DB-INIT] ❌ Database initialization failed:', error);
    throw error;
  }
}