/**
 * Database Migration Runner
 * 
 * Runs SQL migration scripts using the DATABASE_URL from environment.
 * 
 * Usage:
 *   npx tsx scripts/run-migration.ts                    # Run data-integrity migration
 *   npx tsx scripts/run-migration.ts <migration-file>   # Run specific migration file
 */

import { config } from 'dotenv';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is not set');
  console.error('');
  console.error('Please set DATABASE_URL in your .env file:');
  console.error('  DATABASE_URL=postgresql://username:password@localhost:5432/database');
  console.error('');
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const migrationFile = args[0] || 'migrate-data-integrity.sql';

// Resolve migration file path
const scriptsDir = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const migrationPath = path.resolve(scriptsDir, migrationFile);

console.log('🔧 Database Migration Runner');
console.log('============================');
console.log(`📁 Migration file: ${migrationPath}`);

// Check if migration file exists
if (!fs.existsSync(migrationPath)) {
  console.error(`❌ ERROR: Migration file not found: ${migrationPath}`);
  console.error('');
  console.error('Available migrations:');
  const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.sql'));
  files.forEach(f => console.error(`  - ${f}`));
  process.exit(1);
}

// Create database pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

async function runMigration(): Promise<void> {
  const client = await pool.connect();
  
  try {
    // Parse connection info for display (hide password)
    const urlParts = new URL(DATABASE_URL!);
    console.log(`🔗 Database: ${urlParts.host}${urlParts.pathname}`);
    console.log(`👤 User: ${urlParts.username}`);
    console.log('');
    
    // Test connection
    console.log('📡 Testing database connection...');
    const testResult = await client.query('SELECT NOW() as current_time, current_database() as database');
    console.log(`✅ Connected to database: ${testResult.rows[0].database}`);
    console.log(`⏰ Server time: ${testResult.rows[0].current_time}`);
    console.log('');
    
    // Read migration SQL
    console.log('📄 Reading migration file...');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(`📊 Migration size: ${(migrationSQL.length / 1024).toFixed(2)} KB`);
    console.log('');
    
    // Run migration
    console.log('🚀 Running migration...');
    console.log('─'.repeat(50));
    
    const startTime = Date.now();
    
    // Execute the migration
    await client.query(migrationSQL);
    
    const duration = Date.now() - startTime;
    
    console.log('─'.repeat(50));
    console.log(`✅ Migration completed successfully in ${duration}ms`);
    console.log('');
    
    // Show summary of tables
    console.log('📊 Database Table Summary:');
    const tablesResult = await client.query(`
      SELECT 
        tablename,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = tablename) as columns
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    
    tablesResult.rows.forEach(row => {
      console.log(`   ${row.tablename} (${row.columns} columns)`);
    });
    
    console.log('');
    
    // Show constraint summary
    console.log('🔗 Foreign Key Constraints:');
    const constraintsResult = await client.query(`
      SELECT 
        conname as constraint_name,
        conrelid::regclass as table_name
      FROM pg_constraint 
      WHERE contype = 'f' 
        AND connamespace = 'public'::regnamespace
      ORDER BY conrelid::regclass::text, conname
    `);
    
    constraintsResult.rows.forEach(row => {
      console.log(`   ${row.table_name}: ${row.constraint_name}`);
    });
    
    console.log('');
    console.log('🎉 Migration process complete!');
    
  } catch (error: any) {
    console.error('');
    console.error('❌ Migration FAILED:');
    console.error('─'.repeat(50));
    console.error(error.message);
    
    if (error.position) {
      console.error(`   Position: ${error.position}`);
    }
    if (error.detail) {
      console.error(`   Detail: ${error.detail}`);
    }
    if (error.hint) {
      console.error(`   Hint: ${error.hint}`);
    }
    
    console.error('─'.repeat(50));
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});