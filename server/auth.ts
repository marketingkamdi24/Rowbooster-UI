import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "./storage";
import { User, LoginCredentials } from "@shared/schema";
import { MonitoringLogger } from "./services/monitoringLogger";
import { SESSION_CONFIG, isSessionIdle } from "./services/sessionCleanup";
import { secureLog } from "./utils/secureLogger";
import { createSessionBinding, removeSessionBinding } from "./middleware/security";

// Session management - use centralized config
const SESSION_DURATION = SESSION_CONFIG.SESSION_DURATION;
const IDLE_TIMEOUT = SESSION_CONFIG.IDLE_TIMEOUT;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15 minutes

// Security: Timing-safe string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to maintain constant time
    const dummy = crypto.timingSafeEqual(
      Buffer.from(a.padEnd(32, '0')),
      Buffer.from(a.padEnd(32, '1'))
    );
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionId?: string;
}

// Generate secure session ID
export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Authenticate user with username/email and password
export async function authenticateUser(
  credentials: LoginCredentials,
  clientInfo?: { ip?: string; userAgent?: string }
): Promise<{ user: User; sessionId: string } | null> {
  // Secure logging - never log passwords or credential details
  secureLog.auth('Login attempt', {
    usernameLength: credentials.username.length,
    isEmail: credentials.username.includes('@'),
  });
  
  // Log authentication attempt (monitoring system)
  MonitoringLogger.info(
    `Login attempt`,
    'auth',
    { metadata: { isEmail: credentials.username.includes('@') } }
  ).catch(() => {});
  
  // Try to find user by username first, then by email
  let user = await storage.getUserByUsername(credentials.username);
  
  // If not found by username, try email
  if (!user && credentials.username.includes('@')) {
    user = await storage.getUserByEmail(credentials.username);
  }
  
  // Secure logging - don't expose user existence details
  secureLog.auth('User lookup completed', {
    found: !!user,
  });
  
  if (!user) {
    // Security: Don't reveal whether username or email exists
    // Use consistent timing to prevent user enumeration
    await bcrypt.compare('dummy_password', '$2a$12$dummy.hash.for.timing.attack.prevention');
    
    secureLog.security('Login failed: user not found', {});
    
    // Log failed login - user not found (security event)
    MonitoringLogger.warn(
      `Login failed: credentials not valid`,
      'security',
      { metadata: { reason: 'invalid_credentials' } }
    ).catch(() => {});
    return null;
  }

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    // Log locked account access attempt (security event)
    MonitoringLogger.warn(
      `Login blocked: Account locked - ${user.username}`,
      'security',
      { userId: user.id, username: user.username, metadata: { reason: 'account_locked', lockedUntil: user.lockedUntil } }
    ).catch(() => {});
    throw new Error('Account is temporarily locked due to too many failed login attempts');
  }

  // Check if account is active
  if (!user.isActive) {
    // Log inactive account access attempt (security event)
    MonitoringLogger.warn(
      `Login blocked: Inactive account - ${user.username}`,
      'security',
      { userId: user.id, username: user.username, metadata: { reason: 'account_inactive' } }
    ).catch(() => {});
    throw new Error('Account is deactivated');
  }

  // Verify password - NEVER log password-related information
  const isValidPassword = await bcrypt.compare(credentials.password, user.password);
  
  if (!isValidPassword) {
    // Increment failed login attempts
    const newAttempts = (user.failedLoginAttempts || 0) + 1;
    const lockUntil = newAttempts >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCK_TIME) : undefined;
    
    await storage.updateUserLoginAttempts(user.id, newAttempts, lockUntil);
    
    // Log failed password attempt (security event)
    MonitoringLogger.warn(
      `Login failed: Invalid password - ${user.username} (attempt ${newAttempts}/${MAX_LOGIN_ATTEMPTS})`,
      'security',
      { userId: user.id, username: user.username, metadata: { reason: 'invalid_password', attempts: newAttempts, maxAttempts: MAX_LOGIN_ATTEMPTS } }
    ).catch(() => {});
    
    if (lockUntil) {
      // Log account locked (security event)
      MonitoringLogger.error(
        `Account locked due to failed attempts: ${user.username}`,
        undefined,
        'security',
        { userId: user.id, username: user.username, metadata: { lockUntil, attempts: newAttempts } }
      ).catch(() => {});
      throw new Error('Too many failed login attempts. Account locked for 15 minutes.');
    }
    
    return null;
  }

  // Reset failed login attempts on successful login
  if (user.failedLoginAttempts && user.failedLoginAttempts > 0) {
    await storage.updateUserLoginAttempts(user.id, 0);
  }

  // Create session
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION);
  
  await storage.createSession(user.id, sessionId, expiresAt);
  
  // Create session binding for security (if client info provided)
  if (clientInfo?.ip) {
    createSessionBinding(sessionId, clientInfo.ip, clientInfo.userAgent);
  }

  // Secure logging - don't log session ID
  secureLog.auth('User logged in successfully', {
    userId: user.id,
    username: user.username,
    expiresAt: expiresAt.toISOString(),
  });

  // Log successful login to monitoring system (without sensitive session data)
  MonitoringLogger.info(
    `User logged in successfully: ${user.username}`,
    'auth',
    { userId: user.id, username: user.username, metadata: { expiresAt } }
  ).catch(() => {});

  // Log to monitoring system (activity)
  await MonitoringLogger.logActivity({
    userId: user.id,
    username: user.username,
    activityType: 'login',
    action: `User logged in successfully`,
    success: true,
  });

  await MonitoringLogger.logSession(
    user.id,
    user.username,
    sessionId,
    'login'
  );

  return { user, sessionId };
}

// Middleware to check authentication
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const sessionId = req.cookies?.sessionId;
  
  if (!sessionId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const session = await storage.getSession(sessionId);
    
    // Check if session exists
    if (!session) {
      res.clearCookie('sessionId');
      return res.status(401).json({ message: "Session not found" });
    }
    
    // Check if session has expired (absolute expiry)
    if (session.expiresAt < new Date()) {
      secureLog.auth('Session expired', { userId: session.userId });
      await storage.deleteSession(sessionId);
      removeSessionBinding(sessionId);
      res.clearCookie('sessionId');
      return res.status(401).json({ message: "Session expired" });
    }
    
    // Check for idle timeout (no activity for too long)
    if (session.lastActivity && isSessionIdle(session.lastActivity)) {
      const idleTime = Math.round((Date.now() - session.lastActivity.getTime()) / 60000);
      secureLog.auth('Session idle timeout', { userId: session.userId, idleMinutes: idleTime });
      await storage.deleteSession(sessionId);
      removeSessionBinding(sessionId);
      res.clearCookie('sessionId');
      return res.status(401).json({ message: "Session expired due to inactivity" });
    }

    const user = await storage.getUser(session.userId);
    
    if (!user || !user.isActive) {
      await storage.deleteSession(sessionId);
      removeSessionBinding(sessionId);
      res.clearCookie('sessionId');
      return res.status(401).json({ message: "User not found or inactive" });
    }

    // Update last activity timestamp (non-blocking)
    storage.updateSessionActivity(sessionId).catch(err => {
      secureLog.error('Failed to update session activity', err);
    });

    req.user = user;
    req.sessionId = sessionId;
    next();
  } catch (error) {
    secureLog.error('Authentication error', error);
    return res.status(500).json({ message: "Authentication error" });
  }
}

// Middleware to check if user is admin
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

// Middleware to check if user can access their own data or is admin
export function requireOwnershipOrAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const userId = parseInt(req.params.userId || req.params.id);
  
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  if (req.user.role === 'admin' || req.user.id === userId) {
    next();
  } else {
    return res.status(403).json({ message: "Access denied" });
  }
}

// Logout user by deleting session
export async function logoutUser(sessionId: string, user?: User): Promise<void> {
  await storage.deleteSession(sessionId);
  removeSessionBinding(sessionId);
  
  // Secure logging
  if (user) {
    secureLog.auth('User logged out', {
      userId: user.id,
      username: user.username,
    });
    
    MonitoringLogger.info(
      `User logged out: ${user.username}`,
      'auth',
      { userId: user.id, username: user.username }
    ).catch(() => {});
  }
  
  // Log to monitoring system
  if (user) {
    await MonitoringLogger.logActivity({
      userId: user.id,
      username: user.username,
      activityType: 'logout',
      action: `User logged out`,
      success: true,
    });

    await MonitoringLogger.logSession(
      user.id,
      user.username,
      sessionId,
      'logout'
    );
  }
}

// REMOVED: Default admin user auto-creation
// This is a production application that should only work with real database data.
// Users must be created manually via database scripts or admin panel.
export async function createDefaultAdminIfNeeded(): Promise<void> {
  // Function kept for backward compatibility but does nothing
  secureLog.debug('Skipping default admin creation - production mode, database-only');
}