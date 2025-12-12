import { db } from './db';
import { sql } from 'drizzle-orm';

export async function initializePropertyTables() {
  try {
    console.log('[INIT] Checking property_tables table...');
    
    // Check if property_tables table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'property_tables'
      );
    `);
    
    const exists = (tableExists.rows[0] as any)?.exists;
    
    if (!exists) {
      console.log('[INIT] property_tables table does not exist. Creating...');
      
      // Create property_tables table
      await db.execute(sql`
        CREATE TABLE property_tables (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          is_default BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      
      console.log('[INIT] property_tables table created successfully');
      
      // Create default "Kamin" table
      await db.execute(sql`
        INSERT INTO property_tables (name, description, is_default)
        VALUES ('Kamin', 'Default property table for Kaminofen products', TRUE);
      `);
      
      console.log('[INIT] Default "Kamin" table created');
      
      // Check if property_table_id column exists in product_properties
      const columnExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'product_properties' 
          AND column_name = 'property_table_id'
        );
      `);
      
      const colExists = (columnExists.rows[0] as any)?.exists;
      
      if (!colExists) {
        console.log('[INIT] Adding property_table_id column to product_properties...');
        
        await db.execute(sql`
          ALTER TABLE product_properties 
          ADD COLUMN property_table_id INTEGER REFERENCES property_tables(id) ON DELETE CASCADE;
        `);
        
        console.log('[INIT] property_table_id column added');
      }
      
      // Migrate existing properties to the Kamin table
      const kaminTableResult = await db.execute(sql`
        SELECT id FROM property_tables WHERE name = 'Kamin' LIMIT 1;
      `);
      
      const kaminTableId = (kaminTableResult.rows[0] as any)?.id;
      
      if (kaminTableId) {
        await db.execute(sql`
          UPDATE product_properties
          SET property_table_id = ${kaminTableId}
          WHERE property_table_id IS NULL;
        `);
        
        const result = await db.execute(sql`
          SELECT COUNT(*) as count FROM product_properties 
          WHERE property_table_id = ${kaminTableId};
        `);
        
        const migratedCount = (result.rows[0] as any)?.count || 0;
        console.log(`[INIT] Migrated ${migratedCount} existing properties to "Kamin" table`);
      }
      
      // Create index for better performance
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_product_properties_table_id 
        ON product_properties(property_table_id);
      `);
      
      console.log('[INIT] Property tables initialization complete');
    } else {
      console.log('[INIT] property_tables table already exists');
    }
  } catch (error) {
    console.error('[INIT] Error initializing property tables:', error);
    // Don't throw - let the app continue even if initialization fails
  }
}