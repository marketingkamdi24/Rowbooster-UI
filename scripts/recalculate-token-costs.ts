/**
 * Token Cost Recalculation Script
 * 
 * This script:
 * 1. Adds the api_call_id column if it doesn't exist
 * 2. Recalculates costs for all existing token_usage records using correct pricing
 * 
 * Run with: npx tsx scripts/recalculate-token-costs.ts
 * or: npm run recalculate-costs (after adding script to package.json)
 */

import { config } from 'dotenv';
config(); // Load environment variables

import pkg from 'pg';
const { Pool } = pkg;

// Correct pricing per million tokens (matching tokenTracker.ts)
const PRICING: Record<string, { INPUT_PRICE_PER_MILLION: number; OUTPUT_PRICE_PER_MILLION: number }> = {
  "gpt-4.1": {
    INPUT_PRICE_PER_MILLION: 3.0,
    OUTPUT_PRICE_PER_MILLION: 12.0,
  },
  "gpt-4.1-mini": {
    INPUT_PRICE_PER_MILLION: 0.4,
    OUTPUT_PRICE_PER_MILLION: 1.6,
  },
  "gpt-4o": {
    INPUT_PRICE_PER_MILLION: 5.0,
    OUTPUT_PRICE_PER_MILLION: 15.0,
  },
  "gpt-4o-mini": {
    INPUT_PRICE_PER_MILLION: 0.15,
    OUTPUT_PRICE_PER_MILLION: 0.60,
  },
  "gpt-4-turbo": {
    INPUT_PRICE_PER_MILLION: 10.0,
    OUTPUT_PRICE_PER_MILLION: 30.0,
  },
  "gpt-3.5-turbo": {
    INPUT_PRICE_PER_MILLION: 0.50,
    OUTPUT_PRICE_PER_MILLION: 1.50,
  },
  default: {
    INPUT_PRICE_PER_MILLION: 3.0,
    OUTPUT_PRICE_PER_MILLION: 12.0,
  },
};

function calculateCost(modelName: string, inputTokens: number, outputTokens: number) {
  const normalizedModelName = modelName.toLowerCase();
  const pricing = PRICING[normalizedModelName] || PRICING[modelName] || PRICING.default;
  
  const inputCost = (inputTokens / 1_000_000) * pricing.INPUT_PRICE_PER_MILLION;
  const outputCost = (outputTokens / 1_000_000) * pricing.OUTPUT_PRICE_PER_MILLION;
  const totalCost = inputCost + outputCost;

  return {
    inputCost: inputCost.toFixed(8),
    outputCost: outputCost.toFixed(8),
    totalCost: totalCost.toFixed(8),
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.log('Please set DATABASE_URL in your .env file');
    process.exit(1);
  }

  console.log('🔌 Connecting to database...');
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connected to database successfully\n');

    // Step 1: Check and add api_call_id column if missing
    console.log('📋 Step 1: Checking for api_call_id column...');
    const columnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_usage' AND column_name = 'api_call_id'
      ) as exists
    `);

    if (!columnCheck.rows[0].exists) {
      console.log('   Adding api_call_id column...');
      await pool.query('ALTER TABLE token_usage ADD COLUMN api_call_id TEXT');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_token_usage_api_call_id ON token_usage(api_call_id)');
      console.log('   ✅ api_call_id column added\n');
    } else {
      console.log('   ✅ api_call_id column already exists\n');
    }

    // Step 2: Check and add cost columns if missing
    console.log('📋 Step 2: Checking for cost columns...');
    const inputCostCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_usage' AND column_name = 'input_cost'
      ) as exists
    `);

    if (!inputCostCheck.rows[0].exists) {
      console.log('   Adding input_cost column...');
      await pool.query("ALTER TABLE token_usage ADD COLUMN input_cost TEXT DEFAULT '0'");
      console.log('   ✅ input_cost column added');
    } else {
      console.log('   ✅ input_cost column already exists');
    }

    const outputCostCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_usage' AND column_name = 'output_cost'
      ) as exists
    `);

    if (!outputCostCheck.rows[0].exists) {
      console.log('   Adding output_cost column...');
      await pool.query("ALTER TABLE token_usage ADD COLUMN output_cost TEXT DEFAULT '0'");
      console.log('   ✅ output_cost column added\n');
    } else {
      console.log('   ✅ output_cost column already exists\n');
    }

    // Step 3: Get all existing token_usage records
    console.log('📋 Step 3: Fetching existing token usage records...');
    const result = await pool.query(`
      SELECT id, model_name, input_tokens, output_tokens, total_cost
      FROM token_usage
      ORDER BY id
    `);

    const records = result.rows;
    console.log(`   Found ${records.length} records to process\n`);

    if (records.length === 0) {
      console.log('✅ No records to update. Migration complete!\n');
      await pool.end();
      return;
    }

    // Step 4: Recalculate costs for each record
    console.log('📋 Step 4: Recalculating costs for existing records...');
    let updatedCount = 0;
    let totalOldCost = 0;
    let totalNewCost = 0;

    for (const record of records) {
      const oldCost = parseFloat(record.total_cost) || 0;
      totalOldCost += oldCost;

      const costs = calculateCost(
        record.model_name,
        record.input_tokens,
        record.output_tokens
      );

      totalNewCost += parseFloat(costs.totalCost);

      // Update the record with correct costs
      await pool.query(`
        UPDATE token_usage 
        SET input_cost = $1, output_cost = $2, total_cost = $3
        WHERE id = $4
      `, [costs.inputCost, costs.outputCost, costs.totalCost, record.id]);

      updatedCount++;

      // Progress indicator
      if (updatedCount % 100 === 0) {
        console.log(`   Processed ${updatedCount}/${records.length} records...`);
      }
    }

    console.log(`   ✅ Updated ${updatedCount} records\n`);

    // Step 5: Summary
    console.log('📊 Summary:');
    console.log(`   Records processed: ${updatedCount}`);
    console.log(`   Old total cost: $${totalOldCost.toFixed(4)}`);
    console.log(`   New total cost: $${totalNewCost.toFixed(4)}`);
    console.log(`   Difference: $${(totalNewCost - totalOldCost).toFixed(4)}`);
    
    if (totalOldCost > 0) {
      const percentChange = ((totalNewCost - totalOldCost) / totalOldCost * 100).toFixed(1);
      console.log(`   Change: ${percentChange}%`);
    }

    console.log('\n✅ Migration completed successfully!');

    // Show sample of updated records
    console.log('\n📋 Sample of updated records:');
    const sample = await pool.query(`
      SELECT id, model_name, input_tokens, output_tokens, 
             input_cost, output_cost, total_cost
      FROM token_usage
      ORDER BY id DESC
      LIMIT 5
    `);

    console.table(sample.rows);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

main().catch(console.error);