-- Migration script to add property tables support
-- This allows managing multiple property tables for different product types

-- Create property_tables table
CREATE TABLE IF NOT EXISTS property_tables (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create default "Kamin" property table
INSERT INTO property_tables (name, description, is_default)
VALUES ('Kamin', 'Default property table for Kaminofen products', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Add property_table_id column to product_properties if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_properties' AND column_name = 'property_table_id'
  ) THEN
    ALTER TABLE product_properties 
    ADD COLUMN property_table_id INTEGER REFERENCES property_tables(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Migrate existing properties to the default "Kamin" table
UPDATE product_properties
SET property_table_id = (SELECT id FROM property_tables WHERE name = 'Kamin')
WHERE property_table_id IS NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_product_properties_table_id 
ON product_properties(property_table_id);

-- Display migration results
SELECT 
  'Migration completed successfully!' as status,
  (SELECT COUNT(*) FROM property_tables) as total_tables,
  (SELECT COUNT(*) FROM product_properties) as total_properties,
  (SELECT COUNT(*) FROM product_properties WHERE property_table_id IS NOT NULL) as migrated_properties;