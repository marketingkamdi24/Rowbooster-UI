/**
 * Secure Vault Service
 * 
 * Provides AES-256-GCM encryption for storing sensitive credentials at rest.
 * This service ensures that API keys and other secrets are never stored in plaintext.
 * 
 * Security Features:
 * - AES-256-GCM authenticated encryption
 * - Unique IV (Initialization Vector) for each encryption
 * - HMAC authentication tag to detect tampering
 * - Key derivation from ENCRYPTION_KEY environment variable
 * - Secure random generation using crypto module
 * 
 * GRACEFUL DEGRADATION:
 * - If no encryption key is configured, the vault operates in "disabled" mode
 * - In disabled mode, the app still works but secure API key storage is unavailable
 * - A warning is logged at startup when vault is disabled
 */

import crypto from 'crypto';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits - recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

// Track vault state
let vaultEnabled = false;
let vaultInitialized = false;
let encryptionKeyCache: Buffer | null = null;

/**
 * Try to derive encryption key from environment variable
 * Returns null if no key is configured (graceful degradation)
 */
function tryGetEncryptionKey(): Buffer | null {
  if (encryptionKeyCache) {
    return encryptionKeyCache;
  }

  const envKey = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
  
  if (!envKey || envKey === 'CHANGE_THIS_TO_A_SECURE_RANDOM_VALUE_AT_LEAST_64_CHARS') {
    return null;
  }
  
  try {
    // If the key is already 64 hex characters (32 bytes), use it directly
    if (/^[a-f0-9]{64}$/i.test(envKey)) {
      encryptionKeyCache = Buffer.from(envKey, 'hex');
    } else {
      // Otherwise, derive a key using PBKDF2
      // Using a fixed salt is acceptable here since we're deriving from a secret key
      const salt = Buffer.from('rowbooster-secure-vault-v1', 'utf8');
      encryptionKeyCache = crypto.pbkdf2Sync(envKey, salt, 100000, KEY_LENGTH, 'sha256');
    }
    return encryptionKeyCache;
  } catch (error) {
    console.error('[SECURE-VAULT] Error deriving encryption key:', error);
    return null;
  }
}

/**
 * Get encryption key - throws if not available
 * Use this for operations that require encryption
 */
function getEncryptionKey(): Buffer {
  const key = tryGetEncryptionKey();
  if (!key) {
    throw new Error(
      'Secure vault is not available. Configure ENCRYPTION_KEY or SESSION_SECRET environment variable. ' +
      'Generate one using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return key;
}

/**
 * Check if the vault is enabled and ready to use
 */
export function isVaultEnabled(): boolean {
  return tryGetEncryptionKey() !== null;
}

/**
 * Encrypted data format:
 * [IV (12 bytes)] + [Auth Tag (16 bytes)] + [Ciphertext]
 * Total overhead: 28 bytes
 */
interface EncryptedData {
  iv: string;      // Base64 encoded
  tag: string;     // Base64 encoded auth tag
  data: string;    // Base64 encoded ciphertext
  version: number; // Schema version for future migrations
}

/**
 * Encrypt sensitive data using AES-256-GCM
 * 
 * @param plaintext - The data to encrypt
 * @returns JSON string containing encrypted data, IV, and auth tag
 * @throws Error if vault is not enabled or encryption fails
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty or null data');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  const encryptedData: EncryptedData = {
    iv: iv.toString('base64'),
    tag: authTag.toString('base64'),
    data: encrypted.toString('base64'),
    version: 1,
  };
  
  return JSON.stringify(encryptedData);
}

/**
 * Decrypt data that was encrypted with encrypt()
 * 
 * @param encryptedJson - JSON string from encrypt()
 * @returns Original plaintext data
 * @throws Error if decryption fails (tampered data or wrong key)
 */
export function decrypt(encryptedJson: string): string {
  if (!encryptedJson) {
    throw new Error('Cannot decrypt empty or null data');
  }

  let encryptedData: EncryptedData;
  try {
    encryptedData = JSON.parse(encryptedJson);
  } catch {
    throw new Error('Invalid encrypted data format');
  }
  
  if (!encryptedData.iv || !encryptedData.tag || !encryptedData.data) {
    throw new Error('Malformed encrypted data: missing required fields');
  }
  
  const key = getEncryptionKey();
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const authTag = Buffer.from(encryptedData.tag, 'base64');
  const ciphertext = Buffer.from(encryptedData.data, 'base64');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  decipher.setAuthTag(authTag);
  
  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error('Decryption failed: data may be tampered or key is incorrect');
  }
}

/**
 * Check if a string is encrypted data from this vault
 */
export function isEncrypted(data: string): boolean {
  if (!data) return false;
  
  try {
    const parsed = JSON.parse(data);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      'iv' in parsed &&
      'tag' in parsed &&
      'data' in parsed &&
      'version' in parsed
    );
  } catch {
    return false;
  }
}

/**
 * Secure Vault Service for managing encrypted credentials
 * 
 * This class uses lazy initialization - it won't throw on inst-antiation
 * even if the encryption key is not configured, allowing the app to start.
 */
export class SecureVault {
  private static instance: SecureVault;
  private enabled: boolean;
  
  private constructor() {
    // Check if vault can be enabled - but don't throw if not
    this.enabled = tryGetEncryptionKey() !== null;
    
    if (this.enabled) {
      console.log('[SECURE-VAULT] Initialized with AES-256-GCM encryption');
    } else {
      console.warn(
        '[SECURE-VAULT] WARNING: Vault is DISABLED - no encryption key configured.\n' +
        '  Secure API key storage will not be available.\n' +
        '  To enable, set SESSION_SECRET in your .env file:\n' +
        '  Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }
  }
  
  static getInstance(): SecureVault {
    if (!SecureVault.instance) {
      SecureVault.instance = new SecureVault();
    }
    return SecureVault.instance;
  }
  
  /**
   * Check if the vault is enabled and ready to use
   */
  isEnabled(): boolean {
    return this.enabled;
  }
  
  /**
   * Encrypt and store an API key
   * @throws Error if vault is not enabled
   */
  encryptApiKey(apiKey: string): string {
    if (!this.enabled) {
      throw new Error('Secure vault is disabled. Configure SESSION_SECRET to enable encryption.');
    }
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Cannot encrypt empty API key');
    }
    return encrypt(apiKey);
  }
  
  /**
   * Decrypt an API key
   * @throws Error if vault is not enabled
   */
  decryptApiKey(encryptedKey: string): string {
    if (!this.enabled) {
      throw new Error('Secure vault is disabled. Configure SESSION_SECRET to enable decryption.');
    }
    return decrypt(encryptedKey);
  }
  
  /**
   * Safely encrypt if not already encrypted
   * Returns null if vault is disabled
   */
  ensureEncrypted(data: string): string | null {
    if (!this.enabled) {
      return null;
    }
    if (isEncrypted(data)) {
      return data;
    }
    return encrypt(data);
  }
  
  /**
   * Safely decrypt if encrypted, otherwise return as-is
   * Useful for migration scenarios
   */
  safeDecrypt(data: string): string {
    if (!this.enabled) {
      return data; // Return as-is if vault disabled
    }
    if (isEncrypted(data)) {
      try {
        return decrypt(data);
      } catch {
        return data; // Return as-is if decryption fails
      }
    }
    return data;
  }
  
  /**
   * Generate a secure random token (for reset tokens, verification tokens, etc.)
   * This works even when vault is disabled
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
  
  /**
   * Generate a time-limited token with expiration
   * Format: token:timestamp
   * @throws Error if vault is not enabled
   */
  generateTimeLimitedToken(expiresInMinutes: number = 60): string {
    if (!this.enabled) {
      throw new Error('Secure vault is disabled. Configure SESSION_SECRET to enable token generation.');
    }
    const token = this.generateSecureToken();
    const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;
    return encrypt(`${token}:${expiresAt}`);
  }
  
  /**
   * Validate a time-limited token
   */
  validateTimeLimitedToken(encryptedToken: string): { valid: boolean; token?: string; expired?: boolean } {
    if (!this.enabled) {
      return { valid: false };
    }
    try {
      const decrypted = decrypt(encryptedToken);
      const [token, timestamp] = decrypted.split(':');
      const expiresAt = parseInt(timestamp, 10);
      
      if (isNaN(expiresAt)) {
        return { valid: false };
      }
      
      if (Date.now() > expiresAt) {
        return { valid: false, expired: true, token };
      }
      
      return { valid: true, token };
    } catch {
      return { valid: false };
    }
  }
  
  /**
   * Hash a value for comparison (one-way)
   * Useful for storing token hashes in database
   * This works even when vault is disabled
   */
  hashForStorage(value: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(value, salt, 100000, 32, 'sha256').toString('hex');
    return `${salt}:${hash}`;
  }
  
  /**
   * Verify a value against its hash
   * This works even when vault is disabled
   */
  verifyHash(value: string, storedHash: string): boolean {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    
    const computedHash = crypto.pbkdf2Sync(value, salt, 100000, 32, 'sha256').toString('hex');
    
    // Timing-safe comparison
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(computedHash));
  }
}

// Export singleton instance - this is safe because constructor doesn't throw
export const secureVault = SecureVault.getInstance();

// Export utility function for checking availability
export { tryGetEncryptionKey as getEncryptionKey };