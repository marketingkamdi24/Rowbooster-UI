-- Add dynamic key property columns to property_tables
ALTER TABLE property_tables 
ADD COLUMN IF NOT EXISTS article_number_property TEXT DEFAULT 'Artikelnummer',
ADD COLUMN IF NOT EXISTS product_name_property TEXT DEFAULT 'Produktname';

-- Update existing tables to use these defaults
UPDATE property_tables 
SET 
  article_number_property = 'Artikelnummer',
  product_name_property = 'Produktname'
WHERE article_number_property IS NULL OR product_name_property IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN property_tables.article_number_property IS 'Name of the property that represents the article number in this table';
COMMENT ON COLUMN property_tables.product_name_property IS 'Name of the property that represents the product name in this table';