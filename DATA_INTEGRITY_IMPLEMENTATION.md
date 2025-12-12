# Data Integrity & Reliability Implementation

This document describes the comprehensive data integrity improvements implemented in the RowBooster application.

## Table of Contents

1. [Database Backups](#1-database-backups)
2. [Data Validation](#2-data-validation)
3. [Error Handling](#3-error-handling)
4. [Transaction Management](#4-transaction-management)
5. [Data Migration Scripts](#5-data-migration-scripts)
6. [Referential Integrity](#6-referential-integrity)
7. [Concurrent Access](#7-concurrent-access)
8. [Quick Start Guide](#8-quick-start-guide)

---

## 1. Database Backups

### Overview
Automated daily backups with configurable retention policy ensure data can be recovered in case of failures.

### Files
- [`scripts/database-backup.ts`](scripts/database-backup.ts) - CLI backup utility
- [`server/services/backupScheduler.ts`](server/services/backupScheduler.ts) - Automated backup scheduler

### Features
- **Automated Daily Backups**: Scheduled backups at configurable time (default: 2 AM)
- **Gzip Compression**: Reduces backup file size by ~70-90%
- **Retention Policy**: Automatic cleanup of old backups (default: 30 days)
- **Backup Verification**: Content validation before cleanup
- **CLI Interface**: Manual backup/restore operations

### Usage

```bash
# Create a backup
npx tsx scripts/database-backup.ts create

# List all backups
npx tsx scripts/database-backup.ts list

# Restore from a backup
npx tsx scripts/database-backup.ts restore backups/backup_2025-01-15_020000.sql.gz

# Clean up old backups
npx tsx scripts/database-backup.ts cleanup

# Verify a backup file
npx tsx scripts/database-backup.ts verify backups/backup_2025-01-15_020000.sql.gz
```

### Configuration

Set these environment variables to configure backups:

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKUP_DIR` | `./backups` | Directory to store backups |
| `BACKUP_RETENTION_DAYS` | `30` | Days to keep backups |
| `BACKUP_TIME` | `02:00` | Daily backup time (HH:MM) |
| `DATABASE_URL` | - | PostgreSQL connection string |

### Enabling Automated Backups

Add to your server startup code:

```typescript
import { initBackupScheduler } from './services/backupScheduler';

// In your startup sequence
await initBackupScheduler();
```

---

## 2. Data Validation

### Overview
Comprehensive input validation on both client and server side using Zod schemas.

### Files
- [`shared/validation.ts`](shared/validation.ts) - 40+ validation schemas
- [`server/middleware/errorHandler.ts`](server/middleware/errorHandler.ts) - Validation error handling

### Features
- **40+ Validation Schemas**: Covers all API endpoints
- **Type-Safe Validation**: Full TypeScript integration
- **Helpful Error Messages**: User-friendly validation errors
- **Reusable Validators**: Common patterns (email, password, URL, etc.)

### Available Schemas

| Category | Schemas |
|----------|---------|
| **Authentication** | `loginSchema`, `userRegistrationSchema`, `passwordChangeSchema`, `passwordResetSchema`, `emailVerificationSchema` |
| **Users** | `userCreateSchema`, `userUpdateSchema`, `userIdSchema` |
| **Properties** | `propertyTableCreateSchema`, `propertyTableUpdateSchema`, `productPropertyCreateSchema`, `productPropertyUpdateSchema` |
| **Search** | `searchRequestSchema`, `batchSearchRequestSchema`, `urlSearchRequestSchema`, `pdfSearchRequestSchema` |
| **Domains** | `manufacturerDomainCreateSchema`, `excludedDomainCreateSchema` |
| **Export** | `exportOptionsSchema` |
| **Settings** | `appSettingsUpdateSchema` |

### Usage

```typescript
import { 
  loginSchema, 
  createValidationMiddleware,
  ValidatedRequest 
} from '@shared/validation';

// In route handler
app.post('/api/auth/login', (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: result.error.errors
    });
  }
  const { username, password } = result.data;
  // ... proceed with validated data
});

// Using middleware
import { createValidationMiddleware } from '@shared/validation';

app.post(
  '/api/users',
  createValidationMiddleware(userCreateSchema),
  (req: ValidatedRequest<typeof userCreateSchema>, res) => {
    // req.validated contains validated data
    const userData = req.validated;
  }
);
```

---

## 3. Error Handling

### Overview
Centralized error handling with user-friendly messages and comprehensive logging.

### Files
- [`server/middleware/errorHandler.ts`](server/middleware/errorHandler.ts) - Error classes and middleware

### Features
- **Custom Error Classes**: `AppError`, `ValidationError`, `AuthenticationError`, etc.
- **User-Friendly Messages**: No internal details leaked to clients
- **Request ID Tracing**: Every request gets a unique ID for debugging
- **Error Logging**: Automatic logging to MonitoringLogger
- **Async Handler**: Wrapper for catching async route errors

### Error Classes

| Class | Status | Use Case |
|-------|--------|----------|
| `AppError` | 500 | Generic application error |
| `ValidationError` | 400 | Input validation failed |
| `AuthenticationError` | 401 | Invalid credentials |
| `AuthorizationError` | 403 | Permission denied |
| `NotFoundError` | 404 | Resource not found |
| `ConflictError` | 409 | Duplicate/conflict |
| `RateLimitError` | 429 | Too many requests |
| `DatabaseError` | 500 | Database operation failed |
| `ExternalServiceError` | 502 | External API failed |

### Usage

```typescript
import {
  asyncHandler,
  NotFoundError,
  ValidationError,
  AuthorizationError
} from './middleware/errorHandler';

// Using asyncHandler wrapper
app.get('/api/users/:id', asyncHandler(async (req, res) => {
  const user = await getUserById(req.params.id);
  
  if (!user) {
    throw new NotFoundError('User');
  }
  
  if (!canViewUser(req.user, user)) {
    throw new AuthorizationError('view this user');
  }
  
  res.json(user);
}));
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  },
  "requestId": "req_abc123"
}
```

---

## 4. Transaction Management

### Overview
Database transactions ensure critical operations are atomic and can be rolled back on failure.

### Files
- [`server/utils/transaction.ts`](server/utils/transaction.ts) - Transaction utilities

### Features
- **Automatic Rollback**: Failed transactions are automatically rolled back
- **Isolation Levels**: READ COMMITTED, REPEATABLE READ, SERIALIZABLE
- **Savepoints**: Nested transaction support
- **Retry Logic**: Automatic retry for transient failures (deadlocks)
- **Batch Operations**: Helper functions for batch insert/update

### Usage

```typescript
import { 
  withTransaction, 
  withSerializableTransaction,
  IsolationLevel 
} from './utils/transaction';

// Basic transaction
const result = await withTransaction(async (ctx) => {
  await ctx.query('INSERT INTO users (name) VALUES ($1)', ['John']);
  await ctx.query('INSERT INTO profiles (user_id) VALUES ($1)', [1]);
  return { success: true };
});

// Serializable transaction (highest isolation)
const result = await withSerializableTransaction(async (ctx) => {
  const { rows } = await ctx.query('SELECT balance FROM accounts WHERE id = $1', [1]);
  const newBalance = rows[0].balance - 100;
  await ctx.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newBalance, 1]);
  return { newBalance };
});

// With savepoints for nested operations
await withTransaction(async (ctx) => {
  await ctx.query('INSERT INTO orders (...)');
  
  const savepoint = await ctx.savepoint('items');
  try {
    await ctx.query('INSERT INTO order_items (...)');
  } catch (error) {
    await ctx.rollbackToSavepoint('items');
    // Order is still created, items failed
  }
});
```

### Isolation Levels

| Level | Use Case |
|-------|----------|
| `READ_COMMITTED` | Default, good for most operations |
| `REPEATABLE_READ` | Consistent reads within transaction |
| `SERIALIZABLE` | Financial operations, inventory management |

---

## 5. Data Migration Scripts

### Overview
Comprehensive migration script to update database schema with missing columns, constraints, and indexes.

### Files
- [`scripts/migrate-data-integrity.sql`](scripts/migrate-data-integrity.sql) - Main migration script

### What It Does

1. **Creates Missing Tables**
   - `property_tables` (product type categories)

2. **Adds Missing Columns**
   - Users: `email_verified`, `verification_token`, `reset_token`, `last_login`, `version`
   - Sessions: `last_activity`, `user_agent`, `ip_address`
   - Product Properties: `property_table_id`, `version`
   - Token Usage: `user_id`, `input_cost`, `output_cost`, `total_cost`
   - Manufacturer/Excluded Domains: `user_id`, `created_at`, `updated_at`, `version`
   - All tables: `version` column for optimistic locking

3. **Adds Foreign Key Constraints**
   - Sessions → Users (CASCADE DELETE)
   - Property Tables → Users (CASCADE DELETE)
   - Product Properties → Property Tables (CASCADE DELETE)
   - Token Usage → Users (SET NULL)
   - Manufacturer Domains → Users (CASCADE DELETE)
   - Excluded Domains → Users (CASCADE DELETE)
   - Search Results → Users (SET NULL)

4. **Creates Performance Indexes**
   - Users: email, username, role, verification_token, reset_token
   - Sessions: user_id, expires_at
   - Token Usage: user_id, created_at, model_provider
   - Search Results: user_id, created_at, article_number

5. **Adds Check Constraints**
   - Users: valid role values (admin, user, guest)
   - Token Usage: non-negative token counts
   - Product Properties: non-negative order_index

6. **Creates Auto-Update Triggers**
   - Automatically updates `updated_at` and `version` on UPDATE

### Running the Migration

```bash
# Run in staging first
psql -h $HOST -U $USER -d $DB_STAGING -f scripts/migrate-data-integrity.sql

# After testing, run in production
psql -h $HOST -U $USER -d $DB_PRODUCTION -f scripts/migrate-data-integrity.sql
```

### Safety Features

- All operations use `IF NOT EXISTS` or check for existing objects
- Wrapped in a transaction (COMMIT at end, rollback on error)
- Non-destructive - only adds, never removes

---

## 6. Referential Integrity

### Overview
Foreign key constraints ensure data consistency between related tables.

### Constraints Added

| Table | Column | References | On Delete |
|-------|--------|------------|-----------|
| `sessions` | `user_id` | `users.id` | CASCADE |
| `property_tables` | `user_id` | `users.id` | CASCADE |
| `product_properties` | `property_table_id` | `property_tables.id` | CASCADE |
| `token_usage` | `user_id` | `users.id` | SET NULL |
| `manufacturer_domains` | `user_id` | `users.id` | CASCADE |
| `excluded_domains` | `user_id` | `users.id` | CASCADE |
| `search_results` | `user_id` | `users.id` | SET NULL |

### Delete Behavior

- **CASCADE**: When user is deleted, their related records are also deleted
- **SET NULL**: When user is deleted, reference is set to NULL (preserves history)

### Schema Definition (Drizzle)

```typescript
// Example of referential integrity in schema.ts
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // ...
});
```

---

## 7. Concurrent Access

### Overview
Optimistic locking prevents lost updates when multiple users modify the same record.

### Files
- [`server/utils/optimisticLocking.ts`](server/utils/optimisticLocking.ts) - Optimistic locking utilities

### How It Works

1. Every table has a `version` column (integer, starting at 1)
2. When reading a record, include its version number
3. When updating, check that version hasn't changed
4. If version changed, throw `OptimisticLockError`
5. If version matches, update and increment version

### Usage

```typescript
import {
  updateWithOptimisticLock,
  OptimisticLockError,
  TableConfigs
} from './utils/optimisticLocking';

// Update a user with optimistic locking
try {
  const result = await updateWithOptimisticLock(
    TableConfigs.users,
    userId,
    expectedVersion, // Version from when you read the record
    { email: 'new@email.com' }
  );
  console.log('Updated successfully, new version:', result.newVersion);
} catch (error) {
  if (error instanceof OptimisticLockError) {
    // Another user modified this record
    console.log(error.getUserMessage());
    // "This record was modified by another user. Please refresh and try again."
  }
}

// With automatic retry
import { withOptimisticRetry } from './utils/optimisticLocking';

await withOptimisticRetry(
  3, // max retries
  async (userData) => {
    return updateWithOptimisticLock(
      TableConfigs.users,
      userId,
      userData.version,
      { loginCount: userData.loginCount + 1 }
    );
  },
  async () => getUserById(userId) // fetch latest
);
```

### Convenience Functions

```typescript
import {
  updateUserWithLock,
  updatePropertyTableWithLock,
  updateAppSettingsWithLock
} from './utils/optimisticLocking';

// Update user with locking
await updateUserWithLock(userId, expectedVersion, { email: 'new@email.com' });

// Update property table with locking
await updatePropertyTableWithLock(tableId, expectedVersion, { name: 'New Name' });
```

---

## 8. Quick Start Guide

### Step 1: Run the Migration

```bash
# Development/Staging
psql -h localhost -U postgres -d rowbooster_dev -f scripts/migrate-data-integrity.sql

# Production
psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB -f scripts/migrate-data-integrity.sql
```

### Step 2: Enable Automated Backups

Add to `server/index.ts`:

```typescript
import { initBackupScheduler } from './services/backupScheduler';

// In startup sequence
await initBackupScheduler();
```

### Step 3: Use Validation in Routes

```typescript
import { loginSchema } from '@shared/validation';

app.post('/api/auth/login', (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }
  // ... use result.data
});
```

### Step 4: Use Transactions for Critical Operations

```typescript
import { withTransaction } from './utils/transaction';

await withTransaction(async (ctx) => {
  // Critical multi-step operation
  await ctx.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [100, fromId]);
  await ctx.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [100, toId]);
});
```

### Step 5: Use Optimistic Locking for Updates

```typescript
import { updateWithOptimisticLock, TableConfigs } from './utils/optimisticLocking';

await updateWithOptimisticLock(
  TableConfigs.users,
  userId,
  currentVersion,
  { lastLogin: new Date() }
);
```

---

## Summary of Files Created/Modified

### New Files
| File | Purpose |
|------|---------|
| `scripts/database-backup.ts` | CLI backup utility |
| `server/services/backupScheduler.ts` | Automated backup scheduler |
| `shared/validation.ts` | Comprehensive Zod validation schemas |
| `server/middleware/errorHandler.ts` | Centralized error handling |
| `server/utils/transaction.ts` | Database transaction utilities |
| `server/utils/optimisticLocking.ts` | Optimistic concurrency control |
| `scripts/migrate-data-integrity.sql` | Database migration script |

### Modified Files
| File | Changes |
|------|---------|
| `server/index.ts` | Integrated error handler and request ID middleware |

---

## Testing Recommendations

1. **Backup/Restore**: Test backup creation and restoration in staging
2. **Validation**: Write unit tests for all validation schemas
3. **Transactions**: Test rollback behavior with intentional failures
4. **Optimistic Locking**: Test concurrent update scenarios
5. **Migration**: Run migration on a copy of production data first

---

## Monitoring

All data integrity features are integrated with the existing MonitoringLogger:

- Backup success/failure logged
- Validation errors logged
- Transaction failures logged
- Optimistic lock conflicts logged

View logs in the monitoring dashboard or database `console_logs` and `error_logs` tables.