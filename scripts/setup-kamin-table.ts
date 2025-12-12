import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { initializeDefaultKaminProperties } from '../server/init-default-properties';

async function setupKaminTable() {
  try {
    console.log('[SETUP] Creating Kamin property table...');
    
    // First, reset any existing default
    await db.execute(sql`UPDATE property_tables SET is_default = FALSE WHERE is_default = TRUE`);
    
    // Check if Kamin table exists
    const existing = await db.execute(sql`SELECT id FROM property_tables WHERE name = 'Kamin' LIMIT 1`);
    
    let kaminTableId: number;
    if (existing.rows.length > 0) {
      kaminTableId = (existing.rows[0] as any).id;
      console.log('[SETUP] Kamin table already exists with ID:', kaminTableId);
      // Set it as default
      await db.execute(sql`UPDATE property_tables SET is_default = TRUE WHERE id = ${kaminTableId}`);
    } else {
      // Create Kamin table
      const result = await db.execute(sql`
        INSERT INTO property_tables (name, description, is_default, user_id)
        VALUES ('Kamin', 'Default property table for Kaminofen products', TRUE, 1)
        RETURNING id
      `);
      kaminTableId = (result.rows[0] as any).id;
      console.log('[SETUP] Created Kamin table with ID:', kaminTableId);
    }
    
    // Initialize default properties
    await initializeDefaultKaminProperties(kaminTableId);
    
    console.log('[SETUP] ✅ Kamin table setup complete and set as default!');
    process.exit(0);
  } catch (error) {
    console.error('[SETUP] Error:', error);
    process.exit(1);
  }
}

setupKaminTable();
