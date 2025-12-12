# Per-User Property Tables Architecture

## Overview

This document describes the modular per-user property management architecture implemented in RowBooster. Each user has their own isolated set of property tables with full CRUD operations, allowing for personalized product type configurations.

## Key Features

- **User Isolation**: Each user can only see and manage their own property tables
- **Table Limit**: Maximum of 25 property tables per user
- **Default Table**: Users can set one table as their default, which is used for searches
- **Auto-Initialization**: New users automatically get a default "Kamin" table on first access

## Database Schema

### Property Tables (property_tables)

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | Unique identifier |
| name | VARCHAR(255) | Table name (unique per user) |
| description | TEXT | Optional description |
| is_default | BOOLEAN | Whether this is the user's default table |
| user_id | INTEGER | References users(id), nullable for migration |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### Constraints

- **Unique Index**: `(name, user_id)` - Same table name can exist for different users
- **Foreign Key**: `user_id` references `users(id)` with `ON DELETE CASCADE`
- **Trigger**: `enforce_property_table_limit` prevents exceeding 25 tables per user

## API Endpoints

All endpoints require authentication via session cookie.

### Property Tables

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/property-tables` | List user's property tables |
| GET | `/api/property-tables/count` | Get count of user's tables |
| GET | `/api/property-tables/:id` | Get specific table (must belong to user) |
| POST | `/api/property-tables` | Create new table |
| PUT | `/api/property-tables/:id` | Update table |
| DELETE | `/api/property-tables/:id` | Delete table |
| POST | `/api/property-tables/:id/set-default` | Set as default table |

### Properties

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/properties` | List properties (optionally filtered by tableId) |
| GET | `/api/properties/:id` | Get specific property |
| POST | `/api/properties` | Create new property |
| PUT | `/api/properties/:id` | Update property |
| DELETE | `/api/properties/:id` | Delete property |

## Frontend Components

### PropertiesManager.tsx

The main UI component for managing property tables and properties.

**Features:**
- Table selector dropdown with star indicator for default table
- Create/Edit/Delete tables
- Table count display (X / 25) with color indicators:
  - Blue: Normal usage
  - Yellow: Approaching limit (22-24 tables)
  - Red: Limit reached (25 tables)
- Warning messages when approaching or reaching the limit
- Properties table with CRUD operations
- Export table to Excel functionality

### Table Selector UI Example

```tsx
<div className="flex items-center gap-2 pl-3 ml-2 border-l border-gray-300">
  <div className="flex items-center gap-1">
    <Table2 className="h-3 w-3 text-blue-600" />
    <span className="text-xs font-medium text-blue-700">Tabelle:</span>
  </div>
  <Select value={selectedTableId} onValueChange={setSelectedTableId}>
    <SelectTrigger className="h-6 w-[120px] text-xs bg-white border-gray-300">
      <SelectValue placeholder="Select table" />
    </SelectTrigger>
    <SelectContent>
      {tables.map((table) => (
        <SelectItem key={table.id} value={table.id.toString()}>
          <div className="flex items-center gap-2">
            {table.isDefault && <Star className="h-3 w-3 fill-yellow-400" />}
            {table.name}
          </div>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

## Migration

### Running the Migration

Execute the migration script to add user ownership to existing property tables:

```bash
# Via psql
psql -d your_database -f scripts/migrate-per-user-property-tables.sql

# Or via npm script
npm run migrate:property-tables
```

### What the Migration Does

1. Adds `user_id` column to `property_tables` table
2. Creates index on `user_id` for fast lookups
3. Creates unique constraint on `(name, user_id)`
4. Assigns existing unassigned tables to admin user
5. Creates database trigger to enforce 25-table limit

## Storage Methods

### New Methods in DatabaseStorage

```typescript
// Get all tables for a user
getPropertyTablesByUserId(userId: number): Promise<PropertyTable[]>

// Count user's tables
countPropertyTablesByUserId(userId: number): Promise<number>

// Get table by ID (verifies user ownership)
getPropertyTableByIdAndUser(id: number, userId: number): Promise<PropertyTable | undefined>

// Get table by name for a specific user
getPropertyTableByNameAndUser(name: string, userId: number): Promise<PropertyTable | undefined>

// Get user's default table
getDefaultPropertyTableByUserId(userId: number): Promise<PropertyTable | undefined>

// Create table for user (with limit check)
createPropertyTableForUser(table: InsertPropertyTable, userId: number): Promise<PropertyTable>

// Update table (verifies user ownership)
updatePropertyTableForUser(id: number, userId: number, updateData: Partial<InsertPropertyTable>): Promise<PropertyTable | undefined>

// Delete table (verifies user ownership)
deletePropertyTableForUser(id: number, userId: number): Promise<boolean>

// Set default table for user
setDefaultPropertyTableForUser(id: number, userId: number): Promise<boolean>

// Get properties filtered by user's tables
getPropertiesByUserId(userId: number, propertyTableId?: number): Promise<ProductProperty[]>
```

## Error Handling

### Common Errors

| Error | Description | HTTP Status |
|-------|-------------|-------------|
| Table not found | Table doesn't exist or doesn't belong to user | 404 |
| Duplicate name | Another table with same name exists for this user | 400 |
| Limit exceeded | User has reached 25 table limit | 400 |
| Unauthorized | User not authenticated | 401 |
| Cannot delete default | Default table cannot be deleted | 400 |

### Error Response Format

```json
{
  "error": "Table limit exceeded",
  "message": "You can have a maximum of 25 property tables. Please delete an existing table to create a new one.",
  "maxTables": 25,
  "currentCount": 25
}
```

## Best Practices

1. **Always check table count** before showing create button
2. **Validate user ownership** before any CRUD operation
3. **Use transactions** for operations that modify multiple records
4. **Cache table list** to reduce database queries
5. **Provide clear feedback** when approaching or exceeding limits

## Testing

### Manual Testing Checklist

- [ ] Create property table as user A
- [ ] Verify user B cannot see user A's tables
- [ ] Create 25 tables, verify limit enforcement
- [ ] Delete a table, verify count decreases
- [ ] Set default table, verify it's used for searches
- [ ] Create table with duplicate name (should succeed for different users)
- [ ] Verify properties are correctly associated with tables

### API Testing

```bash
# Get user's tables
curl -X GET http://localhost:5000/api/property-tables \
  -H "Cookie: session=your_session_id"

# Get table count
curl -X GET http://localhost:5000/api/property-tables/count \
  -H "Cookie: session=your_session_id"

# Create table
curl -X POST http://localhost:5000/api/property-tables \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your_session_id" \
  -d '{"name": "New Table", "description": "Test table"}'
```

## Future Enhancements

- [ ] Table templates for common product types
- [ ] Import/Export tables between users (admin feature)
- [ ] Table sharing/collaboration
- [ ] Configurable table limit per user role
- [ ] Table analytics (usage statistics)