/**
 * Optimistic Locking Utility
 * 
 * Implements optimistic concurrency control using version columns.
 * This prevents lost updates when multiple users try to modify the same record.
 * 
 * How it works:
 * 1. When reading a record, include its version number
 * 2. When updating, check that the version hasn't changed
 * 3. If version changed, another user modified the record - reject the update
 * 4. If version is the same, update and increment the version
 */

import { pool } from '../db';
import { PoolClient, QueryResult } from 'pg';

// ===========================================
// TYPES & INTERFACES
// ===========================================

/**
 * Error thrown when optimistic lock fails (version mismatch)
 */
export class OptimisticLockError extends Error {
  public readonly tableName: string;
  public readonly recordId: number | string;
  public readonly expectedVersion: number;
  public readonly actualVersion: number | null;
  
  constructor(
    tableName: string,
    recordId: number | string,
    expectedVersion: number,
    actualVersion: number | null
  ) {
    const message = actualVersion === null
      ? `Record not found: ${tableName}[${recordId}]`
      : `Optimistic lock failed for ${tableName}[${recordId}]: expected version ${expectedVersion}, found ${actualVersion}. Another user modified this record.`;
    
    super(message);
    this.name = 'OptimisticLockError';
    this.tableName = tableName;
    this.recordId = recordId;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
    
    // Maintains proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OptimisticLockError);
    }
  }
  
  /**
   * Check if this error is a "not found" error vs actual version conflict
   */
  isNotFound(): boolean {
    return this.actualVersion === null;
  }
  
  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    if (this.isNotFound()) {
      return 'The record you are trying to update no longer exists.';
    }
    return 'This record was modified by another user. Please refresh and try again.';
  }
}

/**
 * Configuration for optimistic locking operations
 */
export interface OptimisticLockConfig {
  tableName: string;
  idColumn?: string; // Default: 'id'
  versionColumn?: string; // Default: 'version'
}

/**
 * Update result with version information
 */
export interface VersionedUpdateResult<T = any> {
  success: boolean;
  data: T | null;
  newVersion: number;
  rowsAffected: number;
}

// ===========================================
// CORE FUNCTIONS
// ===========================================

/**
 * Get current version of a record
 */
export async function getCurrentVersion(
  config: OptimisticLockConfig,
  id: number | string,
  client?: PoolClient
): Promise<number | null> {
  const { tableName, idColumn = 'id', versionColumn = 'version' } = config;
  
  const sql = `SELECT "${versionColumn}" FROM "${tableName}" WHERE "${idColumn}" = $1`;
  
  const result = client
    ? await client.query(sql, [id])
    : await pool.query(sql, [id]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return result.rows[0][versionColumn];
}

/**
 * Update a record with optimistic locking
 * 
 * @param config - Table configuration
 * @param id - Record ID
 * @param expectedVersion - The version the client expects (from when they read the record)
 * @param updates - Column updates as key-value pairs
 * @param client - Optional database client for transaction support
 * @throws OptimisticLockError if version doesn't match
 */
export async function updateWithOptimisticLock<T = any>(
  config: OptimisticLockConfig,
  id: number | string,
  expectedVersion: number,
  updates: Record<string, any>,
  client?: PoolClient
): Promise<VersionedUpdateResult<T>> {
  const { tableName, idColumn = 'id', versionColumn = 'version' } = config;
  
  // Build SET clause - exclude version as it's handled separately
  const updateKeys = Object.keys(updates).filter(k => k !== versionColumn && k !== idColumn);
  if (updateKeys.length === 0) {
    throw new Error('No fields to update');
  }
  
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  for (const key of updateKeys) {
    setClauses.push(`"${key}" = $${paramIndex}`);
    values.push(updates[key]);
    paramIndex++;
  }
  
  // Add version increment
  setClauses.push(`"${versionColumn}" = "${versionColumn}" + 1`);
  
  // Add updated_at if table has it
  setClauses.push(`"updated_at" = NOW()`);
  
  // Add parameters for WHERE clause
  values.push(id); // $paramIndex = id
  const idParamIndex = paramIndex++;
  
  values.push(expectedVersion); // $paramIndex = expected version
  const versionParamIndex = paramIndex;
  
  const sql = `
    UPDATE "${tableName}"
    SET ${setClauses.join(', ')}
    WHERE "${idColumn}" = $${idParamIndex} AND "${versionColumn}" = $${versionParamIndex}
    RETURNING *
  `;
  
  const result = client
    ? await client.query(sql, values)
    : await pool.query(sql, values);
  
  if (result.rowCount === 0) {
    // Check if record exists to give better error message
    const currentVersion = await getCurrentVersion(config, id, client);
    throw new OptimisticLockError(tableName, id, expectedVersion, currentVersion);
  }
  
  return {
    success: true,
    data: result.rows[0] as T,
    newVersion: result.rows[0][versionColumn],
    rowsAffected: result.rowCount || 0,
  };
}

/**
 * Delete a record with optimistic locking
 * Ensures you can only delete the exact version you intended to
 */
export async function deleteWithOptimisticLock(
  config: OptimisticLockConfig,
  id: number | string,
  expectedVersion: number,
  client?: PoolClient
): Promise<{ success: boolean; rowsAffected: number }> {
  const { tableName, idColumn = 'id', versionColumn = 'version' } = config;
  
  const sql = `
    DELETE FROM "${tableName}"
    WHERE "${idColumn}" = $1 AND "${versionColumn}" = $2
  `;
  
  const result = client
    ? await client.query(sql, [id, expectedVersion])
    : await pool.query(sql, [id, expectedVersion]);
  
  if (result.rowCount === 0) {
    const currentVersion = await getCurrentVersion(config, id, client);
    throw new OptimisticLockError(tableName, id, expectedVersion, currentVersion);
  }
  
  return {
    success: true,
    rowsAffected: result.rowCount || 0,
  };
}

// ===========================================
// BATCH OPERATIONS
// ===========================================

/**
 * Batch update with optimistic locking
 * Updates multiple records atomically - fails if any version check fails
 */
export async function batchUpdateWithOptimisticLock<T = any>(
  updates: Array<{
    config: OptimisticLockConfig;
    id: number | string;
    expectedVersion: number;
    updates: Record<string, any>;
  }>,
  client?: PoolClient
): Promise<Array<VersionedUpdateResult<T>>> {
  const shouldReleaseClient = !client;
  const dbClient = client || await pool.connect();
  
  try {
    if (shouldReleaseClient) {
      await dbClient.query('BEGIN');
    }
    
    const results: Array<VersionedUpdateResult<T>> = [];
    
    for (const update of updates) {
      const result = await updateWithOptimisticLock<T>(
        update.config,
        update.id,
        update.expectedVersion,
        update.updates,
        dbClient
      );
      results.push(result);
    }
    
    if (shouldReleaseClient) {
      await dbClient.query('COMMIT');
    }
    
    return results;
  } catch (error) {
    if (shouldReleaseClient) {
      await dbClient.query('ROLLBACK');
    }
    throw error;
  } finally {
    if (shouldReleaseClient) {
      dbClient.release();
    }
  }
}

// ===========================================
// RETRY HELPERS
// ===========================================

/**
 * Retry an operation with optimistic locking on version conflicts
 * 
 * @param maxRetries - Maximum number of retry attempts
 * @param operation - Function that performs the versioned operation
 * @param fetchLatest - Function to fetch the latest version of data
 */
export async function withOptimisticRetry<T>(
  maxRetries: number,
  operation: (data: T) => Promise<any>,
  fetchLatest: () => Promise<T>
): Promise<any> {
  let attempts = 0;
  let lastError: Error | null = null;
  
  while (attempts < maxRetries) {
    try {
      const latestData = await fetchLatest();
      return await operation(latestData);
    } catch (error) {
      if (error instanceof OptimisticLockError && !error.isNotFound()) {
        attempts++;
        lastError = error;
        // Small delay before retry to reduce contention
        await new Promise(resolve => setTimeout(resolve, 50 * attempts));
        continue;
      }
      throw error;
    }
  }
  
  throw lastError || new Error('Optimistic retry failed');
}

// ===========================================
// TABLE-SPECIFIC CONFIGURATIONS
// ===========================================

/**
 * Pre-configured optimistic lock settings for each table
 */
export const TableConfigs = {
  users: {
    tableName: 'users',
    idColumn: 'id',
    versionColumn: 'version',
  } as OptimisticLockConfig,
  
  propertyTables: {
    tableName: 'property_tables',
    idColumn: 'id',
    versionColumn: 'version',
  } as OptimisticLockConfig,
  
  productProperties: {
    tableName: 'product_properties',
    idColumn: 'id',
    versionColumn: 'version',
  } as OptimisticLockConfig,
  
  manufacturerDomains: {
    tableName: 'manufacturer_domains',
    idColumn: 'id',
    versionColumn: 'version',
  } as OptimisticLockConfig,
  
  excludedDomains: {
    tableName: 'excluded_domains',
    idColumn: 'id',
    versionColumn: 'version',
  } as OptimisticLockConfig,
  
  appSettings: {
    tableName: 'app_settings',
    idColumn: 'id',
    versionColumn: 'version',
  } as OptimisticLockConfig,
  
  searchResults: {
    tableName: 'search_results',
    idColumn: 'id',
    versionColumn: 'version',
  } as OptimisticLockConfig,
};

// ===========================================
// CONVENIENCE WRAPPERS
// ===========================================

/**
 * Update a user with optimistic locking
 */
export async function updateUserWithLock(
  userId: number,
  expectedVersion: number,
  updates: Record<string, any>,
  client?: PoolClient
) {
  return updateWithOptimisticLock(TableConfigs.users, userId, expectedVersion, updates, client);
}

/**
 * Update a property table with optimistic locking
 */
export async function updatePropertyTableWithLock(
  tableId: number,
  expectedVersion: number,
  updates: Record<string, any>,
  client?: PoolClient
) {
  return updateWithOptimisticLock(TableConfigs.propertyTables, tableId, expectedVersion, updates, client);
}

/**
 * Update product properties with optimistic locking
 */
export async function updateProductPropertyWithLock(
  propertyId: number,
  expectedVersion: number,
  updates: Record<string, any>,
  client?: PoolClient
) {
  return updateWithOptimisticLock(TableConfigs.productProperties, propertyId, expectedVersion, updates, client);
}

/**
 * Update manufacturer domain with optimistic locking
 */
export async function updateManufacturerDomainWithLock(
  domainId: number,
  expectedVersion: number,
  updates: Record<string, any>,
  client?: PoolClient
) {
  return updateWithOptimisticLock(TableConfigs.manufacturerDomains, domainId, expectedVersion, updates, client);
}

/**
 * Update excluded domain with optimistic locking
 */
export async function updateExcludedDomainWithLock(
  domainId: number,
  expectedVersion: number,
  updates: Record<string, any>,
  client?: PoolClient
) {
  return updateWithOptimisticLock(TableConfigs.excludedDomains, domainId, expectedVersion, updates, client);
}

/**
 * Update app settings with optimistic locking
 */
export async function updateAppSettingsWithLock(
  settingsId: number,
  expectedVersion: number,
  updates: Record<string, any>,
  client?: PoolClient
) {
  return updateWithOptimisticLock(TableConfigs.appSettings, settingsId, expectedVersion, updates, client);
}