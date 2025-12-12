/**
 * Persistent Rate Limiter
 * 
 * A database-backed rate limiting service that persists across server restarts.
 * Uses sliding window algorithm for accurate rate limiting.
 * 
 * Features:
 * - Persistent storage in PostgreSQL
 * - Sliding window rate limiting
 * - Automatic cleanup of expired entries
 * - IP-based and user-based rate limiting
 * - Configurable limits per endpoint
 */

import { pool } from '../db';
import { secureLog } from '../utils/secureLogger';

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests allowed in window
  blockDurationMs?: number; // How long to block after exceeding limit
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;   // Seconds until next allowed request
}

// Default rate limit configurations
const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  // General API endpoints
  'default': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    blockDurationMs: 15 * 60 * 1000,
  },
  // Authentication endpoints - more restrictive
  'auth:login': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    blockDurationMs: 15 * 60 * 1000,
  },
  'auth:register': {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    blockDurationMs: 60 * 60 * 1000,
  },
  'auth:password-reset': {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    blockDurationMs: 60 * 60 * 1000,
  },
  // API key operations - moderate restriction
  'api-keys': {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    blockDurationMs: 60 * 60 * 1000,
  },
  // Search/AI endpoints - based on cost
  'search': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    blockDurationMs: 60 * 1000,
  },
  'ai-extract': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    blockDurationMs: 60 * 1000,
  },
};

export class PersistentRateLimiter {
  private static instance: PersistentRateLimiter;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private tableReady: boolean = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): PersistentRateLimiter {
    if (!PersistentRateLimiter.instance) {
      PersistentRateLimiter.instance = new PersistentRateLimiter();
    }
    return PersistentRateLimiter.instance;
  }

  /**
   * Initialize the rate limiter and ensure table exists
   */
  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      // Check if table exists, create if not
      const createTableQuery = `
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
      `;

      await pool.query(createTableQuery);
      this.tableReady = true;

      // Start cleanup interval (every 5 minutes)
      this.startCleanupInterval();

      secureLog.info('[RATE-LIMITER] Persistent rate limiter initialized');
    } catch (error) {
      secureLog.error('[RATE-LIMITER] Failed to initialize:', error);
      // Fall back to allowing requests if database is unavailable
      this.tableReady = false;
    }
  }

  /**
   * Check if a request should be allowed
   */
  async checkLimit(
    identifier: string,
    endpoint: string = 'default'
  ): Promise<RateLimitResult> {
    // Ensure initialized
    if (!this.tableReady) {
      await this.initialize();
    }

    // If still not ready, allow the request (fail open for availability)
    if (!this.tableReady) {
      return {
        allowed: true,
        remaining: 999,
        resetTime: new Date(Date.now() + 60000),
      };
    }

    const config = DEFAULT_LIMITS[endpoint] || DEFAULT_LIMITS['default'];
    const now = new Date();
    const windowStart = new Date(now.getTime() - config.windowMs);

    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Check for existing block
        const blockCheck = await client.query(
          `SELECT blocked_until FROM rate_limits 
           WHERE identifier = $1 AND endpoint = $2 AND blocked_until > $3`,
          [identifier, endpoint, now]
        );

        if (blockCheck.rows.length > 0) {
          const blockedUntil = new Date(blockCheck.rows[0].blocked_until);
          const retryAfter = Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000);
          
          await client.query('COMMIT');
          return {
            allowed: false,
            remaining: 0,
            resetTime: blockedUntil,
            retryAfter,
          };
        }

        // Get or create rate limit entry
        const result = await client.query(
          `INSERT INTO rate_limits (identifier, endpoint, request_count, window_start, updated_at)
           VALUES ($1, $2, 1, $3, $4)
           ON CONFLICT (identifier, endpoint) 
           DO UPDATE SET 
             request_count = CASE 
               WHEN rate_limits.window_start < $5 THEN 1
               ELSE rate_limits.request_count + 1
             END,
             window_start = CASE 
               WHEN rate_limits.window_start < $5 THEN $3
               ELSE rate_limits.window_start
             END,
             updated_at = $4
           RETURNING request_count, window_start`,
          [identifier, endpoint, now, now, windowStart]
        );

        const requestCount = result.rows[0].request_count;
        const currentWindowStart = new Date(result.rows[0].window_start);
        const resetTime = new Date(currentWindowStart.getTime() + config.windowMs);
        const remaining = Math.max(0, config.maxRequests - requestCount);

        // Check if limit exceeded
        if (requestCount > config.maxRequests) {
          const blockDuration = config.blockDurationMs || config.windowMs;
          const blockedUntil = new Date(now.getTime() + blockDuration);
          
          await client.query(
            `UPDATE rate_limits SET blocked_until = $1 WHERE identifier = $2 AND endpoint = $3`,
            [blockedUntil, identifier, endpoint]
          );

          await client.query('COMMIT');

          secureLog.warn('[RATE-LIMITER] Rate limit exceeded', {
            identifier: identifier.substring(0, 10) + '...',
            endpoint,
            requestCount,
            blockedUntil: blockedUntil.toISOString(),
          });

          return {
            allowed: false,
            remaining: 0,
            resetTime: blockedUntil,
            retryAfter: Math.ceil(blockDuration / 1000),
          };
        }

        await client.query('COMMIT');
        
        return {
          allowed: true,
          remaining,
          resetTime,
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      secureLog.error('[RATE-LIMITER] Error checking rate limit:', error);
      // Fail open - allow request if database error
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetTime: new Date(now.getTime() + config.windowMs),
      };
    }
  }

  /**
   * Reset rate limit for an identifier
   */
  async resetLimit(identifier: string, endpoint?: string): Promise<void> {
    if (!this.tableReady) return;

    try {
      if (endpoint) {
        await pool.query(
          'DELETE FROM rate_limits WHERE identifier = $1 AND endpoint = $2',
          [identifier, endpoint]
        );
      } else {
        await pool.query(
          'DELETE FROM rate_limits WHERE identifier = $1',
          [identifier]
        );
      }
    } catch (error) {
      secureLog.error('[RATE-LIMITER] Error resetting limit:', error);
    }
  }

  /**
   * Clean up expired entries
   */
  async cleanup(): Promise<void> {
    if (!this.tableReady) return;

    try {
      const oldestWindow = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      const result = await pool.query(
        `DELETE FROM rate_limits 
         WHERE window_start < $1 AND (blocked_until IS NULL OR blocked_until < $2)`,
        [oldestWindow, new Date()]
      );

      if (result.rowCount && result.rowCount > 0) {
        secureLog.info(`[RATE-LIMITER] Cleaned up ${result.rowCount} expired entries`);
      }
    } catch (error) {
      secureLog.error('[RATE-LIMITER] Error during cleanup:', error);
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch((err) => {
        secureLog.error('[RATE-LIMITER] Cleanup interval error:', err);
      });
    }, 5 * 60 * 1000);
  }

  /**
   * Stop the rate limiter and cleanup interval
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get current rate limit status for an identifier
   */
  async getStatus(identifier: string, endpoint: string = 'default'): Promise<{
    requestCount: number;
    maxRequests: number;
    windowStart: Date | null;
    blockedUntil: Date | null;
  }> {
    if (!this.tableReady) {
      const config = DEFAULT_LIMITS[endpoint] || DEFAULT_LIMITS['default'];
      return {
        requestCount: 0,
        maxRequests: config.maxRequests,
        windowStart: null,
        blockedUntil: null,
      };
    }

    try {
      const config = DEFAULT_LIMITS[endpoint] || DEFAULT_LIMITS['default'];
      const result = await pool.query(
        'SELECT request_count, window_start, blocked_until FROM rate_limits WHERE identifier = $1 AND endpoint = $2',
        [identifier, endpoint]
      );

      if (result.rows.length === 0) {
        return {
          requestCount: 0,
          maxRequests: config.maxRequests,
          windowStart: null,
          blockedUntil: null,
        };
      }

      return {
        requestCount: result.rows[0].request_count,
        maxRequests: config.maxRequests,
        windowStart: result.rows[0].window_start ? new Date(result.rows[0].window_start) : null,
        blockedUntil: result.rows[0].blocked_until ? new Date(result.rows[0].blocked_until) : null,
      };
    } catch (error) {
      secureLog.error('[RATE-LIMITER] Error getting status:', error);
      const config = DEFAULT_LIMITS[endpoint] || DEFAULT_LIMITS['default'];
      return {
        requestCount: 0,
        maxRequests: config.maxRequests,
        windowStart: null,
        blockedUntil: null,
      };
    }
  }
}

// Export singleton instance
export const persistentRateLimiter = PersistentRateLimiter.getInstance();

// Express middleware factory
export function createRateLimitMiddleware(endpoint: string = 'default') {
  return async (req: any, res: any, next: any) => {
    // Get identifier (prefer user ID, fallback to IP)
    const userId = req.user?.id;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const identifier = userId ? `user:${userId}` : `ip:${ip}`;

    try {
      const result = await persistentRateLimiter.checkLimit(identifier, endpoint);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', DEFAULT_LIMITS[endpoint]?.maxRequests || 100);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.floor(result.resetTime.getTime() / 1000));

      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter || 60);
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: result.retryAfter,
        });
      }

      next();
    } catch (error) {
      // Fail open - allow request if rate limiter fails
      secureLog.error('[RATE-LIMITER] Middleware error:', error);
      next();
    }
  };
}