/**
 * Secure API Key Manager
 *
 * Manages API keys for users with encryption at rest.
 * Keys are stored encrypted in the database using AES-256-GCM.
 *
 * Security features:
 * - AES-256-GCM encryption for all stored keys
 * - Keys never sent to client - only usage status
 * - Audit logging for all key operations
 * - Rate limiting on key operations
 *
 * GRACEFUL DEGRADATION:
 * - If secure vault is disabled, encrypted key storage is unavailable
 * - Users can still use environment-configured API keys
 */

import { pool } from '../db';
import { secureVault, encrypt, decrypt, isEncrypted, isVaultEnabled } from './secureVault';
import { secureLog } from '../utils/secureLogger';

export type ApiKeyType = 'openai' | 'valueserp';

interface ApiKeyStatus {
  hasKey: boolean;
  lastUpdated: Date | null;
  keyHint?: string; // First 4 and last 4 chars only, e.g., "sk-a...xyz1"
}

interface ApiKeyAuditEntry {
  userId: number;
  action: 'created' | 'updated' | 'deleted' | 'used';
  keyType: ApiKeyType;
  ipAddress?: string;
  userAgent?: string;
}

export class ApiKeyManager {
  private static instance: ApiKeyManager;
  private initialized: boolean = false;

  private constructor() {}

  static getInstance(): ApiKeyManager {
    if (!ApiKeyManager.instance) {
      ApiKeyManager.instance = new ApiKeyManager();
    }
    return ApiKeyManager.instance;
  }

  /**
   * Initialize the API key manager and ensure required columns/tables exist
   * This runs automatically during app startup - no manual migration needed!
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('[API-KEY-MANAGER] Starting database initialization...');

      // Add encrypted API key columns to users table
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_openai_key TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_valueserp_key TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS api_keys_updated_at TIMESTAMP;
      `);
      console.log('[API-KEY-MANAGER] ✅ User encrypted key columns ready');

      // Create indexes for API key columns
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_has_openai_key ON users ((encrypted_openai_key IS NOT NULL));
        CREATE INDEX IF NOT EXISTS idx_users_has_valueserp_key ON users ((encrypted_valueserp_key IS NOT NULL));
      `);

      // Create rate limiting table for persistent storage
      await pool.query(`
        CREATE TABLE IF NOT EXISTS rate_limits (
          id SERIAL PRIMARY KEY,
          identifier TEXT NOT NULL,
          endpoint TEXT NOT NULL,
          request_count INTEGER DEFAULT 1,
          window_start TIMESTAMP NOT NULL,
          blocked_until TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(identifier, endpoint)
        );
        CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits(identifier, endpoint);
        CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
      `);
      console.log('[API-KEY-MANAGER] ✅ Rate limits table ready');

      // Create API key audit log table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS api_key_audit_log (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          action TEXT NOT NULL,
          key_type TEXT NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_api_key_audit_user ON api_key_audit_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_api_key_audit_created ON api_key_audit_log(created_at);
      `);
      console.log('[API-KEY-MANAGER] ✅ API key audit log table ready');

      // Create secure tokens table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS secure_tokens (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          token_type TEXT NOT NULL,
          token_hash TEXT NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          used_at TIMESTAMP,
          ip_address TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(user_id, token_type)
        );
        CREATE INDEX IF NOT EXISTS idx_secure_tokens_user ON secure_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_secure_tokens_expires ON secure_tokens(expires_at);
        CREATE INDEX IF NOT EXISTS idx_secure_tokens_type ON secure_tokens(token_type);
      `);
      console.log('[API-KEY-MANAGER] ✅ Secure tokens table ready');

      this.initialized = true;
      console.log('[API-KEY-MANAGER] ✅ Database initialization complete!');
      secureLog.info('[API-KEY-MANAGER] Initialized successfully');
    } catch (error) {
      secureLog.error('[API-KEY-MANAGER] Failed to initialize:', error);
      // Don't throw - allow app to continue even if some migration fails
      // The tables might already exist or have slightly different schema
      console.warn('[API-KEY-MANAGER] ⚠️ Some initialization steps may have failed, but app will continue');
      this.initialized = true; // Mark as initialized to prevent retry loops
    }
  }

  /**
   * Check if secure key storage is available
   */
  isSecureStorageAvailable(): boolean {
    return isVaultEnabled();
  }

  /**
   * Store an encrypted API key for a user
   * @throws Error if vault is disabled
   */
  async storeKey(
    userId: number,
    keyType: ApiKeyType,
    apiKey: string,
    auditInfo?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    await this.initialize();

    // Check if vault is available
    if (!isVaultEnabled()) {
      throw new Error(
        'Secure key storage is not available. Please configure SESSION_SECRET in environment variables. ' +
        'Generate one using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }

    if (!apiKey || apiKey.trim() === '') {
      throw new Error('API key cannot be empty');
    }

    // Validate key format
    if (keyType === 'openai' && !apiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format');
    }

    // Encrypt the key
    const encryptedKey = encrypt(apiKey);

    const columnName = keyType === 'openai' ? 'encrypted_openai_key' : 'encrypted_valueserp_key';

    try {
      await pool.query(
        `UPDATE users SET ${columnName} = $1, api_keys_updated_at = NOW() WHERE id = $2`,
        [encryptedKey, userId]
      );

      // Log the action
      await this.logAudit({
        userId,
        action: 'created',
        keyType,
        ipAddress: auditInfo?.ipAddress,
        userAgent: auditInfo?.userAgent,
      });

      secureLog.info('[API-KEY-MANAGER] API key stored', {
        userId,
        keyType,
        action: 'stored',
      });
    } catch (error) {
      secureLog.error('[API-KEY-MANAGER] Failed to store key:', error);
      throw new Error('Failed to store API key');
    }
  }

  /**
   * Retrieve and decrypt an API key for a user
   * This should only be called server-side when making API calls
   */
  async getKey(userId: number, keyType: ApiKeyType): Promise<string | null> {
    await this.initialize();

    // If vault is not enabled, we can't decrypt stored keys
    if (!isVaultEnabled()) {
      secureLog.debug('[API-KEY-MANAGER] Vault disabled, cannot retrieve encrypted keys');
      return null;
    }

    const columnName = keyType === 'openai' ? 'encrypted_openai_key' : 'encrypted_valueserp_key';

    try {
      const result = await pool.query(
        `SELECT ${columnName} as encrypted_key FROM users WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0 || !result.rows[0].encrypted_key) {
        return null;
      }

      const encryptedKey = result.rows[0].encrypted_key;

      // Handle legacy unencrypted keys (migration support)
      if (!isEncrypted(encryptedKey)) {
        // This is a plaintext key - encrypt it for future use if vault is available
        secureLog.warn('[API-KEY-MANAGER] Found unencrypted key, migrating', { userId, keyType });
        try {
          const newEncrypted = encrypt(encryptedKey);
          await pool.query(
            `UPDATE users SET ${columnName} = $1 WHERE id = $2`,
            [newEncrypted, userId]
          );
        } catch (e) {
          // Migration failed, but we can still return the key
          secureLog.warn('[API-KEY-MANAGER] Migration failed, returning plaintext key');
        }
        return encryptedKey;
      }

      return decrypt(encryptedKey);
    } catch (error) {
      secureLog.error('[API-KEY-MANAGER] Failed to retrieve key:', error);
      return null;
    }
  }

  /**
   * Get simplified key status for client (without exposing the key)
   */
  async getKeyStatus(userId: number, keyType: ApiKeyType): Promise<ApiKeyStatus & { vaultEnabled?: boolean }> {
    await this.initialize();

    // Include vault status in response
    const vaultEnabled = isVaultEnabled();

    const columnName = keyType === 'openai' ? 'encrypted_openai_key' : 'encrypted_valueserp_key';

    try {
      const result = await pool.query(
        `SELECT ${columnName} as encrypted_key, api_keys_updated_at FROM users WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0 || !result.rows[0].encrypted_key) {
        return {
          hasKey: false,
          lastUpdated: null,
          vaultEnabled,
        };
      }

      // Get the actual key to create hint (only if vault is enabled)
      let keyHint: string | undefined;
      if (vaultEnabled) {
        const key = await this.getKey(userId, keyType);
        if (key && key.length > 8) {
          keyHint = `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
        }
      }

      return {
        hasKey: !!result.rows[0].encrypted_key,
        lastUpdated: result.rows[0].api_keys_updated_at ? new Date(result.rows[0].api_keys_updated_at) : null,
        keyHint,
        vaultEnabled,
      };
    } catch (error) {
      secureLog.error('[API-KEY-MANAGER] Failed to get key status:', error);
      return {
        hasKey: false,
        lastUpdated: null,
        vaultEnabled,
      };
    }
  }

  /**
   * Delete an API key for a user
   */
  async deleteKey(
    userId: number,
    keyType: ApiKeyType,
    auditInfo?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    await this.initialize();

    const columnName = keyType === 'openai' ? 'encrypted_openai_key' : 'encrypted_valueserp_key';

    try {
      await pool.query(
        `UPDATE users SET ${columnName} = NULL, api_keys_updated_at = NOW() WHERE id = $1`,
        [userId]
      );

      await this.logAudit({
        userId,
        action: 'deleted',
        keyType,
        ipAddress: auditInfo?.ipAddress,
        userAgent: auditInfo?.userAgent,
      });

      secureLog.info('[API-KEY-MANAGER] API key deleted', { userId, keyType });
    } catch (error) {
      secureLog.error('[API-KEY-MANAGER] Failed to delete key:', error);
      throw new Error('Failed to delete API key');
    }
  }

  /**
   * Check if an API key is valid by making a test request
   */
  async validateKey(keyType: ApiKeyType, apiKey: string): Promise<{ valid: boolean; error?: string }> {
    if (!apiKey || apiKey.trim() === '') {
      return { valid: false, error: 'API key is empty' };
    }

    try {
      if (keyType === 'openai') {
        // Make a minimal OpenAI API request to validate the key
        const response = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (response.status === 401) {
          return { valid: false, error: 'Invalid API key' };
        }

        if (response.status === 429) {
          return { valid: false, error: 'Rate limited - key may be valid but over quota' };
        }

        return { valid: response.ok };
      }

      if (keyType === 'valueserp') {
        // Make a minimal ValueSERP API request to validate the key
        const response = await fetch(`https://api.valueserp.com/search?api_key=${apiKey}&q=test&num=1`);
        
        if (response.status === 401 || response.status === 403) {
          return { valid: false, error: 'Invalid API key' };
        }

        return { valid: response.ok };
      }

      return { valid: false, error: 'Unknown key type' };
    } catch (error) {
      secureLog.error('[API-KEY-MANAGER] Key validation failed:', error);
      return { valid: false, error: 'Validation request failed' };
    }
  }

  /**
   * Log an audit entry for key operations
   */
  private async logAudit(entry: ApiKeyAuditEntry): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO api_key_audit_log (user_id, action, key_type, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [entry.userId, entry.action, entry.keyType, entry.ipAddress, entry.userAgent]
      );
    } catch (error) {
      secureLog.error('[API-KEY-MANAGER] Failed to log audit entry:', error);
    }
  }

  /**
   * Get audit log for a user
   */
  async getAuditLog(userId: number, limit: number = 50): Promise<any[]> {
    try {
      const result = await pool.query(
        `SELECT action, key_type, ip_address, created_at
         FROM api_key_audit_log
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows.map(row => ({
        action: row.action,
        keyType: row.key_type,
        ipAddress: row.ip_address ? row.ip_address.substring(0, 10) + '...' : null,
        createdAt: row.created_at,
      }));
    } catch (error) {
      secureLog.error('[API-KEY-MANAGER] Failed to get audit log:', error);
      return [];
    }
  }

  /**
   * Get the best available API key (user's key or fallback to environment)
   */
  async getEffectiveKey(userId: number | null, keyType: ApiKeyType): Promise<string | null> {
    // Try user's key first (only if vault is enabled)
    if (userId && isVaultEnabled()) {
      try {
        const userKey = await this.getKey(userId, keyType);
        if (userKey) {
          return userKey;
        }
      } catch (error) {
        secureLog.warn('[API-KEY-MANAGER] Failed to get user key, falling back to env', { userId, keyType });
      }
    }

    // Fallback to environment variable
    const envKey = keyType === 'openai'
      ? process.env.OPENAI_API_KEY
      : process.env.VALUESERP_API_KEY;

    return envKey || null;
  }

  /**
   * Get vault status for client display
   */
  getVaultStatus(): { enabled: boolean; message?: string } {
    if (isVaultEnabled()) {
      return { enabled: true };
    }
    return {
      enabled: false,
      message: 'Secure key storage is disabled. Configure SESSION_SECRET to enable encrypted API key storage.'
    };
  }
}

// Export singleton instance
export const apiKeyManager = ApiKeyManager.getInstance();