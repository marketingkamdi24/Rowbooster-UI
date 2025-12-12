# Property Tables Migration Guide

This guide explains the new property tables feature and how to migrate your existing data.

## Overview

The property management system has been enhanced to support multiple property tables for different product types. Previously, there was only one global property list (for Kaminofen). Now you can create separate property tables for different product categories like:

- Kamin (Stoves)
- Gril (Grills)
- Pelletofen (Pellet stoves)
- Or any other product type you need

## What Changed

### Database Schema
1. **New table `property_tables`**: Stores different property table configurations
2. **Modified `product_properties`**: Added `property_table_id` foreign key to link properties to their table

### Features Added
1. **Multiple Property Tables**: Create and manage separate property lists for different product types
2. **Default Table**: Mark one table as default for automated operations
3. **Table Management UI**: Add, edit, delete, and switch between property tables
4. **Automatic Migration**: Existing properties are automatically migrated to a "Kamin" table

## Migration Steps

### Option 1: Automatic Migration (Recommended)

The migration will run automatically when you start the application. It will:
1. Create the `property_tables` table
2. Create a default "Kamin" property table
3. Link all existing properties to the "Kamin" table

### Option 2: Manual Migration

If you need to run the migration manually:

```bash
# Using psql command line
psql -U your_username -d your_database -f scripts/migrate-property-tables.sql

# Or using the PostgreSQL container
docker exec -i postgres_container psql -U username -d database < scripts/migrate-property-tables.sql
```

## Using the New Feature

### Accessing Property Tables

1. Go to **Settings** → **Properties** tab
2. You'll see a new "Product Type Tables" section at the top
3. Below that are the properties for the currently selected table

### Creating a New Property Table

1. Click **"Add Table"** button
2. Enter a name (e.g., "Gril", "Pelletofen")
3. Optionally add a description
4. Click **"Create Table"**
5. The new table will be created and automatically selected

### Switching Between Tables

1. Use the dropdown menu labeled **"Select Table"**
2. Choose the table you want to work with
3. The properties list will update to show only properties from that table

### Setting a Default Table

1. Select the table you want to make default
2. Click the **"Set as Default"** button
3. The default table will be used for automated operations

### Managing Properties

- Properties are now scoped to their table
- When you add/import properties, they're added to the currently selected table
- Each table maintains its own list of properties independently

### Deleting a Property Table

1. **Important**: You cannot delete the default table
2. Select the table you want to delete
3. Click the trash icon
4. Confirm the deletion
5. **Warning**: All properties in that table will also be deleted

## API Changes

### New Endpoints

```
GET    /api/property-tables              - List all property tables
GET    /api/property-tables/default      - Get the default table
POST   /api/property-tables              - Create a new table
PUT    /api/property-tables/:id          - Update a table
DELETE /api/property-tables/:id          - Delete a table
POST   /api/property-tables/:id/set-default - Set table as default
```

### Modified Endpoints

```
GET /api/properties?tableId=<id>  - Get properties for a specific table
                                    (if no tableId, returns default table properties)
```

## Backward Compatibility

- Existing code will continue to work without changes
- If no `tableId` is specified when fetching properties, the default table is used
- All existing properties are automatically migrated to the "Kamin" table
- The system creates a default table if none exists

## Best Practices

1. **Name your tables clearly**: Use product category names that your team understands
2. **Set a sensible default**: Choose the most commonly used product type as default
3. **Don't delete the default table**: Always set another table as default first
4. **Organize properties**: Keep properties specific to each product type in their respective tables
5. **Use descriptions**: Add descriptions to tables to help team members understand their purpose

## Troubleshooting

### Properties not showing up?
- Check that you've selected the correct table from the dropdown
- Verify the table is not empty by checking the property count

### Can't delete a table?
- You cannot delete the default table
- First set another table as default, then delete

### Migration didn't run?
- Check database connection
- Review database logs for errors
- Try running the migration SQL script manually

### Lost properties after migration?
- Properties are not lost, they're in the "Kamin" table
- Select "Kamin" from the table dropdown to see them

## Technical Details

### Database Schema

```sql
-- Property Tables
CREATE TABLE property_tables (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Product Properties (modified)
ALTER TABLE product_properties 
ADD COLUMN property_table_id INTEGER REFERENCES property_tables(id) ON DELETE CASCADE;
```

### Data Flow

1. User selects a property table
2. Frontend requests properties for that table
3. Backend filters properties by `property_table_id`
4. Properties are displayed in the UI
5. All operations (add/edit/delete) are scoped to the selected table

## Support

If you encounter issues:
1. Check the browser console for errors
2. Review server logs
3. Verify database migration completed successfully
4. Check that the `property_tables` table exists in your database