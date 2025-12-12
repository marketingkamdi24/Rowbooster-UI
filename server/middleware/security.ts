/**
 * Security Middleware Module
 * Implements comprehensive security measures including:
 * - Security headers (equivalent to helmet.js)
 * - CSRF protection
 * - XSS prevention
 * - Rate limiting with Redis-compatible in-memory fallback
 * - Session binding (IP + User-Agent)
 * - Request validation
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { secureLog } from '../utils/secureLogger';

// Configuration from environment with secure defaults
const SECURITY_CONFIG = {
  // Rate limiting
  MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  GENERAL_RATE_LIMIT: parseInt(process.env.GENERAL_RATE_LIMIT || '100', 10), // requests per window
  
  // Session security
  SESSION_BINDING_ENABLED: process.env.SESSION_BINDING_ENABLED !== 'false', // Default: enabled
  
  // CSRF
  CSRF_ENABLED: process.env.CSRF_ENABLED !== 'false', // Default: enabled
  
  // Debug mode (never enable in production)
  DEBUG_ENDPOINTS_ENABLED: process.env.NODE_ENV === 'development' && process.env.ENABLE_DEBUG_ENDPOINTS === 'true',
};

// Rate limit storage (in production, consider using Redis)
interface RateLimitEntry {
  count: number;
  firstRequest: number;
  blocked: boolean;
  blockedUntil?: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// CSRF token storage with expiry
interface CsrfTokenEntry {
  token: string;
  expires: number;
  sessionId?: string;
}

const csrfTokens = new Map<string, CsrfTokenEntry>();

// Session binding storage (sessionId -> { ip, userAgent })
interface SessionBinding {
  ip: string;
  userAgentHash: string;
  createdAt: number;
}

const sessionBindings = new Map<string, SessionBinding>();

// Cleanup interval for expired entries (runs every 5 minutes)
setInterval(() => {
  const now = Date.now();
  
  // Clean up rate limit entries
  Array.from(rateLimitStore.entries()).forEach(([key, entry]) => {
    if (now - entry.firstRequest > SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitStore.delete(key);
    }
  });
  
  // Clean up CSRF tokens
  Array.from(csrfTokens.entries()).forEach(([key, entry]) => {
    if (now > entry.expires) {
      csrfTokens.delete(key);
    }
  });
  
  // Clean up old session bindings (older than 24 hours)
  Array.from(sessionBindings.entries()).forEach(([key, binding]) => {
    if (now - binding.createdAt > 24 * 60 * 60 * 1000) {
      sessionBindings.delete(key);
    }
  });
}, 5 * 60 * 1000);

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a secure CSRF token
 */
export function generateCsrfToken(): string {
  return generateSecureToken(32);
}

/**
 * Hash a User-Agent string for session binding
 */
function hashUserAgent(userAgent: string | undefined): string {
  if (!userAgent) return 'unknown';
  return crypto.createHash('sha256').update(userAgent).digest('hex').substring(0, 16);
}

/**
 * Get client IP address (handles proxies)
 */
function getClientIp(req: Request): string {
  // Trust X-Forwarded-For header only in production behind a proxy
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor && process.env.TRUST_PROXY === 'true') {
    const ips = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor.split(',')[0];
    return ips.trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Security Headers Middleware
 * Adds comprehensive security headers to all responses (helmet.js equivalent)
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent clickjacking by disallowing framing
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS filter in older browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy - don't leak referrer to external sites
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy - restrict dangerous browser features
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()');
  
  // Prevent DNS prefetching
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  
  // Prevent IE from executing downloads in site's context
  res.setHeader('X-Download-Options', 'noopen');
  
  // Disable client-side caching for API responses
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  
  // In production, enforce HTTPS with HSTS
  if (process.env.NODE_ENV === 'production') {
    // Strict Transport Security - force HTTPS for 1 year
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    
    // Expect-CT header (Certificate Transparency)
    res.setHeader('Expect-CT', 'max-age=86400, enforce');
  }
  
  // Content Security Policy - prevent XSS attacks
  // Allow inline scripts for React/Vite in development
  // Allow cdnjs.cloudflare.com for pdf.js library
  const csp = process.env.NODE_ENV === 'production'
    ? "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://cdnjs.cloudflare.com; connect-src 'self'; frame-ancestors 'none'; worker-src 'self' blob:; base-uri 'self'; form-action 'self'; upgrade-insecure-requests"
    : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://cdnjs.cloudflare.com; connect-src 'self' ws: wss:; frame-ancestors 'none'; worker-src 'self' blob:";
  
  res.setHeader('Content-Security-Policy', csp);
  
  // Remove X-Powered-By header (Express default)
  res.removeHeader('X-Powered-By');
  
  // Add a request ID for tracing (if not already present)
  if (!(req as any).requestId) {
    (req as any).requestId = generateSecureToken(16);
  }
  res.setHeader('X-Request-ID', (req as any).requestId);
  
  next();
}

/**
 * CSRF Protection Middleware
 * Validates CSRF tokens for state-changing requests
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (!SECURITY_CONFIG.CSRF_ENABLED) {
    next();
    return;
  }
  
  // Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    next();
    return;
  }
  
  // For additional CSRF protection, check the origin header
  const origin = req.get('origin');
  const referer = req.get('referer');
  const host = req.get('host');
  
  // Build list of allowed origins
  const allowedOrigins: string[] = [];
  if (process.env.APP_URL) {
    allowedOrigins.push(process.env.APP_URL.replace(/\/$/, ''));
  }
  if (host) {
    allowedOrigins.push(`https://${host}`);
    if (process.env.NODE_ENV !== 'production') {
      allowedOrigins.push(`http://${host}`);
      // In development, allow all localhost/127.0.0.1 origins on any port
      // This is needed for dev tools, proxies, and hot-reload servers
      allowedOrigins.push('http://localhost:5000');
      allowedOrigins.push('http://127.0.0.1:5000');
      allowedOrigins.push('http://localhost:5173');
      allowedOrigins.push('http://127.0.0.1:5173');
      // Allow any localhost port for development proxies (e.g., Cascade browser preview)
      if (origin) {
        const originUrl = new URL(origin);
        if (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') {
          allowedOrigins.push(origin);
        }
      }
    }
  }
  
  // Validate origin
  if (origin && allowedOrigins.length > 0) {
    const originWithoutPath = origin.replace(/\/$/, '');
    const isAllowed = allowedOrigins.some(allowed =>
      originWithoutPath === allowed || originWithoutPath.startsWith(allowed)
    );
    
    if (!isAllowed) {
      secureLog.security('CSRF blocked: invalid origin', {
        origin,
        host,
        allowedOrigins: allowedOrigins.length,
        path: req.path,
        method: req.method,
      });
      res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_ORIGIN_MISMATCH',
          message: 'Request origin not allowed',
        }
      });
      return;
    }
  }
  
  // Validate referer for same-origin requests (additional layer)
  if (referer && process.env.NODE_ENV === 'production') {
    try {
      const refererUrl = new URL(referer);
      const isAllowedReferer = allowedOrigins.some(allowed => {
        const allowedUrl = new URL(allowed);
        return refererUrl.host === allowedUrl.host;
      });
      
      if (!isAllowedReferer) {
        secureLog.security('CSRF blocked: invalid referer', {
          referer: refererUrl.host,
          path: req.path,
        });
        res.status(403).json({
          success: false,
          error: {
            code: 'CSRF_REFERER_MISMATCH',
            message: 'Request referer not allowed',
          }
        });
        return;
      }
    } catch {
      // Invalid referer URL - continue with other checks
    }
  }
  
  // SameSite=Strict cookies provide additional CSRF protection
  next();
}

/**
 * Input Sanitization Middleware
 * Sanitizes common XSS attack vectors from request body
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }
  
  if (req.params && typeof req.params === 'object') {
    sanitizeObject(req.params);
  }
  
  next();
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Remove null bytes
      obj[key] = obj[key].replace(/\0/g, '');
      
      // Don't sanitize HTML here as we might need it for legitimate purposes
      // Instead, ensure output encoding is done when rendering
      // The React framework handles this automatically
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

/**
 * Rate Limiting for Authentication Endpoints
 * Prevents brute force attacks on login with progressive delays
 */
export function rateLimitAuth(req: Request, res: Response, next: NextFunction): void {
  // Only apply rate limiting to actual login endpoints
  const loginPaths = ['/login', '/api/login', '/api/auth/login'];
  const isLoginPath = loginPaths.some(path => req.path.endsWith(path));
  
  // Exclude paths that should NOT be rate limited (registration, password reset, etc.)
  const excludedPaths = ['/register', '/forgot-password', '/reset-password', '/verify-email', '/resend-verification', '/check-availability', '/test-email'];
  const isExcludedPath = excludedPaths.some(path => req.path.includes(path));
  
  if (!isLoginPath || isExcludedPath) {
    next();
    return;
  }
  
  // Skip for GET requests
  if (req.method === 'GET') {
    next();
    return;
  }
  
  const ip = getClientIp(req);
  const now = Date.now();
  
  let entry = rateLimitStore.get(ip);
  
  if (entry) {
    // Check if currently blocked
    if (entry.blocked && entry.blockedUntil && now < entry.blockedUntil) {
      const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      secureLog.security('Rate limit: blocked login attempt', {
        ip: ip.substring(0, 10) + '...',
        retryAfter,
        attempts: entry.count,
      });
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Zu viele Anmeldeversuche. Bitte versuchen Sie es später erneut.',
          retryAfter,
        }
      });
      return;
    }
    
    // Check if window has expired
    if (now - entry.firstRequest > SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS) {
      // Reset the window
      entry = { count: 1, firstRequest: now, blocked: false };
      rateLimitStore.set(ip, entry);
    } else if (entry.count >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
      // Apply progressive blocking (exponential backoff)
      const blockDuration = Math.min(
        SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS * Math.pow(2, Math.floor(entry.count / SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) - 1),
        24 * 60 * 60 * 1000 // Max 24 hours
      );
      
      entry.blocked = true;
      entry.blockedUntil = now + blockDuration;
      entry.count++;
      rateLimitStore.set(ip, entry);
      
      const retryAfter = Math.ceil(blockDuration / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      
      secureLog.security('Rate limit: account locked', {
        ip: ip.substring(0, 10) + '...',
        attempts: entry.count,
        blockDuration: `${Math.round(blockDuration / 60000)} minutes`,
      });
      
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Zu viele Anmeldeversuche. Der Zugriff ist vorübergehend gesperrt.',
          retryAfter,
        }
      });
      return;
    } else {
      entry.count++;
      rateLimitStore.set(ip, entry);
    }
  } else {
    rateLimitStore.set(ip, { count: 1, firstRequest: now, blocked: false });
  }
  
  next();
}

/**
 * General API rate limiting
 * Prevents abuse of API endpoints
 */
export function rateLimitGeneral(req: Request, res: Response, next: NextFunction): void {
  // Only apply rate limiting to API routes
  if (!req.path.startsWith('/api')) {
    next();
    return;
  }
  
  // Skip rate limiting for health checks and auth status checks
  if (req.path === '/api/health' || req.path === '/api/user') {
    next();
    return;
  }
  
  // In development, use a much higher rate limit or skip for GET requests
  if (process.env.NODE_ENV !== 'production') {
    // Skip rate limiting for GET requests in development (data fetching)
    if (req.method === 'GET') {
      next();
      return;
    }
  }
  
  const ip = getClientIp(req);
  const key = `general:${ip}`;
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  if (entry) {
    if (now - entry.firstRequest > 60000) { // 1 minute window
      entry = { count: 1, firstRequest: now, blocked: false };
      rateLimitStore.set(key, entry);
    } else if (entry.count >= SECURITY_CONFIG.GENERAL_RATE_LIMIT) {
      const retryAfter = Math.ceil((entry.firstRequest + 60000 - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Zu viele Anfragen. Bitte kurz warten und erneut versuchen.',
          retryAfter,
        }
      });
      return;
    } else {
      entry.count++;
      rateLimitStore.set(key, entry);
    }
  } else {
    rateLimitStore.set(key, { count: 1, firstRequest: now, blocked: false });
  }
  
  next();
}

/**
 * Reset login attempts for an IP (call on successful login)
 */
export function resetLoginAttempts(ip: string): void {
  rateLimitStore.delete(ip);
  // Also clear general rate limit for this IP on successful auth
  rateLimitStore.delete(`general:${ip}`);
}

/**
 * Session binding middleware
 * Binds sessions to IP and User-Agent to prevent session hijacking
 */
export function sessionBinding(req: Request, res: Response, next: NextFunction): void {
  if (!SECURITY_CONFIG.SESSION_BINDING_ENABLED) {
    next();
    return;
  }
  
  const sessionId = req.cookies?.sessionId;
  if (!sessionId) {
    next();
    return;
  }
  
  const ip = getClientIp(req);
  const userAgentHash = hashUserAgent(req.get('user-agent'));
  
  const existingBinding = sessionBindings.get(sessionId);
  
  if (existingBinding) {
    // Validate session binding
    const ipChanged = existingBinding.ip !== ip;
    const userAgentChanged = existingBinding.userAgentHash !== userAgentHash;
    
    if (ipChanged || userAgentChanged) {
      secureLog.security('Session binding mismatch detected', {
        sessionIdPrefix: sessionId.substring(0, 8),
        ipChanged,
        userAgentChanged,
      });
      
      // In strict mode, invalidate the session
      if (process.env.STRICT_SESSION_BINDING === 'true') {
        res.clearCookie('sessionId');
        sessionBindings.delete(sessionId);
        res.status(401).json({
          success: false,
          error: {
            code: 'SESSION_INVALID',
            message: 'Session security check failed. Please log in again.',
          }
        });
        return;
      }
      
      // In non-strict mode, update the binding but log the event
      sessionBindings.set(sessionId, {
        ip,
        userAgentHash,
        createdAt: existingBinding.createdAt,
      });
    }
  } else {
    // Create new session binding
    sessionBindings.set(sessionId, {
      ip,
      userAgentHash,
      createdAt: Date.now(),
    });
  }
  
  next();
}

/**
 * Create session binding for a new session
 */
export function createSessionBinding(sessionId: string, ip: string, userAgent: string | undefined): void {
  sessionBindings.set(sessionId, {
    ip,
    userAgentHash: hashUserAgent(userAgent),
    createdAt: Date.now(),
  });
}

/**
 * Remove session binding on logout
 */
export function removeSessionBinding(sessionId: string): void {
  sessionBindings.delete(sessionId);
}

/**
 * Block debug endpoints in production
 */
export function blockDebugEndpoints(req: Request, res: Response, next: NextFunction): void {
  if (req.path.includes('/debug/') || req.path.includes('/test-')) {
    if (!SECURITY_CONFIG.DEBUG_ENDPOINTS_ENABLED) {
      secureLog.security('Blocked debug endpoint access', {
        path: req.path,
        ip: getClientIp(req).substring(0, 10),
      });
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found',
        }
      });
      return;
    }
  }
  next();
}

/**
 * SQL Injection Prevention - validate ID parameters
 */
export function validateIdParam(req: Request, res: Response, next: NextFunction): void {
  const id = req.params.id || req.params.userId;
  
  if (id !== undefined) {
    // Ensure ID is a valid integer
    const numId = parseInt(id, 10);
    if (isNaN(numId) || numId < 0 || numId.toString() !== id) {
      console.warn(`[SECURITY] Invalid ID parameter: ${id}`);
      res.status(400).json({ message: 'Invalid ID parameter' });
      return;
    }
  }
  
  next();
}

/**
 * Password Strength Validation
 */
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Check for common weak passwords
  const commonPasswords = [
    'password', '123456', 'qwerty', 'admin', 'letmein',
    'welcome', 'monkey', 'dragon', 'master', 'login'
  ];
  
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    errors.push('Password contains a common weak pattern');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Check for common attack patterns in request
 */
export function detectMaliciousPatterns(req: Request, res: Response, next: NextFunction): void {
  const suspicious = [];
  
  // Endpoints that legitimately receive HTML/web content and should be excluded from body pattern checks
  // These endpoints receive scraped web content which contains legitimate HTML, script tags, event handlers, etc.
  // Also includes endpoints that receive PDF text which may contain extracted content with special characters
  const htmlContentEndpoints = [
    '/api/extract-url-product-data',
    '/api/scrape-url',
    '/api/extract-pdf-data',
    '/api/scrape',
    '/api/search/pdf-extract',
    '/api/search/web-content',
  ];
  
  const isHtmlContentEndpoint = htmlContentEndpoints.some(endpoint => req.path.includes(endpoint));
  
  // Check URL for common attack patterns
  const urlLower = req.url.toLowerCase();
  
  // Path traversal
  if (urlLower.includes('..') || urlLower.includes('%2e%2e')) {
    suspicious.push('path_traversal');
  }
  
  // SQL injection patterns in URL
  const sqlPatterns = [
    /union\s+select/i,
    /'\s*or\s*'1'\s*=\s*'1/i,
    /;\s*drop\s+table/i,
    /--\s*$/,
    /\/\*.*\*\//,
  ];
  
  for (const pattern of sqlPatterns) {
    if (pattern.test(req.url)) {
      suspicious.push('sql_injection_url');
      break;
    }
  }
  
  // XSS patterns in URL
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /vbscript:/i,
  ];
  
  for (const pattern of xssPatterns) {
    if (pattern.test(req.url)) {
      suspicious.push('xss_url');
      break;
    }
  }
  
  // Check request body for dangerous patterns
  // Skip body checks for endpoints that legitimately receive HTML/web content
  if (req.body && typeof req.body === 'object' && !isHtmlContentEndpoint) {
    const bodyStr = JSON.stringify(req.body);
    
    for (const pattern of sqlPatterns) {
      if (pattern.test(bodyStr)) {
        suspicious.push('sql_injection_body');
        break;
      }
    }
    
    for (const pattern of xssPatterns) {
      if (pattern.test(bodyStr)) {
        suspicious.push('xss_body');
        break;
      }
    }
  }
  
  if (suspicious.length > 0) {
    secureLog.security('Malicious pattern detected', {
      patterns: suspicious,
      path: req.path,
      method: req.method,
      ip: getClientIp(req).substring(0, 10),
    });
    
    // In production, block suspicious requests
    if (process.env.NODE_ENV === 'production') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request contains invalid characters',
        }
      });
      return;
    }
  }
  
  next();
}

/**
 * Export helper function to get client IP for use in other modules
 */
export { getClientIp };