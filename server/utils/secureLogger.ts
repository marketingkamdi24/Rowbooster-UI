/**
 * Secure Logging Utility
 * 
 * This module provides secure logging functions that automatically
 * redact sensitive information to prevent security breaches through logs.
 */

// Patterns to detect and redact sensitive data
const SENSITIVE_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  // Passwords
  { pattern: /password['":\s]+['"]?[^'",\s}]+['"]?/gi, replacement: 'password: "[REDACTED]"' },
  { pattern: /pass['":\s]+['"]?[^'",\s}]+['"]?/gi, replacement: 'pass: "[REDACTED]"' },
  
  // Password hashes (bcrypt format)
  { pattern: /\$2[aby]\$\d+\$[A-Za-z0-9./]{53}/g, replacement: '[HASH_REDACTED]' },
  
  // JWT tokens
  { pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, replacement: '[JWT_REDACTED]' },
  
  // API keys (common patterns)
  { pattern: /sk-[a-zA-Z0-9]{32,}/g, replacement: '[API_KEY_REDACTED]' },
  { pattern: /api[_-]?key['":\s]+['"]?[a-zA-Z0-9_-]{20,}['"]?/gi, replacement: 'api_key: "[API_KEY_REDACTED]"' },
  
  // Session IDs (hex strings 32+ chars)
  { pattern: /sessionId['":\s]+['"]?[a-f0-9]{32,}['"]?/gi, replacement: 'sessionId: "[SESSION_REDACTED]"' },
  
  // Tokens
  { pattern: /token['":\s]+['"]?[a-zA-Z0-9_-]{20,}['"]?/gi, replacement: 'token: "[TOKEN_REDACTED]"' },
  { pattern: /verificationToken['":\s]+['"]?[a-zA-Z0-9_-]+['"]?/gi, replacement: 'verificationToken: "[REDACTED]"' },
  { pattern: /resetToken['":\s]+['"]?[a-zA-Z0-9_-]+['"]?/gi, replacement: 'resetToken: "[REDACTED]"' },
  
  // Email addresses (optional - enable if needed)
  // { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL_REDACTED]' },
  
  // Credit card numbers
  { pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, replacement: '[CC_REDACTED]' },
  
  // SSN
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN_REDACTED]' },
];

// Fields that should always be redacted in objects
const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordHash',
  'hashedPassword',
  'secret',
  'apiKey',
  'apiSecret',
  'accessToken',
  'refreshToken',
  'sessionId',
  'token',
  'verificationToken',
  'resetToken',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'ssn',
  'creditCard',
  'cardNumber',
  'cvv',
]);

/**
 * Redact sensitive data from a string
 */
function redactString(str: string): string {
  let result = str;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Deep clone and redact sensitive fields from an object
 */
function redactObject(obj: any, depth: number = 0): any {
  // Prevent infinite recursion
  if (depth > 10) return '[MAX_DEPTH_EXCEEDED]';
  
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return redactString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item, depth + 1));
  }
  
  if (typeof obj === 'object') {
    const redacted: any = {};
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();
      
      // Check if this field should be completely redacted
      if (SENSITIVE_FIELDS.has(lowerKey) || SENSITIVE_FIELDS.has(key)) {
        redacted[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'string') {
        redacted[key] = redactString(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        redacted[key] = redactObject(obj[key], depth + 1);
      } else {
        redacted[key] = obj[key];
      }
    }
    return redacted;
  }
  
  return obj;
}

/**
 * Format log arguments safely
 */
function formatArgs(args: any[]): string {
  return args.map(arg => {
    if (typeof arg === 'string') {
      return redactString(arg);
    }
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(redactObject(arg), null, 2);
      } catch {
        return '[CIRCULAR_OBJECT]';
      }
    }
    return String(arg);
  }).join(' ');
}

/**
 * Check if running in production mode
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Secure logger object
 */
export const secureLog = {
  /**
   * Log info level messages
   * In production, sensitive data is always redacted
   */
  info: (...args: any[]) => {
    const message = formatArgs(args);
    console.log(`[INFO] ${message}`);
  },
  
  /**
   * Log warning level messages
   */
  warn: (...args: any[]) => {
    const message = formatArgs(args);
    console.warn(`[WARN] ${message}`);
  },
  
  /**
   * Log error level messages
   * Error objects are handled specially to preserve stack traces
   */
  error: (...args: any[]) => {
    const formattedArgs = args.map(arg => {
      if (arg instanceof Error) {
        return {
          name: arg.name,
          message: redactString(arg.message),
          stack: arg.stack ? redactString(arg.stack) : undefined,
        };
      }
      return arg;
    });
    const message = formatArgs(formattedArgs);
    console.error(`[ERROR] ${message}`);
  },
  
  /**
   * Log debug level messages
   * Only logs in development mode
   */
  debug: (...args: any[]) => {
    if (!isProduction()) {
      const message = formatArgs(args);
      console.log(`[DEBUG] ${message}`);
    }
  },
  
  /**
   * Log security-related events
   * Always logs but with redaction
   */
  security: (...args: any[]) => {
    const message = formatArgs(args);
    console.log(`[SECURITY] ${message}`);
  },
  
  /**
   * Log authentication events
   * Can be called with either:
   * - auth(action, data) - simple form with action string and data object
   * - auth(action, userId, username, success, details) - full form for detailed logging
   */
  auth: (action: string, dataOrUserId?: any, username?: string, success: boolean = true, details?: any) => {
    let logData: any;
    
    // Check if second argument is an object (new simple form) or number (old form)
    if (typeof dataOrUserId === 'object' && dataOrUserId !== null && !Array.isArray(dataOrUserId)) {
      logData = {
        action,
        timestamp: new Date().toISOString(),
        ...redactObject(dataOrUserId),
      };
    } else {
      // Legacy form with positional arguments
      logData = {
        action,
        userId: dataOrUserId || 'anonymous',
        username: username ? username.substring(0, 3) + '***' : 'anonymous',
        success,
        timestamp: new Date().toISOString(),
        details: details ? redactObject(details) : undefined,
      };
    }
    console.log(`[AUTH] ${JSON.stringify(logData)}`);
  },
  
  /**
   * Log session events
   */
  session: (action: string, sessionId?: string, userId?: number, details?: any) => {
    const logData = {
      action,
      sessionIdPrefix: sessionId ? sessionId.substring(0, 8) + '...' : 'unknown',
      userId: userId || 'anonymous',
      timestamp: new Date().toISOString(),
      details: details ? redactObject(details) : undefined,
    };
    console.log(`[SESSION] ${JSON.stringify(logData)}`);
  },
  
  /**
   * Log API requests (without sensitive body data)
   */
  api: (method: string, path: string, statusCode: number, duration: number, userId?: number) => {
    // Don't log sensitive paths in detail
    const sanitizedPath = path.includes('password') || path.includes('token') 
      ? path.split('?')[0] + '?[PARAMS_HIDDEN]'
      : path;
    
    console.log(`[API] ${method} ${sanitizedPath} ${statusCode} ${duration}ms ${userId ? `user:${userId}` : ''}`);
  },
};

/**
 * Create a child logger with a prefix
 */
export function createLogger(prefix: string) {
  return {
    info: (...args: any[]) => secureLog.info(`[${prefix}]`, ...args),
    warn: (...args: any[]) => secureLog.warn(`[${prefix}]`, ...args),
    error: (...args: any[]) => secureLog.error(`[${prefix}]`, ...args),
    debug: (...args: any[]) => secureLog.debug(`[${prefix}]`, ...args),
    security: (...args: any[]) => secureLog.security(`[${prefix}]`, ...args),
  };
}

export default secureLog;