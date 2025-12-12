/**
 * Add AI Model Selection Column Migration
 * 
 * Usage: node scripts/add-ai-model-column.js
 */

require('dotenv').config();
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function runMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if column exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'selected_ai_model'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ Column "selected_ai_model" already exists');
    } else {
      console.log('📦 Adding column "selected_ai_model" to users table...');
      await client.query(`
        ALTER TABLE users ADD COLUMN selected_ai_model TEXT DEFAULT 'gpt-4.1'
      `);
      console.log('✅ Column added successfully');
    }

    // Update any NULL values
    console.log('📦 Setting default value for existing users...');
    const updateResult = await client.query(`
      UPDATE users SET selected_ai_model = 'gpt-4.1' WHERE selected_ai_model IS NULL
    `);
    console.log(`✅ Updated ${updateResult.rowCount} users with default model`);

    // Show all users and their model selection
    const usersResult = await client.query(`
      SELECT id, username, selected_ai_model FROM users ORDER BY id
    `);
    console.log('\n📊 Current users and their AI model selection:');
    usersResult.rows.forEach(row => {
      console.log(`   User ${row.id} (${row.username}): ${row.selected_ai_model}`);
    });

    console.log('\n🎉 Migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();