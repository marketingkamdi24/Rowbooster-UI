/**
 * Database Transaction Management Utility
 * 
 * Provides:
 * - Transaction wrapper for multiple operations
 * - Automatic rollback on errors
 * - Transaction isolation levels
 * - Savepoints for nested transactions
 * - Retry logic for transient failures
 */

import { Pool, PoolClient } from 'pg';
import { pool } from '../db';

// ===========================================
// TRANSACTION ISOLATION LEVELS
// ===========================================

export enum IsolationLevel {
  /**
   * Read Committed - Default, good for most operations
   * Each statement sees only committed data at the time it executes
   */
  READ_COMMITTED = 'READ COMMITTED',
  
  /**
   * Repeatable Read - Good for reports that need consistent snapshot
   * All statements in transaction see the same snapshot
   */
  REPEATABLE_READ = 'REPEATABLE READ',
  
  /**
   * Serializable - Highest isolation, prevents phantom reads
   * Use for critical financial or inventory operations
   */
  SERIALIZABLE = 'SERIALIZABLE',
}

// ===========================================
// TRANSACTION OPTIONS
// ===========================================

export interface TransactionOptions {
  /**
   * Isolation level for the transaction
   */
  isolationLevel?: IsolationLevel;
  
  /**
   * Whether this is a read-only transaction (optimization hint)
   */
  readOnly?: boolean;
  
  /**
   * Number of retry attempts for transient failures
   */
  retryAttempts?: number;
  
  /**
   * Delay between retry attempts in milliseconds
   */
  retryDelay?: number;
  
  /**
   * Timeout for the entire transaction in milliseconds
   */
  timeout?: number;
}

// ===========================================
// TRANSACTION CONTEXT
// ===========================================

export interface TransactionContext {
  /**
   * The database client for this transaction
   */
  client: PoolClient;
  
  /**
   * Execute a query within the transaction
   */
  query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }>;
  
  /**
   * Create a savepoint for nested operations
   */
  savepoint: (name: string) => Promise<void>;
  
  /**
   * Rollback to a savepoint
   */
  rollbackToSavepoint: (name: string) => Promise<void>;
  
  /**
   * Release a savepoint (commit nested operation)
   */
  releaseSavepoint: (name: string) => Promise<void>;
  
  /**
   * Check if transaction is still active
   */
  isActive: () => boolean;
}

// ===========================================
// TRANSIENT ERROR DETECTION
// ===========================================

/**
 * Check if an error is transient and can be retried
 */
function isTransientError(error: any): boolean {
  // PostgreSQL error codes that are retryable
  const transientCodes = [
    '40001', // Serialization failure
    '40P01', // Deadlock detected
    '57P01', // Admin shutdown
    '57P02', // Crash shutdown
    '57P03', // Cannot connect now
    '08000', // Connection exception
    '08003', // Connection does not exist
    '08006', // Connection failure
    '08001', // SQL client unable to establish connection
    '08004', // SQL server rejected connection
  ];
  
  return transientCodes.includes(error.code);
}

// ===========================================
// MAIN TRANSACTION FUNCTION
// ===========================================

/**
 * Execute a function within a database transaction
 * 
 * @param fn - The function to execute within the transaction
 * @param options - Transaction options
 * @returns The result of the function
 * 
 * @example
 * const result = await withTransaction(async (ctx) => {
 *   await ctx.query('INSERT INTO users ...');
 *   await ctx.query('INSERT INTO profiles ...');
 *   return { success: true };
 * });
 */
export async function withTransaction<T>(
  fn: (ctx: TransactionContext) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const {
    isolationLevel = IsolationLevel.READ_COMMITTED,
    readOnly = false,
    retryAttempts = 3,
    retryDelay = 100,
    timeout,
  } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    const client = await pool.connect();
    let transactionActive = true;
    
    try {
      // Set statement timeout if specified
      if (timeout) {
        await client.query(`SET LOCAL statement_timeout = ${timeout}`);
      }
      
      // Start transaction with isolation level
      await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}${readOnly ? ' READ ONLY' : ''}`);
      
      // Create transaction context
      const ctx: TransactionContext = {
        client,
        
        query: async (sql: string, params?: any[]) => {
          if (!transactionActive) {
            throw new Error('Transaction is no longer active');
          }
          const result = await client.query(sql, params);
          return { rows: result.rows, rowCount: result.rowCount };
        },
        
        savepoint: async (name: string) => {
          if (!transactionActive) {
            throw new Error('Transaction is no longer active');
          }
          await client.query(`SAVEPOINT ${sanitizeSavepointName(name)}`);
        },
        
        rollbackToSavepoint: async (name: string) => {
          if (!transactionActive) {
            throw new Error('Transaction is no longer active');
          }
          await client.query(`ROLLBACK TO SAVEPOINT ${sanitizeSavepointName(name)}`);
        },
        
        releaseSavepoint: async (name: string) => {
          if (!transactionActive) {
            throw new Error('Transaction is no longer active');
          }
          await client.query(`RELEASE SAVEPOINT ${sanitizeSavepointName(name)}`);
        },
        
        isActive: () => transactionActive,
      };
      
      // Execute the transaction function
      const result = await fn(ctx);
      
      // Commit transaction
      await client.query('COMMIT');
      transactionActive = false;
      
      return result;
      
    } catch (error: any) {
      // Rollback transaction
      transactionActive = false;
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('[TRANSACTION] Rollback failed:', rollbackError);
      }
      
      lastError = error;
      
      // Check if we should retry
      if (isTransientError(error) && attempt < retryAttempts) {
        console.warn(`[TRANSACTION] Transient error (${error.code}), retrying attempt ${attempt + 1}/${retryAttempts}...`);
        await sleep(retryDelay * Math.pow(2, attempt)); // Exponential backoff
        continue;
      }
      
      throw error;
      
    } finally {
      client.release();
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Transaction failed after all retries');
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Sanitize savepoint name to prevent SQL injection
 */
function sanitizeSavepointName(name: string): string {
  // Only allow alphanumeric and underscores
  return name.replace(/[^a-zA-Z0-9_]/g, '');
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===========================================
// CONVENIENCE WRAPPERS
// ===========================================

/**
 * Execute a single query with automatic transaction handling
 * Useful for single operations that need transaction semantics
 */
export async function withSingleQueryTransaction(
  sql: string,
  params?: any[],
  options?: TransactionOptions
): Promise<{ rows: any[]; rowCount: number | null }> {
  return withTransaction(async (ctx) => {
    return ctx.query(sql, params);
  }, options);
}

/**
 * Execute multiple queries in a transaction
 * Useful for simple multi-statement operations
 */
export async function withMultiQueryTransaction(
  queries: Array<{ sql: string; params?: any[] }>,
  options?: TransactionOptions
): Promise<Array<{ rows: any[]; rowCount: number | null }>> {
  return withTransaction(async (ctx) => {
    const results = [];
    for (const query of queries) {
      results.push(await ctx.query(query.sql, query.params));
    }
    return results;
  }, options);
}

/**
 * Execute a critical operation with serializable isolation
 * Use for operations that must be completely isolated
 */
export async function withSerializableTransaction<T>(
  fn: (ctx: TransactionContext) => Promise<T>,
  options?: Omit<TransactionOptions, 'isolationLevel'>
): Promise<T> {
  return withTransaction(fn, {
    ...options,
    isolationLevel: IsolationLevel.SERIALIZABLE,
    retryAttempts: 5, // More retries for serializable
  });
}

/**
 * Execute a read-only transaction
 * Optimized for queries that don't modify data
 */
export async function withReadOnlyTransaction<T>(
  fn: (ctx: TransactionContext) => Promise<T>,
  options?: Omit<TransactionOptions, 'readOnly'>
): Promise<T> {
  return withTransaction(fn, {
    ...options,
    readOnly: true,
    isolationLevel: IsolationLevel.REPEATABLE_READ,
  });
}

// ===========================================
// TRANSACTION DECORATOR
// ===========================================

/**
 * Decorator for methods that should run in a transaction
 * Note: This requires the class to have a 'pool' or 'db' property
 * 
 * @example
 * class UserService {
 *   @Transactional({ isolationLevel: IsolationLevel.SERIALIZABLE })
 *   async createUserWithProfile(userData: any) {
 *     // This method runs in a transaction
 *   }
 * }
 */
export function Transactional(options?: TransactionOptions) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      return withTransaction(async (ctx) => {
        // Make the transaction context available in the method
        (this as any).__transactionContext = ctx;
        try {
          return await originalMethod.apply(this, args);
        } finally {
          delete (this as any).__transactionContext;
        }
      }, options);
    };
    
    return descriptor;
  };
}

// ===========================================
// BATCH OPERATION HELPERS
// ===========================================

/**
 * Execute batch inserts efficiently within a transaction
 */
export async function batchInsert<T extends Record<string, any>>(
  tableName: string,
  records: T[],
  options?: TransactionOptions & { batchSize?: number }
): Promise<number> {
  if (records.length === 0) return 0;
  
  const batchSize = options?.batchSize || 100;
  
  return withTransaction(async (ctx) => {
    let totalInserted = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const columns = Object.keys(batch[0]);
      
      // Build parameterized query
      const values: any[] = [];
      const valuePlaceholders: string[] = [];
      
      batch.forEach((record, rowIndex) => {
        const rowPlaceholders: string[] = [];
        columns.forEach((col, colIndex) => {
          const paramIndex = rowIndex * columns.length + colIndex + 1;
          rowPlaceholders.push(`$${paramIndex}`);
          values.push(record[col]);
        });
        valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
      });
      
      const sql = `
        INSERT INTO ${tableName} (${columns.join(', ')})
        VALUES ${valuePlaceholders.join(', ')}
      `;
      
      const result = await ctx.query(sql, values);
      totalInserted += result.rowCount || 0;
    }
    
    return totalInserted;
  }, options);
}

/**
 * Execute batch updates efficiently within a transaction
 */
export async function batchUpdate<T extends Record<string, any>>(
  tableName: string,
  records: Array<T & { id: number }>,
  options?: TransactionOptions
): Promise<number> {
  if (records.length === 0) return 0;
  
  return withTransaction(async (ctx) => {
    let totalUpdated = 0;
    
    for (const record of records) {
      const { id, ...updates } = record;
      const columns = Object.keys(updates);
      
      if (columns.length === 0) continue;
      
      const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
      const values = [...Object.values(updates), id];
      
      const sql = `UPDATE ${tableName} SET ${setClause} WHERE id = $${values.length}`;
      const result = await ctx.query(sql, values);
      totalUpdated += result.rowCount || 0;
    }
    
    return totalUpdated;
  }, options);
}