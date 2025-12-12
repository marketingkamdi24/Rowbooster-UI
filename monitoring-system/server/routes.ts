import express, { Request, Response } from 'express';
import { authenticateRBManager, requireAuth } from './auth';
import { pool } from './db';
import session from 'express-session';
import { loginSchema, createUserSchema, updateUserSchema, formatZodErrors, formatZodErrorMessage } from '../shared/schema';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createBackupService, DatabaseBackupService } from './databaseBackupService';

// Initialize the database backup service
let backupService: DatabaseBackupService | null = null;

function getBackupService(): DatabaseBackupService {
  if (!backupService) {
    backupService = createBackupService(pool, process.env.BACKUP_DIR || './backups');
  }
  return backupService;
}

export function registerRoutes(app: express.Application) {
  // Trust Render's proxy for secure cookies
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // Session configuration - 1 hour inactivity timeout with rolling sessions
  // Rolling sessions reset the expiration on each response (user activity)
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'monitoring-system-secret-key-change-in-production',
      resave: true, // Required for rolling sessions to work properly
      saveUninitialized: false,
      rolling: true, // Reset maxAge on every response (activity extends session)
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 60 * 60 * 1000, // 1 hour of inactivity before expiration
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      },
    })
  );

  // Rate limiting for login attempts
  const loginAttempts = new Map<string, { count: number; lastAttempt: number; blockedUntil?: number }>();
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
  const ATTEMPT_WINDOW = 5 * 60 * 1000; // 5 minutes

  const getClientIP = (req: Request): string => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
           req.socket.remoteAddress ||
           'unknown';
  };

  const checkRateLimit = (ip: string): { allowed: boolean; remainingTime?: number } => {
    const now = Date.now();
    const record = loginAttempts.get(ip);
    
    if (!record) {
      return { allowed: true };
    }

    // Check if blocked
    if (record.blockedUntil && now < record.blockedUntil) {
      return {
        allowed: false,
        remainingTime: Math.ceil((record.blockedUntil - now) / 1000 / 60)
      };
    }

    // Reset if outside attempt window
    if (now - record.lastAttempt > ATTEMPT_WINDOW) {
      loginAttempts.delete(ip);
      return { allowed: true };
    }

    return { allowed: true };
  };

  const recordFailedAttempt = (ip: string): void => {
    const now = Date.now();
    const record = loginAttempts.get(ip) || { count: 0, lastAttempt: now };
    
    record.count++;
    record.lastAttempt = now;

    if (record.count >= MAX_LOGIN_ATTEMPTS) {
      record.blockedUntil = now + LOCKOUT_TIME;
      console.warn(`[SECURITY] IP ${ip} blocked for ${LOCKOUT_TIME / 60000} minutes due to ${record.count} failed login attempts`);
    }

    loginAttempts.set(ip, record);
  };

  const clearLoginAttempts = (ip: string): void => {
    loginAttempts.delete(ip);
  };

  // Authentication routes
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const clientIP = getClientIP(req);
    
    // Check rate limit
    const rateLimit = checkRateLimit(clientIP);
    if (!rateLimit.allowed) {
      console.warn(`[SECURITY] Blocked login attempt from ${clientIP} - account locked`);
      return res.status(429).json({
        message: `Too many failed attempts. Please try again in ${rateLimit.remainingTime} minutes.`,
        error: 'RATE_LIMITED'
      });
    }

    try {
      const parseResult = loginSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        // Don't count validation errors against rate limit
        return res.status(400).json({ message: 'Username and password are required' });
      }
      
      const { username, password } = parseResult.data;
      
      // Introduce small delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
      
      const user = await authenticateRBManager(username, password);
      
      if (!user) {
        recordFailedAttempt(clientIP);
        const record = loginAttempts.get(clientIP);
        const remainingAttempts = MAX_LOGIN_ATTEMPTS - (record?.count || 0);
        
        // Generic error message to prevent username enumeration
        return res.status(401).json({
          message: 'Invalid credentials',
          ...(remainingAttempts <= 2 && remainingAttempts > 0 && {
            warning: `${remainingAttempts} attempt(s) remaining before account lockout`
          })
        });
      }

      // Clear failed attempts on successful login
      clearLoginAttempts(clientIP);

      // Regenerate session to prevent session fixation attacks
      req.session.regenerate((err) => {
        if (err) {
          console.error('[MONITORING-API] Session regeneration error:', err);
          return res.status(500).json({ message: 'Session creation failed. Please try again.' });
        }
        
        (req.session as any).user = user;
        
        // Explicitly save session before responding
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('[MONITORING-API] Session save error:', saveErr);
            return res.status(500).json({ message: 'Session save failed. Please try again.' });
          }
          
          console.log('[MONITORING-API] User logged in:', user.username);
          
          res.json({
            message: 'Login successful',
            user: { id: user.id, username: user.username },
          });
        });
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Login error:', error);
      res.status(500).json({ message: 'Authentication service unavailable' });
    }
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const user = (req.session as any)?.user;
    req.session.destroy((err) => {
      if (err) {
        console.error('[MONITORING-API] Logout error:', err);
        return res.status(500).json({ message: 'Logout failed' });
      }
      if (user) {
        console.log(`[MONITORING-API] User ${user.username} logged out`);
      }
      res.json({ message: 'Logout successful' });
    });
  });

  app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
    const user = (req.session as any).user;
    // Only return non-sensitive user information
    res.json({
      user: {
        id: user.id,
        username: user.username
      }
    });
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', requireAuth, async (req: Request, res: Response) => {
    try {
      // Get total users from main app users table
      const totalUsersResult = await pool.query('SELECT COUNT(*) FROM users');
      const totalUsers = parseInt(totalUsersResult.rows[0].count);

      // Get active users (logged in within last 24 hours)
      const activeUsersResult = await pool.query(`
        SELECT COUNT(DISTINCT user_id) 
        FROM user_sessions 
        WHERE is_active = true OR logout_time > NOW() - INTERVAL '24 hours'
      `);
      const activeUsers = parseInt(activeUsersResult.rows[0].count);

      // Get total API calls
      const totalApiCallsResult = await pool.query('SELECT COUNT(*) FROM api_call_logs');
      const totalApiCalls = parseInt(totalApiCallsResult.rows[0].count);

      // Get total tokens
      const totalTokensResult = await pool.query('SELECT SUM(total_tokens) FROM token_usage_logs');
      const totalTokens = parseInt(totalTokensResult.rows[0].sum || 0);

      // Get total cost
      const totalCostResult = await pool.query(`
        SELECT SUM(CAST(total_cost AS DECIMAL)) as total FROM token_usage_logs
      `);
      const totalCost = totalCostResult.rows[0].total || '0';

      // Get total errors
      const totalErrorsResult = await pool.query('SELECT COUNT(*) FROM error_logs');
      const totalErrors = parseInt(totalErrorsResult.rows[0].count);

      // Today's stats
      const todayApiCallsResult = await pool.query(`
        SELECT COUNT(*) FROM api_call_logs 
        WHERE timestamp >= CURRENT_DATE
      `);
      const todayApiCalls = parseInt(todayApiCallsResult.rows[0].count);

      const todayTokensResult = await pool.query(`
        SELECT SUM(total_tokens) FROM token_usage_logs 
        WHERE timestamp >= CURRENT_DATE
      `);
      const todayTokens = parseInt(todayTokensResult.rows[0].sum || 0);

      const todayCostResult = await pool.query(`
        SELECT SUM(CAST(total_cost AS DECIMAL)) as total FROM token_usage_logs 
        WHERE timestamp >= CURRENT_DATE
      `);
      const todayCost = todayCostResult.rows[0].total || '0';

      const todayErrorsResult = await pool.query(`
        SELECT COUNT(*) FROM error_logs 
        WHERE timestamp >= CURRENT_DATE
      `);
      const todayErrors = parseInt(todayErrorsResult.rows[0].count);

      // Recent activity
      const recentActivityResult = await pool.query(`
        SELECT id, username, activity_type, action, timestamp 
        FROM user_activity_logs 
        ORDER BY timestamp DESC 
        LIMIT 20
      `);

      res.json({
        totalUsers,
        activeUsers,
        totalApiCalls,
        totalTokens,
        totalCost: totalCost.toString(),
        totalErrors,
        todayStats: {
          apiCalls: todayApiCalls,
          tokens: todayTokens,
          cost: todayCost.toString(),
          errors: todayErrors,
        },
        recentActivity: recentActivityResult.rows.map(row => ({
          ...row,
          timestamp: row.timestamp.toISOString(),
        })),
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Dashboard stats error:', error);
      res.status(500).json({ message: 'Failed to fetch dashboard stats' });
    }
  });

  // User list
  app.get('/api/users', requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT u.id, u.username, u.email, u.role, u.is_active, u.created_at,
               us.total_api_calls, us.total_tokens_used, us.total_cost, 
               us.total_errors, us.last_activity
        FROM users u
        LEFT JOIN user_statistics us ON u.id = us.user_id
        ORDER BY u.created_at DESC
      `);

      res.json(result.rows.map(row => ({
        ...row,
        created_at: row.created_at?.toISOString(),
        last_activity: row.last_activity?.toISOString(),
      })));
    } catch (error: any) {
      console.error('[MONITORING-API] User list error:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  // User details and activity
  app.get('/api/users/:userId', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);

      // Get user basic info
      const userResult = await pool.query(
        'SELECT id, username, email, role, is_active, created_at, last_login FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = userResult.rows[0];

      // Get user statistics
      const statsResult = await pool.query(
        'SELECT * FROM user_statistics WHERE user_id = $1',
        [userId]
      );
      const stats = statsResult.rows[0] || {
        total_api_calls: 0,
        total_tokens_used: 0,
        total_cost: '0',
        total_errors: 0,
        total_sessions: 0,
      };

      res.json({
        ...user,
        created_at: user.created_at?.toISOString(),
        last_login: user.last_login?.toISOString(),
        statistics: {
          ...stats,
          last_activity: stats.last_activity?.toISOString(),
          first_seen: stats.first_seen?.toISOString(),
          last_updated: stats.last_updated?.toISOString(),
        },
      });
    } catch (error: any) {
      console.error('[MONITORING-API] User details error:', error);
      res.status(500).json({ message: 'Failed to fetch user details' });
    }
  });

  // User activity logs
  app.get('/api/users/:userId/activity', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;

      let query = 'SELECT * FROM user_activity_logs WHERE user_id = $1';
      const params: any[] = [userId];

      if (startDate) {
        params.push(startDate);
        query += ' AND timestamp >= $' + params.length;
      }

      if (endDate) {
        params.push(endDate);
        query += ' AND timestamp <= $' + params.length;
      }

      query += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);

      const result = await pool.query(query, params);

      let countQuery = 'SELECT COUNT(*) FROM user_activity_logs WHERE user_id = $1';
      const countParams: any[] = [userId];
      if (startDate) {
        countParams.push(startDate);
        countQuery += ' AND timestamp >= $' + countParams.length;
      }
      if (endDate) {
        countParams.push(endDate);
        countQuery += ' AND timestamp <= $' + countParams.length;
      }
      const countResult = await pool.query(countQuery, countParams);

      res.json({
        logs: result.rows.map(row => ({
          ...row,
          timestamp: row.timestamp.toISOString(),
        })),
        total: parseInt(countResult.rows[0].count),
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Activity logs error:', error);
      res.status(500).json({ message: 'Failed to fetch activity logs' });
    }
  });

  // User token usage
  app.get('/api/users/:userId/tokens', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;

      let query = 'SELECT * FROM token_usage_logs WHERE user_id = $1';
      const params: any[] = [userId];

      if (startDate) {
        params.push(startDate);
        query += ' AND timestamp >= $' + params.length;
      }

      if (endDate) {
        params.push(endDate);
        query += ' AND timestamp <= $' + params.length;
      }

      query += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);

      const result = await pool.query(query, params);

      let countQuery = 'SELECT COUNT(*) FROM token_usage_logs WHERE user_id = $1';
      const countParams: any[] = [userId];
      if (startDate) {
        countParams.push(startDate);
        countQuery += ' AND timestamp >= $' + countParams.length;
      }
      if (endDate) {
        countParams.push(endDate);
        countQuery += ' AND timestamp <= $' + countParams.length;
      }
      const countResult = await pool.query(countQuery, countParams);

      res.json({
        logs: result.rows.map(row => ({
          ...row,
          timestamp: row.timestamp.toISOString(),
        })),
        total: parseInt(countResult.rows[0].count),
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Token logs error:', error);
      res.status(500).json({ message: 'Failed to fetch token logs' });
    }
  });

  // User API calls
  app.get('/api/users/:userId/api-calls', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;

      let query = 'SELECT * FROM api_call_logs WHERE user_id = $1';
      const params: any[] = [userId];

      if (startDate) {
        params.push(startDate);
        query += ' AND timestamp >= $' + params.length;
      }

      if (endDate) {
        params.push(endDate);
        query += ' AND timestamp <= $' + params.length;
      }

      query += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);

      const result = await pool.query(query, params);

      let countQuery = 'SELECT COUNT(*) FROM api_call_logs WHERE user_id = $1';
      const countParams: any[] = [userId];
      if (startDate) {
        countParams.push(startDate);
        countQuery += ' AND timestamp >= $' + countParams.length;
      }
      if (endDate) {
        countParams.push(endDate);
        countQuery += ' AND timestamp <= $' + countParams.length;
      }
      const countResult = await pool.query(countQuery, countParams);

      res.json({
        logs: result.rows.map(row => ({
          ...row,
          timestamp: row.timestamp.toISOString(),
        })),
        total: parseInt(countResult.rows[0].count),
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] API call logs error:', error);
      res.status(500).json({ message: 'Failed to fetch API call logs' });
    }
  });

  // User errors
  app.get('/api/users/:userId/errors', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;

      let query = 'SELECT * FROM error_logs WHERE user_id = $1';
      const params: any[] = [userId];

      if (startDate) {
        params.push(startDate);
        query += ' AND timestamp >= $' + params.length;
      }

      if (endDate) {
        params.push(endDate);
        query += ' AND timestamp <= $' + params.length;
      }

      query += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);

      const result = await pool.query(query, params);

      let countQuery = 'SELECT COUNT(*) FROM error_logs WHERE user_id = $1';
      const countParams: any[] = [userId];
      if (startDate) {
        countParams.push(startDate);
        countQuery += ' AND timestamp >= $' + countParams.length;
      }
      if (endDate) {
        countParams.push(endDate);
        countQuery += ' AND timestamp <= $' + countParams.length;
      }
      const countResult = await pool.query(countQuery, countParams);

      res.json({
        logs: result.rows.map(row => ({
          ...row,
          timestamp: row.timestamp.toISOString(),
        })),
        total: parseInt(countResult.rows[0].count),
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Error logs error:', error);
      res.status(500).json({ message: 'Failed to fetch error logs' });
    }
  });

  // All activity logs (for overview)
  app.get('/api/activity', requireAuth, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const activityType = req.query.activity_type as string;
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;

      let query = 'SELECT * FROM user_activity_logs WHERE 1=1';
      const params: any[] = [];
      
      if (activityType) {
        params.push(activityType);
        query += ' AND activity_type = $' + params.length;
      }

      if (startDate) {
        params.push(startDate);
        query += ' AND timestamp >= $' + params.length;
      }

      if (endDate) {
        params.push(endDate);
        query += ' AND timestamp <= $' + params.length;
      }
      
      query += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);

      const result = await pool.query(query, params);

      let countQuery = 'SELECT COUNT(*) FROM user_activity_logs WHERE 1=1';
      const countParams: any[] = [];
      if (activityType) {
        countParams.push(activityType);
        countQuery += ' AND activity_type = $' + countParams.length;
      }
      if (startDate) {
        countParams.push(startDate);
        countQuery += ' AND timestamp >= $' + countParams.length;
      }
      if (endDate) {
        countParams.push(endDate);
        countQuery += ' AND timestamp <= $' + countParams.length;
      }
      const countResult = await pool.query(countQuery, countParams);

      res.json({
        logs: result.rows.map(row => ({
          ...row,
          timestamp: row.timestamp.toISOString(),
        })),
        total: parseInt(countResult.rows[0].count),
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] All activity logs error:', error);
      res.status(500).json({ message: 'Failed to fetch activity logs' });
    }
  });

  // All errors (for overview)
  app.get('/api/errors', requireAuth, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const severity = req.query.severity as string;
      const resolved = req.query.resolved as string;
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;

      let query = 'SELECT * FROM error_logs WHERE 1=1';
      const params: any[] = [];
      
      if (severity) {
        params.push(severity);
        query += ' AND severity = $' + params.length;
      }
      
      if (resolved !== undefined) {
        params.push(resolved === 'true');
        query += ' AND resolved = $' + params.length;
      }

      if (startDate) {
        params.push(startDate);
        query += ' AND timestamp >= $' + params.length;
      }

      if (endDate) {
        params.push(endDate);
        query += ' AND timestamp <= $' + params.length;
      }
      
      query += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);

      const result = await pool.query(query, params);

      let countQuery = 'SELECT COUNT(*) FROM error_logs WHERE 1=1';
      const countParams: any[] = [];
      if (severity) {
        countParams.push(severity);
        countQuery += ' AND severity = $' + countParams.length;
      }
      if (resolved !== undefined) {
        countParams.push(resolved === 'true');
        countQuery += ' AND resolved = $' + countParams.length;
      }
      if (startDate) {
        countParams.push(startDate);
        countQuery += ' AND timestamp >= $' + countParams.length;
      }
      if (endDate) {
        countParams.push(endDate);
        countQuery += ' AND timestamp <= $' + countParams.length;
      }
      const countResult = await pool.query(countQuery, countParams);

      res.json({
        logs: result.rows.map(row => ({
          ...row,
          timestamp: row.timestamp.toISOString(),
        })),
        total: parseInt(countResult.rows[0].count),
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] All errors logs error:', error);
      res.status(500).json({ message: 'Failed to fetch error logs' });
    }
  });

  // Mark error as resolved
  app.patch('/api/errors/:errorId/resolve', requireAuth, async (req: Request, res: Response) => {
    try {
      const errorId = parseInt(req.params.errorId);
      
      await pool.query(
        'UPDATE error_logs SET resolved = true WHERE id = $1',
        [errorId]
      );

      res.json({ message: 'Error marked as resolved' });
    } catch (error: any) {
      console.error('[MONITORING-API] Resolve error error:', error);
      res.status(500).json({ message: 'Failed to resolve error' });
    }
  });

  // System metrics
  app.get('/api/metrics', requireAuth, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const metricType = req.query.metric_type as string;

      let query = 'SELECT * FROM system_metrics';
      const params: any[] = [];
      
      if (metricType) {
        query += ' WHERE metric_type = $1';
        params.push(metricType);
      }
      
      query += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1);
      params.push(limit);

      const result = await pool.query(query, params);

      res.json(result.rows.map(row => ({
        ...row,
        timestamp: row.timestamp.toISOString(),
      })));
    } catch (error: any) {
      console.error('[MONITORING-API] System metrics error:', error);
      res.status(500).json({ message: 'Failed to fetch system metrics' });
    }
  });

  // User Management CRUD Operations (RBManager only)
  
  // Create new user
  app.post('/api/users', requireAuth, async (req: Request, res: Response) => {
    try {
      // Validate request body
      const parseResult = createUserSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        const formattedErrors = formatZodErrors(parseResult.error);
        const errorMessage = formatZodErrorMessage(parseResult.error);
        console.error('[MONITORING-API] Create user validation error:', errorMessage);
        return res.status(400).json({
          message: `Validation failed: ${errorMessage}`,
          errors: formattedErrors
        });
      }
      
      const userData = parseResult.data;
      
      // Check if username already exists
      const existingUsername = await pool.query(
        'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
        [userData.username]
      );

      if (existingUsername.rows.length > 0) {
        return res.status(400).json({
          message: 'Username already exists. Please choose a different username.',
          errors: [{ field: 'username', message: 'Username is already taken' }]
        });
      }

      // Check if email already exists
      const existingEmail = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
        [userData.email]
      );

      if (existingEmail.rows.length > 0) {
        return res.status(400).json({
          message: 'Email address already exists. Please use a different email.',
          errors: [{ field: 'email', message: 'Email is already registered' }]
        });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Insert new user
      const result = await pool.query(
        `INSERT INTO users (username, email, password, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id, username, email, role, is_active, created_at`,
        [userData.username, userData.email, hashedPassword, userData.role, userData.isActive]
      );

      const newUser = result.rows[0];

      console.log('[MONITORING-API] User created:', newUser.username);
      
      res.status(201).json({
        message: 'User created successfully',
        user: {
          ...newUser,
          created_at: newUser.created_at?.toISOString(),
        }
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Create user error:', error);
      
      // Handle PostgreSQL unique constraint violations
      if (error.code === '23505') {
        if (error.constraint?.includes('username')) {
          return res.status(400).json({
            message: 'Username already exists. Please choose a different username.',
            errors: [{ field: 'username', message: 'Username is already taken' }]
          });
        }
        if (error.constraint?.includes('email')) {
          return res.status(400).json({
            message: 'Email address already exists. Please use a different email.',
            errors: [{ field: 'email', message: 'Email is already registered' }]
          });
        }
        return res.status(400).json({
          message: 'A user with this information already exists.',
          errors: [{ field: '_form', message: 'Duplicate entry detected' }]
        });
      }
      
      res.status(500).json({
        message: 'Failed to create user. Please try again later.',
        errors: [{ field: '_form', message: 'Internal server error' }]
      });
    }
  });

  // Update user
  app.patch('/api/users/:userId', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Validate userId
      if (isNaN(userId) || userId <= 0) {
        return res.status(400).json({
          message: 'Invalid user ID provided.',
          errors: [{ field: 'userId', message: 'User ID must be a positive number' }]
        });
      }

      // Validate request body
      const parseResult = updateUserSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        const formattedErrors = formatZodErrors(parseResult.error);
        const errorMessage = formatZodErrorMessage(parseResult.error);
        console.error('[MONITORING-API] Update user validation error:', errorMessage);
        return res.status(400).json({
          message: `Validation failed: ${errorMessage}`,
          errors: formattedErrors
        });
      }
      
      const updateData = parseResult.data;

      // Check if user exists
      const existingUser = await pool.query(
        'SELECT id, username, email FROM users WHERE id = $1',
        [userId]
      );

      if (existingUser.rows.length === 0) {
        return res.status(404).json({
          message: `User with ID ${userId} not found.`,
          errors: [{ field: 'userId', message: 'User does not exist' }]
        });
      }

      const currentUser = existingUser.rows[0];

      // Check for duplicate username if being updated (case-insensitive)
      if (updateData.username && updateData.username.toLowerCase() !== currentUser.username.toLowerCase()) {
        const duplicateUsername = await pool.query(
          'SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2',
          [updateData.username, userId]
        );

        if (duplicateUsername.rows.length > 0) {
          return res.status(400).json({
            message: 'Username already exists. Please choose a different username.',
            errors: [{ field: 'username', message: 'Username is already taken by another user' }]
          });
        }
      }

      // Check for duplicate email if being updated (case-insensitive)
      if (updateData.email && updateData.email.toLowerCase() !== currentUser.email?.toLowerCase()) {
        const duplicateEmail = await pool.query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2',
          [updateData.email, userId]
        );

        if (duplicateEmail.rows.length > 0) {
          return res.status(400).json({
            message: 'Email address already exists. Please use a different email.',
            errors: [{ field: 'email', message: 'Email is already registered to another user' }]
          });
        }
      }

      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updateData.username !== undefined) {
        updates.push(`username = $${paramCount++}`);
        values.push(updateData.username);
      }
      if (updateData.email !== undefined) {
        updates.push(`email = $${paramCount++}`);
        values.push(updateData.email);
      }
      if (updateData.password !== undefined) {
        const hashedPassword = await bcrypt.hash(updateData.password, 10);
        updates.push(`password = $${paramCount++}`);
        values.push(hashedPassword);
      }
      if (updateData.role !== undefined) {
        updates.push(`role = $${paramCount++}`);
        values.push(updateData.role);
      }
      if (updateData.isActive !== undefined) {
        updates.push(`is_active = $${paramCount++}`);
        values.push(updateData.isActive);
      }

      // If no fields to update (shouldn't happen due to schema validation, but safety check)
      if (updates.length === 0) {
        return res.status(400).json({
          message: 'No valid fields provided for update.',
          errors: [{ field: '_form', message: 'At least one field must be provided' }]
        });
      }

      updates.push(`updated_at = NOW()`);
      values.push(userId);

      const query = `
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, username, email, role, is_active, updated_at
      `;

      const result = await pool.query(query, values);
      const updatedUser = result.rows[0];

      console.log('[MONITORING-API] User updated:', updatedUser.username);

      res.json({
        message: 'User updated successfully',
        user: {
          ...updatedUser,
          updated_at: updatedUser.updated_at?.toISOString(),
        }
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Update user error:', error);
      
      // Handle PostgreSQL unique constraint violations
      if (error.code === '23505') {
        if (error.constraint?.includes('username')) {
          return res.status(400).json({
            message: 'Username already exists. Please choose a different username.',
            errors: [{ field: 'username', message: 'Username is already taken' }]
          });
        }
        if (error.constraint?.includes('email')) {
          return res.status(400).json({
            message: 'Email address already exists. Please use a different email.',
            errors: [{ field: 'email', message: 'Email is already registered' }]
          });
        }
        return res.status(400).json({
          message: 'A user with this information already exists.',
          errors: [{ field: '_form', message: 'Duplicate entry detected' }]
        });
      }
      
      res.status(500).json({
        message: 'Failed to update user. Please try again later.',
        errors: [{ field: '_form', message: 'Internal server error' }]
      });
    }
  });

  // Delete user
  app.delete('/api/users/:userId', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);

      // Check if user exists
      const existingUser = await pool.query(
        'SELECT id, username FROM users WHERE id = $1',
        [userId]
      );

      if (existingUser.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Delete user (cascade will handle related records)
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);

      console.log('[MONITORING-API] User deleted:', existingUser.rows[0].username);

      res.json({
        message: 'User deleted successfully',
        username: existingUser.rows[0].username
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Delete user error:', error);
      res.status(500).json({ message: 'Failed to delete user' });
    }
  });

  // ==========================================
  // CONSOLE LOGS ENDPOINTS
  // ==========================================

  // Get all console logs (system-wide)
  app.get('/api/console-logs', requireAuth, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const logLevel = req.query.log_level as string;
      const category = req.query.category as string;
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;

      let query = 'SELECT * FROM console_logs WHERE 1=1';
      const params: any[] = [];
      
      if (logLevel) {
        params.push(logLevel);
        query += ' AND log_level = $' + params.length;
      }
      
      if (category) {
        params.push(category);
        query += ' AND category = $' + params.length;
      }

      if (startDate) {
        params.push(startDate);
        query += ' AND timestamp >= $' + params.length;
      }

      if (endDate) {
        params.push(endDate);
        query += ' AND timestamp <= $' + params.length;
      }
      
      query += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM console_logs WHERE 1=1';
      const countParams: any[] = [];
      if (logLevel) {
        countParams.push(logLevel);
        countQuery += ' AND log_level = $' + countParams.length;
      }
      if (category) {
        countParams.push(category);
        countQuery += ' AND category = $' + countParams.length;
      }
      if (startDate) {
        countParams.push(startDate);
        countQuery += ' AND timestamp >= $' + countParams.length;
      }
      if (endDate) {
        countParams.push(endDate);
        countQuery += ' AND timestamp <= $' + countParams.length;
      }
      const countResult = await pool.query(countQuery, countParams);

      res.json({
        logs: result.rows.map(row => ({
          ...row,
          timestamp: row.timestamp.toISOString(),
        })),
        total: parseInt(countResult.rows[0].count),
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Console logs error:', error);
      res.status(500).json({ message: 'Failed to fetch console logs' });
    }
  });

  // Get scraped data logs for a specific user
  app.get('/api/users/:userId/scraped-data', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;

      let query = `
        SELECT id, user_id, username, log_level, category, message, metadata, timestamp
        FROM console_logs
        WHERE user_id = $1 AND source = 'scraped-data'
      `;
      const params: any[] = [userId];
      
      if (startDate) {
        params.push(startDate);
        query += ' AND timestamp >= $' + params.length;
      }

      if (endDate) {
        params.push(endDate);
        query += ' AND timestamp <= $' + params.length;
      }
      
      query += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) FROM console_logs
        WHERE user_id = $1 AND source = 'scraped-data'
      `;
      const countParams: any[] = [userId];
      if (startDate) {
        countParams.push(startDate);
        countQuery += ' AND timestamp >= $' + countParams.length;
      }
      if (endDate) {
        countParams.push(endDate);
        countQuery += ' AND timestamp <= $' + countParams.length;
      }
      const countResult = await pool.query(countQuery, countParams);

      // Parse metadata JSON for each log
      const logs = result.rows.map(row => {
        let parsedMetadata = null;
        try {
          if (row.metadata) {
            parsedMetadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
          }
        } catch {}
        
        return {
          ...row,
          timestamp: row.timestamp.toISOString(),
          metadata: parsedMetadata,
        };
      });

      res.json({
        logs,
        total: parseInt(countResult.rows[0].count),
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Scraped data logs error:', error);
      res.status(500).json({ message: 'Failed to fetch scraped data logs' });
    }
  });

  // Get AI API call logs for a specific user
  app.get('/api/users/:userId/ai-calls', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;

      let query = `
        SELECT id, user_id, username, log_level, category, message, metadata, timestamp
        FROM console_logs
        WHERE user_id = $1 AND source = 'ai-api-call'
      `;
      const params: any[] = [userId];
      
      if (startDate) {
        params.push(startDate);
        query += ' AND timestamp >= $' + params.length;
      }

      if (endDate) {
        params.push(endDate);
        query += ' AND timestamp <= $' + params.length;
      }
      
      query += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) FROM console_logs
        WHERE user_id = $1 AND source = 'ai-api-call'
      `;
      const countParams: any[] = [userId];
      if (startDate) {
        countParams.push(startDate);
        countQuery += ' AND timestamp >= $' + countParams.length;
      }
      if (endDate) {
        countParams.push(endDate);
        countQuery += ' AND timestamp <= $' + countParams.length;
      }
      const countResult = await pool.query(countQuery, countParams);

      // Parse metadata JSON for each log
      const logs = result.rows.map(row => {
        let parsedMetadata = null;
        try {
          if (row.metadata) {
            parsedMetadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
          }
        } catch {}
        
        return {
          ...row,
          timestamp: row.timestamp.toISOString(),
          metadata: parsedMetadata,
        };
      });

      res.json({
        logs,
        total: parseInt(countResult.rows[0].count),
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] AI call logs error:', error);
      res.status(500).json({ message: 'Failed to fetch AI call logs' });
    }
  });

  // Get console logs for a specific user
  app.get('/api/users/:userId/console-logs', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const logLevel = req.query.log_level as string;
      const category = req.query.category as string;
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;

      let query = 'SELECT * FROM console_logs WHERE user_id = $1';
      const params: any[] = [userId];
      
      if (logLevel) {
        params.push(logLevel);
        query += ' AND log_level = $' + params.length;
      }
      
      if (category) {
        params.push(category);
        query += ' AND category = $' + params.length;
      }

      if (startDate) {
        params.push(startDate);
        query += ' AND timestamp >= $' + params.length;
      }

      if (endDate) {
        params.push(endDate);
        query += ' AND timestamp <= $' + params.length;
      }
      
      query += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM console_logs WHERE user_id = $1';
      const countParams: any[] = [userId];
      if (logLevel) {
        countParams.push(logLevel);
        countQuery += ' AND log_level = $' + countParams.length;
      }
      if (category) {
        countParams.push(category);
        countQuery += ' AND category = $' + countParams.length;
      }
      if (startDate) {
        countParams.push(startDate);
        countQuery += ' AND timestamp >= $' + countParams.length;
      }
      if (endDate) {
        countParams.push(endDate);
        countQuery += ' AND timestamp <= $' + countParams.length;
      }
      const countResult = await pool.query(countQuery, countParams);

      res.json({
        logs: result.rows.map(row => ({
          ...row,
          timestamp: row.timestamp.toISOString(),
        })),
        total: parseInt(countResult.rows[0].count),
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] User console logs error:', error);
      res.status(500).json({ message: 'Failed to fetch user console logs' });
    }
  });

  // Get console log statistics
  app.get('/api/console-logs/stats', requireAuth, async (req: Request, res: Response) => {
    try {
      // Get counts by log level
      const levelStatsResult = await pool.query(`
        SELECT log_level, COUNT(*) as count
        FROM console_logs
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
        GROUP BY log_level
        ORDER BY count DESC
      `);

      // Get counts by category
      const categoryStatsResult = await pool.query(`
        SELECT category, COUNT(*) as count
        FROM console_logs
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
        GROUP BY category
        ORDER BY count DESC
      `);

      // Get error count trend (last 7 days)
      const errorTrendResult = await pool.query(`
        SELECT DATE(timestamp) as date, COUNT(*) as count
        FROM console_logs
        WHERE log_level IN ('error', 'fatal') AND timestamp >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
      `);

      // Get recent critical logs
      const criticalLogsResult = await pool.query(`
        SELECT id, user_id, username, log_level, category, message, timestamp
        FROM console_logs
        WHERE log_level IN ('error', 'fatal')
        ORDER BY timestamp DESC
        LIMIT 10
      `);

      res.json({
        byLevel: levelStatsResult.rows,
        byCategory: categoryStatsResult.rows,
        errorTrend: errorTrendResult.rows.map(row => ({
          date: row.date.toISOString().split('T')[0],
          count: parseInt(row.count),
        })),
        recentCritical: criticalLogsResult.rows.map(row => ({
          ...row,
          timestamp: row.timestamp.toISOString(),
        })),
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Console logs stats error:', error);
      res.status(500).json({ message: 'Failed to fetch console logs statistics' });
    }
  });

  // ==========================================
  // HEALTH CHECK ENDPOINTS
  // ==========================================

  // Public health check endpoint (no auth required)
  app.get('/api/health', async (req: Request, res: Response) => {
    try {
      const startTime = Date.now();
      
      // Check database connection
      let dbStatus: 'healthy' | 'unhealthy' = 'unhealthy';
      let dbResponseTime = 0;
      try {
        const dbStart = Date.now();
        await pool.query('SELECT 1');
        dbResponseTime = Date.now() - dbStart;
        dbStatus = dbResponseTime < 1000 ? 'healthy' : 'unhealthy';
      } catch (dbError) {
        console.error('[HEALTH] Database check failed:', dbError);
      }

      // Get uptime
      const uptime = process.uptime();

      // Get memory usage
      const memoryUsage = process.memoryUsage();

      const healthData = {
        status: dbStatus,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(uptime),
        uptimeFormatted: formatUptime(uptime),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        components: {
          database: {
            status: dbStatus,
            responseTime: dbResponseTime,
          },
          api: {
            status: 'healthy',
            responseTime: Date.now() - startTime,
          },
        },
        memory: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
        },
      };

      // Store health check result
      try {
        await pool.query(
          `INSERT INTO system_health (component, status, message, response_time, details)
           VALUES ($1, $2, $3, $4, $5)`,
          ['api', dbStatus, 'Health check completed', Date.now() - startTime, JSON.stringify(healthData)]
        );
      } catch (storeError) {
        console.error('[HEALTH] Failed to store health check:', storeError);
      }

      const statusCode = dbStatus === 'healthy' ? 200 : 503;
      res.status(statusCode).json(healthData);
    } catch (error: any) {
      console.error('[HEALTH] Health check error:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  });

  // Detailed health check (auth required)
  app.get('/api/health/detailed', requireAuth, async (req: Request, res: Response) => {
    try {
      // Get latest health status for all components
      const healthResult = await pool.query(`
        SELECT DISTINCT ON (component)
          component, status, message, response_time, details, checked_at
        FROM system_health
        ORDER BY component, checked_at DESC
      `);

      // Get system metrics
      const metricsResult = await pool.query(`
        SELECT metric_type, metric_value, unit, timestamp
        FROM system_metrics
        WHERE timestamp >= NOW() - INTERVAL '1 hour'
        ORDER BY timestamp DESC
        LIMIT 100
      `);

      // Get error count last 24h
      const errorCountResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM error_logs
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
      `);

      // Get active users
      const activeUsersResult = await pool.query(`
        SELECT COUNT(DISTINCT user_id) as count
        FROM user_sessions
        WHERE is_active = true
      `);

      res.json({
        components: healthResult.rows.map(row => ({
          ...row,
          checked_at: row.checked_at.toISOString(),
        })),
        metrics: metricsResult.rows.map(row => ({
          ...row,
          timestamp: row.timestamp.toISOString(),
        })),
        statistics: {
          errorsLast24h: parseInt(errorCountResult.rows[0].count),
          activeUsers: parseInt(activeUsersResult.rows[0].count),
        },
        serverInfo: {
          uptime: process.uptime(),
          nodeVersion: process.version,
          platform: process.platform,
          memoryUsage: process.memoryUsage(),
        },
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Detailed health check error:', error);
      res.status(500).json({ message: 'Failed to fetch detailed health status' });
    }
  });

  // Get system health history
  app.get('/api/health/history', requireAuth, async (req: Request, res: Response) => {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const component = req.query.component as string;

      let query = `
        SELECT component, status, message, response_time, checked_at
        FROM system_health
        WHERE checked_at >= NOW() - INTERVAL '${hours} hours'
      `;
      const params: any[] = [];

      if (component) {
        params.push(component);
        query += ' AND component = $' + params.length;
      }

      query += ' ORDER BY checked_at DESC LIMIT 1000';

      const result = await pool.query(query, params);

      res.json({
        history: result.rows.map(row => ({
          ...row,
          checked_at: row.checked_at.toISOString(),
        })),
        hours,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Health history error:', error);
      res.status(500).json({ message: 'Failed to fetch health history' });
    }
  });

  // ==========================================
  // BACKUP MANAGEMENT ENDPOINTS
  // ==========================================

  // Get backup status and history
  app.get('/api/system/backups', requireAuth, async (req: Request, res: Response) => {
    try {
      const service = getBackupService();
      const backups = await service.listBackups();
      
      const backupDir = process.env.BACKUP_DIR || './backups';
      const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
      
      // Get backup configuration
      const config = {
        backupDir,
        retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
        autoBackupEnabled: process.env.AUTO_BACKUP_ENABLED !== 'false',
        backupSchedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // Default 2 AM daily
        lastBackup: backups[0]?.createdAt || null,
      };

      res.json({
        backups: backups.map(b => ({
          ...b,
          compressed: b.filename.endsWith('.gz'),
          // Parse timestamp from filename
          timestamp: b.metadata?.timestampISO || b.createdAt,
          isComplete: b.isComplete,
          tableCount: b.metadata?.tables?.length || 0,
          totalRows: b.metadata?.totalRows || 0,
        })),
        totalBackups: backups.length,
        totalSize,
        totalSizeFormatted: formatBytes(totalSize),
        config,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Get backups error:', error);
      res.status(500).json({ message: 'Failed to fetch backup information' });
    }
  });

  // Create manual backup - NOW USES COMPLETE JSON BACKUP
  app.post('/api/system/backups', requireAuth, async (req: Request, res: Response) => {
    try {
      const service = getBackupService();
      
      console.log('[MONITORING-API] Creating complete database backup...');
      
      const result = await service.createCompleteBackup();
      
      console.log('[MONITORING-API] Backup created successfully:', result.filename);
      
      // Get file size
      const fs = await import('fs').then(m => m.promises);
      const path = await import('path');
      const backupDir = process.env.BACKUP_DIR || './backups';
      const filepath = path.join(backupDir, result.filename);
      const stat = await fs.stat(filepath);
      
      res.json({
        message: 'Complete backup created successfully',
        backup: {
          filename: result.filename,
          size: stat.size,
          sizeFormatted: formatBytes(stat.size),
          createdAt: result.backup.metadata.timestampISO,
          isComplete: true,
          tableCount: result.backup.metadata.tables.length,
          totalRows: result.backup.metadata.totalRows,
          tables: result.backup.metadata.tables,
        },
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Create backup error:', error);
      res.status(500).json({ message: 'Failed to create backup', error: error.message });
    }
  });

  // Download/view a backup
  app.get('/api/system/backups/:filename/download', requireAuth, async (req: Request, res: Response) => {
    try {
      const fs = await import('fs').then(m => m.promises);
      const fsSync = await import('fs');
      const path = await import('path');
      
      const { filename } = req.params;
      const backupDir = process.env.BACKUP_DIR || './backups';
      
      // Validate filename to prevent path traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ message: 'Invalid filename' });
      }
      
      const filepath = path.join(backupDir, filename);
      
      // Check if file exists
      try {
        await fs.access(filepath);
      } catch {
        return res.status(404).json({ message: 'Backup file not found' });
      }
      
      const stat = await fs.stat(filepath);
      
      res.setHeader('Content-Type', 'application/sql');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', stat.size);
      
      const fileStream = fsSync.createReadStream(filepath);
      fileStream.pipe(res);
    } catch (error: any) {
      console.error('[MONITORING-API] Download backup error:', error);
      res.status(500).json({ message: 'Failed to download backup' });
    }
  });

  // Preview backup content - enhanced for JSON backups
  app.get('/api/system/backups/:filename/preview', requireAuth, async (req: Request, res: Response) => {
    try {
      const { filename } = req.params;
      
      // Validate filename to prevent path traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ message: 'Invalid filename' });
      }
      
      const service = getBackupService();
      const details = await service.getBackupDetails(filename);
      
      if (!details) {
        return res.status(404).json({ message: 'Backup file not found' });
      }
      
      res.json({
        filename,
        metadata: details.metadata,
        tablesSummary: details.tablesSummary,
        preview: details.preview?.slice(0, 50000), // Max 50KB preview
        isComplete: details.metadata?.backupType === 'complete',
        backupDate: details.metadata?.timestampISO,
        totalRows: details.metadata?.totalRows || 0,
        tableCount: details.metadata?.tables?.length || 0,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Preview backup error:', error);
      res.status(500).json({ message: 'Failed to preview backup' });
    }
  });

  // Delete a backup
  app.delete('/api/system/backups/:filename', requireAuth, async (req: Request, res: Response) => {
    try {
      const { filename } = req.params;
      
      // Validate filename to prevent path traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ message: 'Invalid filename' });
      }
      
      const service = getBackupService();
      const success = await service.deleteBackup(filename);
      
      if (success) {
        console.log('[MONITORING-API] Backup deleted:', filename);
        res.json({ message: 'Backup deleted successfully', filename });
      } else {
        res.status(404).json({ message: 'Backup file not found' });
      }
    } catch (error: any) {
      console.error('[MONITORING-API] Delete backup error:', error);
      res.status(500).json({ message: 'Failed to delete backup' });
    }
  });

  // Cleanup old backups
  app.post('/api/system/backups/cleanup', requireAuth, async (req: Request, res: Response) => {
    try {
      const fs = await import('fs').then(m => m.promises);
      const path = await import('path');
      
      const backupDir = process.env.BACKUP_DIR || './backups';
      const retentionDays = parseInt(req.body.retentionDays || process.env.BACKUP_RETENTION_DAYS || '30');
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      
      let deletedCount = 0;
      let deletedSize = 0;
      
      try {
        const files = await fs.readdir(backupDir);
        const backupFiles = files.filter(f => f.endsWith('.sql') || f.endsWith('.sql.gz'));
        
        for (const file of backupFiles) {
          const filepath = path.join(backupDir, file);
          const stat = await fs.stat(filepath);
          
          if (stat.birthtime < cutoffDate) {
            await fs.unlink(filepath);
            deletedCount++;
            deletedSize += stat.size;
            console.log('[MONITORING-API] Deleted old backup:', file);
          }
        }
      } catch (dirError) {
        // Backup directory doesn't exist
      }
      
      res.json({
        message: `Cleanup completed. Deleted ${deletedCount} backups.`,
        deletedCount,
        deletedSize,
        deletedSizeFormatted: formatBytes(deletedSize),
        retentionDays,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Cleanup backups error:', error);
      res.status(500).json({ message: 'Failed to cleanup backups' });
    }
  });

  // ==========================================
  // DATA INTEGRITY ENDPOINTS
  // ==========================================

  // Get database integrity status
  app.get('/api/system/integrity', requireAuth, async (req: Request, res: Response) => {
    try {
      // Get table information
      const tablesResult = await pool.query(`
        SELECT
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as size,
          pg_total_relation_size(schemaname || '.' || tablename) as size_bytes
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
      `);

      // Get row counts for each table
      const rowCountQueries = tablesResult.rows.map(async (table) => {
        try {
          const countResult = await pool.query(`SELECT COUNT(*) FROM "${table.tablename}"`);
          return {
            ...table,
            rowCount: parseInt(countResult.rows[0].count),
          };
        } catch {
          return { ...table, rowCount: 0 };
        }
      });
      const tables = await Promise.all(rowCountQueries);

      // Get foreign key constraints
      const fkResult = await pool.query(`
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name
      `);

      // Get indexes
      const indexResult = await pool.query(`
        SELECT
          tablename,
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
      `);

      // Check for orphaned records (referential integrity issues)
      const integrityIssues: any[] = [];
      
      // Check user_sessions for orphaned records
      try {
        const orphanedSessions = await pool.query(`
          SELECT COUNT(*) FROM user_sessions us
          LEFT JOIN users u ON us.user_id = u.id
          WHERE u.id IS NULL
        `);
        if (parseInt(orphanedSessions.rows[0].count) > 0) {
          integrityIssues.push({
            type: 'orphaned_records',
            table: 'user_sessions',
            description: `${orphanedSessions.rows[0].count} sessions without valid user`,
            severity: 'warning'
          });
        }
      } catch {}

      // Check api_call_logs for orphaned records
      try {
        const orphanedApiCalls = await pool.query(`
          SELECT COUNT(*) FROM api_call_logs acl
          LEFT JOIN users u ON acl.user_id = u.id
          WHERE acl.user_id IS NOT NULL AND u.id IS NULL
        `);
        if (parseInt(orphanedApiCalls.rows[0].count) > 0) {
          integrityIssues.push({
            type: 'orphaned_records',
            table: 'api_call_logs',
            description: `${orphanedApiCalls.rows[0].count} API logs without valid user`,
            severity: 'warning'
          });
        }
      } catch {}

      // Get database size
      const dbSizeResult = await pool.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size,
               pg_database_size(current_database()) as size_bytes
      `);

      // Get connection info
      const connectionResult = await pool.query(`
        SELECT
          numbackends as active_connections,
          xact_commit as transactions_committed,
          xact_rollback as transactions_rolled_back,
          blks_read as blocks_read,
          blks_hit as blocks_hit,
          tup_returned as tuples_returned,
          tup_fetched as tuples_fetched,
          tup_inserted as tuples_inserted,
          tup_updated as tuples_updated,
          tup_deleted as tuples_deleted
        FROM pg_stat_database
        WHERE datname = current_database()
      `);

      res.json({
        database: {
          size: dbSizeResult.rows[0].size,
          sizeBytes: parseInt(dbSizeResult.rows[0].size_bytes),
          ...connectionResult.rows[0],
        },
        tables,
        foreignKeys: fkResult.rows,
        indexes: indexResult.rows,
        integrityIssues,
        status: integrityIssues.length === 0 ? 'healthy' : 'needs_attention',
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Get integrity status error:', error);
      res.status(500).json({ message: 'Failed to fetch integrity status' });
    }
  });

  // Run database validation
  app.post('/api/system/integrity/validate', requireAuth, async (req: Request, res: Response) => {
    try {
      const validationResults: any[] = [];

      // Check for NULL values in required columns
      const requiredColumns = [
        { table: 'users', column: 'username' },
        { table: 'users', column: 'email' },
        { table: 'users', column: 'password' },
      ];

      for (const { table, column } of requiredColumns) {
        try {
          const result = await pool.query(`SELECT COUNT(*) FROM ${table} WHERE ${column} IS NULL`);
          const count = parseInt(result.rows[0].count);
          validationResults.push({
            check: `NOT NULL: ${table}.${column}`,
            passed: count === 0,
            issues: count,
          });
        } catch {}
      }

      // Check for duplicate usernames (case-insensitive)
      try {
        const duplicates = await pool.query(`
          SELECT LOWER(username) as username, COUNT(*)
          FROM users
          GROUP BY LOWER(username)
          HAVING COUNT(*) > 1
        `);
        validationResults.push({
          check: 'UNIQUE: users.username',
          passed: duplicates.rows.length === 0,
          issues: duplicates.rows.length,
        });
      } catch {}

      // Check for duplicate emails (case-insensitive)
      try {
        const duplicates = await pool.query(`
          SELECT LOWER(email) as email, COUNT(*)
          FROM users
          WHERE email IS NOT NULL
          GROUP BY LOWER(email)
          HAVING COUNT(*) > 1
        `);
        validationResults.push({
          check: 'UNIQUE: users.email',
          passed: duplicates.rows.length === 0,
          issues: duplicates.rows.length,
        });
      } catch {}

      // Check foreign key integrity
      const fkChecks = [
        { table: 'user_sessions', column: 'user_id', refTable: 'users', refColumn: 'id' },
        { table: 'api_call_logs', column: 'user_id', refTable: 'users', refColumn: 'id' },
        { table: 'token_usage_logs', column: 'user_id', refTable: 'users', refColumn: 'id' },
        { table: 'error_logs', column: 'user_id', refTable: 'users', refColumn: 'id' },
      ];

      for (const { table, column, refTable, refColumn } of fkChecks) {
        try {
          const result = await pool.query(`
            SELECT COUNT(*) FROM ${table} t
            LEFT JOIN ${refTable} r ON t.${column} = r.${refColumn}
            WHERE t.${column} IS NOT NULL AND r.${refColumn} IS NULL
          `);
          const count = parseInt(result.rows[0].count);
          validationResults.push({
            check: `FK: ${table}.${column} -> ${refTable}.${refColumn}`,
            passed: count === 0,
            issues: count,
          });
        } catch {}
      }

      const allPassed = validationResults.every(r => r.passed);
      const totalIssues = validationResults.reduce((sum, r) => sum + r.issues, 0);

      res.json({
        status: allPassed ? 'passed' : 'failed',
        totalChecks: validationResults.length,
        passedChecks: validationResults.filter(r => r.passed).length,
        totalIssues,
        results: validationResults,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Validate integrity error:', error);
      res.status(500).json({ message: 'Failed to validate integrity' });
    }
  });

  // Run migration (applies data integrity improvements)
  app.post('/api/system/migrations/run', requireAuth, async (req: Request, res: Response) => {
    try {
      const migrationResults: any[] = [];
      
      // Start transaction
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');

        // Add version column to tables that need optimistic locking
        const tablesToAddVersion = ['users', 'user_sessions', 'property_definitions'];
        
        for (const table of tablesToAddVersion) {
          try {
            await client.query(`
              ALTER TABLE ${table}
              ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1
            `);
            migrationResults.push({ migration: `Add version column to ${table}`, status: 'applied' });
          } catch (e: any) {
            if (!e.message.includes('already exists')) {
              migrationResults.push({ migration: `Add version column to ${table}`, status: 'skipped', reason: e.message });
            }
          }
        }

        // Add updated_at column with trigger for automatic updates
        for (const table of tablesToAddVersion) {
          try {
            await client.query(`
              ALTER TABLE ${table}
              ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
            `);
            migrationResults.push({ migration: `Add updated_at to ${table}`, status: 'applied' });
          } catch (e: any) {
            migrationResults.push({ migration: `Add updated_at to ${table}`, status: 'skipped', reason: e.message });
          }
        }

        // Create update trigger function
        try {
          await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
              NEW.updated_at = NOW();
              NEW.version = COALESCE(OLD.version, 0) + 1;
              RETURN NEW;
            END;
            $$ language 'plpgsql'
          `);
          migrationResults.push({ migration: 'Create update_updated_at_column function', status: 'applied' });
        } catch (e: any) {
          migrationResults.push({ migration: 'Create update_updated_at_column function', status: 'skipped', reason: e.message });
        }

        // Create indexes for performance
        const indexes = [
          { name: 'idx_users_username', table: 'users', column: 'username' },
          { name: 'idx_users_email', table: 'users', column: 'email' },
          { name: 'idx_api_call_logs_user_id', table: 'api_call_logs', column: 'user_id' },
          { name: 'idx_api_call_logs_timestamp', table: 'api_call_logs', column: 'timestamp' },
          { name: 'idx_token_usage_logs_user_id', table: 'token_usage_logs', column: 'user_id' },
          { name: 'idx_error_logs_user_id', table: 'error_logs', column: 'user_id' },
          { name: 'idx_error_logs_timestamp', table: 'error_logs', column: 'timestamp' },
          { name: 'idx_user_activity_logs_user_id', table: 'user_activity_logs', column: 'user_id' },
        ];

        for (const idx of indexes) {
          try {
            await client.query(`
              CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.table}(${idx.column})
            `);
            migrationResults.push({ migration: `Create index ${idx.name}`, status: 'applied' });
          } catch (e: any) {
            migrationResults.push({ migration: `Create index ${idx.name}`, status: 'skipped', reason: e.message });
          }
        }

        await client.query('COMMIT');
        
        res.json({
          status: 'success',
          message: 'Migrations applied successfully',
          results: migrationResults,
          timestamp: new Date().toISOString(),
        });
      } catch (txError: any) {
        await client.query('ROLLBACK');
        throw txError;
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error('[MONITORING-API] Run migrations error:', error);
      res.status(500).json({ message: 'Failed to run migrations', error: error.message });
    }
  });

  // Get migration status
  app.get('/api/system/migrations', requireAuth, async (req: Request, res: Response) => {
    try {
      const migrations: any[] = [];

      // Check for version columns
      const versionCheckQuery = `
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = 'version'
      `;
      const versionResult = await pool.query(versionCheckQuery);
      const tablesWithVersion = versionResult.rows.map(r => r.table_name);
      
      migrations.push({
        name: 'Optimistic Locking (version columns)',
        status: tablesWithVersion.length > 0 ? 'applied' : 'pending',
        details: tablesWithVersion.length > 0 ? `Applied to: ${tablesWithVersion.join(', ')}` : 'Not yet applied',
      });

      // Check for indexes
      const indexResult = await pool.query(`
        SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
      `);
      const indexes = indexResult.rows.map(r => r.indexname);
      
      const expectedIndexes = [
        'idx_users_username',
        'idx_users_email',
        'idx_api_call_logs_user_id',
        'idx_api_call_logs_timestamp',
      ];
      
      const appliedIndexes = expectedIndexes.filter(i => indexes.includes(i));
      
      migrations.push({
        name: 'Performance Indexes',
        status: appliedIndexes.length === expectedIndexes.length ? 'applied' : 'partial',
        details: `${appliedIndexes.length}/${expectedIndexes.length} indexes created`,
      });

      // Check for foreign keys
      const fkResult = await pool.query(`
        SELECT COUNT(*) FROM information_schema.table_constraints
        WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'
      `);
      
      migrations.push({
        name: 'Foreign Key Constraints',
        status: parseInt(fkResult.rows[0].count) > 0 ? 'applied' : 'pending',
        details: `${fkResult.rows[0].count} foreign key constraints defined`,
      });

      // Check for trigger function
      const funcResult = await pool.query(`
        SELECT COUNT(*) FROM pg_proc WHERE proname = 'update_updated_at_column'
      `);
      
      migrations.push({
        name: 'Auto-update Triggers',
        status: parseInt(funcResult.rows[0].count) > 0 ? 'applied' : 'pending',
        details: parseInt(funcResult.rows[0].count) > 0 ? 'Trigger function exists' : 'Not yet created',
      });

      const allApplied = migrations.every(m => m.status === 'applied');
      
      res.json({
        status: allApplied ? 'all_applied' : 'migrations_pending',
        migrations,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Get migrations error:', error);
      res.status(500).json({ message: 'Failed to get migration status' });
    }
  });

  // Update backup configuration
  app.patch('/api/system/backup-config', requireAuth, async (req: Request, res: Response) => {
    try {
      const { retentionDays, autoBackupEnabled } = req.body;
      
      // In a real implementation, this would update environment variables
      // or a configuration store. For now, we'll just acknowledge the request.
      
      console.log('[MONITORING-API] Backup config update requested:', { retentionDays, autoBackupEnabled });
      
      res.json({
        message: 'Backup configuration updated',
        config: {
          retentionDays: retentionDays || 30,
          autoBackupEnabled: autoBackupEnabled !== false,
        },
        note: 'Restart server to apply environment variable changes'
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Update backup config error:', error);
      res.status(500).json({ message: 'Failed to update backup configuration' });
    }
  });

  // ==========================================
  // BACKUP SCHEDULE CONFIGURATION
  // ==========================================

  // Get backup schedule configuration
  app.get('/api/system/backup-schedule', requireAuth, async (req: Request, res: Response) => {
    try {
      // Check if system_config table exists, create if not
      await pool.query(`
        CREATE TABLE IF NOT EXISTS system_config (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT,
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Get current schedule config
      const result = await pool.query(`
        SELECT key, value FROM system_config
        WHERE key IN ('backup_enabled', 'backup_time', 'backup_retention_days', 'last_auto_backup')
      `);

      const config: Record<string, string> = {};
      result.rows.forEach(row => {
        config[row.key] = row.value;
      });

      res.json({
        enabled: config.backup_enabled === 'true',
        time: config.backup_time || '02:00',
        retentionDays: parseInt(config.backup_retention_days || '30'),
        lastAutoBackup: config.last_auto_backup || null,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Get backup schedule error:', error);
      res.status(500).json({ message: 'Failed to get backup schedule' });
    }
  });

  // Update backup schedule configuration
  app.patch('/api/system/backup-schedule', requireAuth, async (req: Request, res: Response) => {
    try {
      const { enabled, time, retentionDays } = req.body;

      // Ensure system_config table exists
      await pool.query(`
        CREATE TABLE IF NOT EXISTS system_config (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT,
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Upsert configuration values
      const upsertQuery = `
        INSERT INTO system_config (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
      `;

      if (enabled !== undefined) {
        await pool.query(upsertQuery, ['backup_enabled', String(enabled)]);
      }
      if (time !== undefined) {
        await pool.query(upsertQuery, ['backup_time', time]);
      }
      if (retentionDays !== undefined) {
        await pool.query(upsertQuery, ['backup_retention_days', String(retentionDays)]);
      }

      console.log('[MONITORING-API] Backup schedule updated:', { enabled, time, retentionDays });

      res.json({
        message: 'Backup schedule updated successfully',
        config: {
          enabled: enabled !== undefined ? enabled : true,
          time: time || '02:00',
          retentionDays: retentionDays || 30,
        },
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Update backup schedule error:', error);
      res.status(500).json({ message: 'Failed to update backup schedule' });
    }
  });

  // ==========================================
  // RESTORE DATABASE ENDPOINT
  // ==========================================

  // Restore database from backup - NOW USES COMPLETE JSON RESTORE
  app.post('/api/system/backups/:filename/restore', requireAuth, async (req: Request, res: Response) => {
    try {
      const { filename } = req.params;

      // Validate filename to prevent path traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ message: 'Invalid filename' });
      }

      const service = getBackupService();
      
      console.log('[MONITORING-API] Starting complete database restore from:', filename);

      // Check if it's a JSON backup (complete backup)
      if (filename.endsWith('.json')) {
        // Use the new complete restore method
        const result = await service.restoreFromBackup(filename);
        
        if (result.success) {
          console.log('[MONITORING-API] Database restored successfully from:', filename);
          
          res.json({
            message: 'Database restored successfully to backup state',
            filename,
            safetyBackup: result.safetyBackup,
            tablesRestored: result.tablesRestored,
            rowsRestored: result.rowsRestored,
            warnings: result.errors.length > 0 ? result.errors : undefined,
          });
        } else {
          console.error('[MONITORING-API] Database restore had errors');
          
          res.status(result.tablesRestored > 0 ? 207 : 500).json({
            message: result.tablesRestored > 0
              ? 'Database partially restored with some errors'
              : 'Database restore failed',
            filename,
            safetyBackup: result.safetyBackup,
            tablesRestored: result.tablesRestored,
            rowsRestored: result.rowsRestored,
            errors: result.errors,
            note: result.safetyBackup
              ? 'A safety backup was created before the restore attempt'
              : undefined,
          });
        }
      } else {
        // Legacy SQL backup - try to use psql
        const fs = await import('fs').then(m => m.promises);
        const path = await import('path');
        const { exec } = await import('child_process');
        const util = await import('util');
        const execPromise = util.promisify(exec);

        const backupDir = process.env.BACKUP_DIR || './backups';
        const databaseUrl = process.env.DATABASE_URL;

        if (!databaseUrl) {
          return res.status(500).json({ message: 'DATABASE_URL not configured' });
        }

        const filepath = path.join(backupDir, filename);

        // Check if file exists
        try {
          await fs.access(filepath);
        } catch {
          return res.status(404).json({ message: 'Backup file not found' });
        }

        // Parse DATABASE_URL
        const url = new URL(databaseUrl);
        const host = url.hostname;
        const port = url.port || '5432';
        const database = url.pathname.slice(1);
        const username = url.username;
        const password = url.password;

        // Set PGPASSWORD environment variable for psql
        const env = { ...process.env, PGPASSWORD: password };

        // First, create a safety backup before restore
        let safetyFilename: string | undefined;
        try {
          console.log('[MONITORING-API] Creating safety backup before restore...');
          const safety = await service.createCompleteBackup();
          safetyFilename = safety.filename.replace('backup_complete_', 'pre_restore_');
          const oldPath = path.join(backupDir, safety.filename);
          const newPath = path.join(backupDir, safetyFilename);
          await fs.rename(oldPath, newPath);
          console.log('[MONITORING-API] Safety backup created:', safetyFilename);
        } catch (backupError: any) {
          console.warn('[MONITORING-API] Could not create safety backup:', backupError.message);
        }

        // Check if it's a compressed file
        const isCompressed = filename.endsWith('.gz');

        let restoreCommand: string;
        if (isCompressed) {
          restoreCommand = `gunzip -c "${filepath}" | psql -h ${host} -p ${port} -U ${username} -d ${database}`;
        } else {
          restoreCommand = `psql -h ${host} -p ${port} -U ${username} -d ${database} -f "${filepath}"`;
        }

        console.log('[MONITORING-API] Restoring database from SQL backup:', filename);

        try {
          const { stdout, stderr } = await execPromise(restoreCommand, { env, timeout: 300000 });

          res.json({
            message: 'Database restored from SQL backup',
            filename,
            safetyBackup: safetyFilename,
            details: {
              stdout: stdout?.slice(0, 1000),
              stderr: stderr?.slice(0, 1000),
            },
            warning: 'SQL backups may not include all data. Consider using JSON backups for complete restore.',
          });
        } catch (restoreError: any) {
          res.status(500).json({
            message: 'SQL restore failed. Consider using a complete JSON backup.',
            error: restoreError.message,
            safetyBackup: safetyFilename,
            note: safetyFilename ? 'A safety backup was created before the restore attempt' : undefined,
          });
        }
      }
    } catch (error: any) {
      console.error('[MONITORING-API] Restore error:', error);
      res.status(500).json({ message: 'Failed to restore database', error: error.message });
    }
  });

  // ==========================================
  // TABLE DATA VIEWING ENDPOINTS
  // ==========================================

  // Get paginated data from a specific table
  app.get('/api/system/tables/:tableName/data', requireAuth, async (req: Request, res: Response) => {
    try {
      const { tableName } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = (page - 1) * limit;
      const sortBy = req.query.sortBy as string || 'id';
      const sortOrder = (req.query.sortOrder as string)?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

      // Validate table name - only allow public schema tables
      const validTablesResult = await pool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `);
      const validTables = validTablesResult.rows.map(r => r.table_name);

      if (!validTables.includes(tableName)) {
        return res.status(400).json({ message: 'Invalid table name' });
      }

      // Get column names for the table
      const columnsResult = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      const columns = columnsResult.rows;

      // Validate sortBy column
      const columnNames = columns.map(c => c.column_name);
      const actualSortBy = columnNames.includes(sortBy) ? sortBy : (columnNames.includes('id') ? 'id' : columnNames[0]);

      // Get total count
      const countResult = await pool.query(`SELECT COUNT(*) FROM "${tableName}"`);
      const total = parseInt(countResult.rows[0].count);

      // Get data with pagination
      const dataResult = await pool.query(
        `SELECT * FROM "${tableName}" ORDER BY "${actualSortBy}" ${sortOrder} LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      // Format dates and large objects for display
      const rows = dataResult.rows.map(row => {
        const formattedRow: any = {};
        for (const [key, value] of Object.entries(row)) {
          if (value instanceof Date) {
            formattedRow[key] = value.toISOString();
          } else if (typeof value === 'object' && value !== null) {
            formattedRow[key] = JSON.stringify(value).slice(0, 200);
          } else if (typeof value === 'string' && value.length > 200) {
            formattedRow[key] = value.slice(0, 200) + '...';
          } else {
            formattedRow[key] = value;
          }
        }
        return formattedRow;
      });

      res.json({
        tableName,
        columns: columns.map(c => ({ name: c.column_name, type: c.data_type })),
        rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        sorting: {
          sortBy: actualSortBy,
          sortOrder,
        },
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Get table data error:', error);
      res.status(500).json({ message: 'Failed to get table data' });
    }
  });

  // Get table structure (columns, constraints, indexes)
  app.get('/api/system/tables/:tableName/structure', requireAuth, async (req: Request, res: Response) => {
    try {
      const { tableName } = req.params;

      // Validate table name
      const validTablesResult = await pool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `);
      const validTables = validTablesResult.rows.map(r => r.table_name);

      if (!validTables.includes(tableName)) {
        return res.status(400).json({ message: 'Invalid table name' });
      }

      // Get columns with detailed info
      const columnsResult = await pool.query(`
        SELECT
          c.column_name,
          c.data_type,
          c.character_maximum_length,
          c.numeric_precision,
          c.column_default,
          c.is_nullable,
          (
            SELECT COUNT(*) > 0
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = c.table_name
              AND kcu.column_name = c.column_name
              AND tc.constraint_type = 'PRIMARY KEY'
          ) as is_primary_key
        FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = $1
        ORDER BY c.ordinal_position
      `, [tableName]);

      // Get foreign keys
      const fkResult = await pool.query(`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table,
          ccu.column_name AS foreign_column,
          tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_schema = 'public'
          AND tc.table_name = $1
          AND tc.constraint_type = 'FOREIGN KEY'
      `, [tableName]);

      // Get indexes
      const indexResult = await pool.query(`
        SELECT
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = $1
      `, [tableName]);

      // Get constraints (unique, check, etc.)
      const constraintResult = await pool.query(`
        SELECT
          tc.constraint_name,
          tc.constraint_type,
          string_agg(kcu.column_name, ', ') as columns
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public'
          AND tc.table_name = $1
        GROUP BY tc.constraint_name, tc.constraint_type
      `, [tableName]);

      // Get table size
      const sizeResult = await pool.query(`
        SELECT
          pg_size_pretty(pg_total_relation_size($1)) as total_size,
          pg_size_pretty(pg_table_size($1)) as data_size,
          pg_size_pretty(pg_indexes_size($1)) as index_size
      `, [tableName]);

      // Get row count
      const countResult = await pool.query(`SELECT COUNT(*) FROM "${tableName}"`);

      res.json({
        tableName,
        columns: columnsResult.rows.map(c => ({
          name: c.column_name,
          type: c.data_type,
          maxLength: c.character_maximum_length,
          precision: c.numeric_precision,
          default: c.column_default,
          nullable: c.is_nullable === 'YES',
          primaryKey: c.is_primary_key,
        })),
        foreignKeys: fkResult.rows,
        indexes: indexResult.rows,
        constraints: constraintResult.rows,
        size: sizeResult.rows[0],
        rowCount: parseInt(countResult.rows[0].count),
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Get table structure error:', error);
      res.status(500).json({ message: 'Failed to get table structure' });
    }
  });

  // Get single row from a table by ID
  app.get('/api/system/tables/:tableName/rows/:rowId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { tableName, rowId } = req.params;

      // Validate table name
      const validTablesResult = await pool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `);
      const validTables = validTablesResult.rows.map(r => r.table_name);

      if (!validTables.includes(tableName)) {
        return res.status(400).json({ message: 'Invalid table name' });
      }

      // Check if table has an 'id' column
      const columnsResult = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'id'
      `, [tableName]);

      if (columnsResult.rows.length === 0) {
        return res.status(400).json({ message: 'Table does not have an id column' });
      }

      // Get the row
      const result = await pool.query(`SELECT * FROM "${tableName}" WHERE id = $1`, [rowId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Row not found' });
      }

      // Format the row for display
      const row = result.rows[0];
      const formattedRow: any = {};
      for (const [key, value] of Object.entries(row)) {
        if (value instanceof Date) {
          formattedRow[key] = value.toISOString();
        } else if (typeof value === 'object' && value !== null) {
          formattedRow[key] = JSON.stringify(value, null, 2);
        } else {
          formattedRow[key] = value;
        }
      }

      res.json({
        tableName,
        rowId,
        data: formattedRow,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Get table row error:', error);
      res.status(500).json({ message: 'Failed to get row data' });
    }
  });

  // ==========================================
  // PRODUCT SEARCH MONITORING ENDPOINTS
  // ==========================================

  // Get aggregated product searches with URLs, tokens, and costs per user
  app.get('/api/product-searches', requireAuth, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const userId = req.query.user_id as string;
      const searchTab = req.query.search_tab as string; // 'automatisch' or 'manuelle_quellen'
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;

      // Query to get product searches with all related data
      let query = `
        SELECT
          ual.id,
          ual.user_id,
          ual.username,
          ual.activity_type,
          ual.action,
          ual.request_data,
          ual.response_data,
          ual.duration,
          ual.success,
          ual.error_message,
          ual.timestamp
        FROM user_activity_logs ual
        WHERE ual.activity_type LIKE 'search:%'
           OR ual.activity_type LIKE 'custom_search:%'
           OR ual.activity_type LIKE 'batch_search:%'
           OR ual.activity_type LIKE 'extraction_session:%'
      `;
      const params: any[] = [];

      if (userId) {
        params.push(parseInt(userId));
        query += ` AND ual.user_id = $${params.length}`;
      }

      if (searchTab) {
        params.push(`%${searchTab}%`);
        query += ` AND ual.activity_type LIKE $${params.length}`;
      }

      if (startDate) {
        params.push(startDate);
        query += ` AND ual.timestamp >= $${params.length}`;
      }

      if (endDate) {
        params.push(endDate);
        query += ` AND ual.timestamp <= $${params.length}`;
      }

      query += ` ORDER BY ual.timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) FROM user_activity_logs ual
        WHERE ual.activity_type LIKE 'search:%'
           OR ual.activity_type LIKE 'custom_search:%'
           OR ual.activity_type LIKE 'batch_search:%'
           OR ual.activity_type LIKE 'extraction_session:%'
      `;
      const countParams: any[] = [];

      if (userId) {
        countParams.push(parseInt(userId));
        countQuery += ` AND ual.user_id = $${countParams.length}`;
      }

      if (searchTab) {
        countParams.push(`%${searchTab}%`);
        countQuery += ` AND ual.activity_type LIKE $${countParams.length}`;
      }

      if (startDate) {
        countParams.push(startDate);
        countQuery += ` AND ual.timestamp >= $${countParams.length}`;
      }

      if (endDate) {
        countParams.push(endDate);
        countQuery += ` AND ual.timestamp <= $${countParams.length}`;
      }

      const countResult = await pool.query(countQuery, countParams);

      // Format the results with parsed JSON data
      const searches = result.rows.map(row => {
        let requestData = null;
        let responseData = null;
        
        try {
          requestData = typeof row.request_data === 'string' ? JSON.parse(row.request_data) : row.request_data;
        } catch {}
        
        try {
          responseData = typeof row.response_data === 'string' ? JSON.parse(row.response_data) : row.response_data;
        } catch {}

        // Determine search method from activity type
        const activityParts = row.activity_type?.split(':') || [];
        const searchType = activityParts[0] || 'unknown'; // search, custom_search, batch_search
        const searchTab = activityParts[1] || 'unknown'; // automatisch, manuelle_quellen
        const searchMode = activityParts[2] || 'unknown'; // manual, datei, url_only, url_pdf

        return {
          id: row.id,
          userId: row.user_id,
          username: row.username,
          productName: requestData?.productName || 'Unknown',
          articleNumber: requestData?.articleNumber || null,
          searchType,
          searchTab,
          searchMode,
          method: searchTab === 'automatisch' ? 'Automatisch' : 'Manuelle Quellen',
          urls: requestData?.sourceUrls || requestData?.webUrl ? [requestData.webUrl] : [],
          extractedPropertiesCount: responseData?.extractedPropertiesCount || responseData?.propertiesExtracted || 0,
          extractedProperties: responseData?.extractedProperties || [],
          scrapedDataSummary: responseData?.scrapedDataSummary || requestData?.scrapedDataSummary,
          duration: row.duration,
          success: row.success,
          errorMessage: row.error_message,
          timestamp: row.timestamp?.toISOString(),
          tableId: requestData?.tableId,
          tableName: requestData?.tableName,
        };
      });

      res.json({
        searches,
        total: parseInt(countResult.rows[0].count),
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Product searches error:', error);
      res.status(500).json({ message: 'Failed to fetch product searches' });
    }
  });

  // Get token usage aggregated by user and product search
  app.get('/api/product-searches/tokens', requireAuth, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const userId = req.query.user_id as string;
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;

      // Get token usage logs with related console logs for product context
      let query = `
        SELECT
          tul.id,
          tul.user_id,
          tul.username,
          tul.model_provider,
          tul.model_name,
          tul.input_tokens,
          tul.output_tokens,
          tul.total_tokens,
          tul.input_cost,
          tul.output_cost,
          tul.total_cost,
          tul.api_call_type,
          tul.timestamp,
          (
            SELECT cl.metadata
            FROM console_logs cl
            WHERE cl.user_id = tul.user_id
              AND cl.source = 'ai-api-call'
              AND cl.timestamp >= tul.timestamp - INTERVAL '5 seconds'
              AND cl.timestamp <= tul.timestamp + INTERVAL '5 seconds'
            ORDER BY ABS(EXTRACT(EPOCH FROM (cl.timestamp - tul.timestamp)))
            LIMIT 1
          ) as ai_call_metadata
        FROM token_usage_logs tul
        WHERE 1=1
      `;
      const params: any[] = [];

      if (userId) {
        params.push(parseInt(userId));
        query += ` AND tul.user_id = $${params.length}`;
      }

      if (startDate) {
        params.push(startDate);
        query += ` AND tul.timestamp >= $${params.length}`;
      }

      if (endDate) {
        params.push(endDate);
        query += ` AND tul.timestamp <= $${params.length}`;
      }

      query += ` ORDER BY tul.timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM token_usage_logs tul WHERE 1=1';
      const countParams: any[] = [];

      if (userId) {
        countParams.push(parseInt(userId));
        countQuery += ` AND tul.user_id = $${countParams.length}`;
      }

      if (startDate) {
        countParams.push(startDate);
        countQuery += ` AND tul.timestamp >= $${countParams.length}`;
      }

      if (endDate) {
        countParams.push(endDate);
        countQuery += ` AND tul.timestamp <= $${countParams.length}`;
      }

      const countResult = await pool.query(countQuery, countParams);

      // Format the results
      const tokens = result.rows.map(row => {
        let metadata = null;
        try {
          metadata = typeof row.ai_call_metadata === 'string' ? JSON.parse(row.ai_call_metadata) : row.ai_call_metadata;
        } catch {}

        return {
          id: row.id,
          userId: row.user_id,
          username: row.username,
          modelProvider: row.model_provider,
          modelName: row.model_name,
          inputTokens: row.input_tokens,
          outputTokens: row.output_tokens,
          totalTokens: row.total_tokens,
          inputCost: row.input_cost,
          outputCost: row.output_cost,
          totalCost: row.total_cost,
          apiCallType: row.api_call_type,
          productName: metadata?.productName || null,
          articleNumber: metadata?.articleNumber || null,
          sourceUrl: metadata?.sourceUrl || null,
          timestamp: row.timestamp?.toISOString(),
        };
      });

      res.json({
        tokens,
        total: parseInt(countResult.rows[0].count),
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Token usage error:', error);
      res.status(500).json({ message: 'Failed to fetch token usage' });
    }
  });

  // Get comprehensive product search summary grouped by user
  app.get('/api/product-searches/summary', requireAuth, async (req: Request, res: Response) => {
    try {
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;

      // Get summary per user with simpler query
      let userSummaryQuery = `
        SELECT
          u.id as user_id,
          u.username,
          u.email,
          COALESCE((
            SELECT COUNT(*) FROM user_activity_logs ual
            WHERE ual.user_id = u.id
              AND (ual.activity_type LIKE 'search:%' OR ual.activity_type LIKE 'custom_search:%' OR ual.activity_type LIKE 'batch_search:%')
          ), 0) as total_searches,
          COALESCE((
            SELECT COUNT(*) FROM user_activity_logs ual
            WHERE ual.user_id = u.id
              AND ual.activity_type LIKE '%automatisch%'
          ), 0) as automatisch_searches,
          COALESCE((
            SELECT COUNT(*) FROM user_activity_logs ual
            WHERE ual.user_id = u.id
              AND ual.activity_type LIKE '%manuelle_quellen%'
          ), 0) as manual_searches,
          COALESCE((
            SELECT SUM(total_tokens) FROM token_usage_logs tul
            WHERE tul.user_id = u.id
          ), 0) as total_tokens,
          COALESCE((
            SELECT SUM(CAST(total_cost AS DECIMAL)) FROM token_usage_logs tul
            WHERE tul.user_id = u.id
          ), 0) as total_cost
        FROM users u
        ORDER BY total_searches DESC NULLS LAST
      `;

      const userSummaryResult = await pool.query(userSummaryQuery);

      // Get overall stats
      const overallQuery = `
        SELECT
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(*) as total_searches
        FROM user_activity_logs
        WHERE activity_type LIKE 'search:%'
           OR activity_type LIKE 'custom_search:%'
           OR activity_type LIKE 'batch_search:%'
      `;

      const overallResult = await pool.query(overallQuery);

      const totalTokensResult = await pool.query('SELECT SUM(total_tokens) as total FROM token_usage_logs');
      const totalCostResult = await pool.query('SELECT SUM(CAST(total_cost AS DECIMAL)) as total FROM token_usage_logs');

      res.json({
        users: userSummaryResult.rows.map(row => ({
          userId: row.user_id,
          username: row.username,
          email: row.email,
          totalSearches: parseInt(row.total_searches) || 0,
          automatischSearches: parseInt(row.automatisch_searches) || 0,
          manualSearches: parseInt(row.manual_searches) || 0,
          totalTokens: parseInt(row.total_tokens) || 0,
          totalCost: parseFloat(row.total_cost) || 0,
        })),
        overall: {
          uniqueUsers: parseInt(overallResult.rows[0]?.unique_users) || 0,
          totalSearches: parseInt(overallResult.rows[0]?.total_searches) || 0,
          totalTokens: parseInt(totalTokensResult.rows[0]?.total) || 0,
          totalCost: parseFloat(totalCostResult.rows[0]?.total) || 0,
        },
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Product search summary error:', error);
      res.status(500).json({ message: 'Failed to fetch product search summary' });
    }
  });

  // Get URLs scraped for product searches with token counts
  app.get('/api/product-searches/urls', requireAuth, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const userId = req.query.user_id as string;
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;

      // Get scraped URLs from console_logs with source='scraped-data'
      let query = `
        SELECT
          cl.id,
          cl.user_id,
          cl.username,
          cl.message,
          cl.metadata,
          cl.duration,
          cl.timestamp
        FROM console_logs cl
        WHERE cl.source = 'scraped-data'
      `;
      const params: any[] = [];

      if (userId) {
        params.push(parseInt(userId));
        query += ` AND cl.user_id = $${params.length}`;
      }

      if (startDate) {
        params.push(startDate);
        query += ` AND cl.timestamp >= $${params.length}`;
      }

      if (endDate) {
        params.push(endDate);
        query += ` AND cl.timestamp <= $${params.length}`;
      }

      query += ` ORDER BY cl.timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) FROM console_logs cl WHERE cl.source = 'scraped-data'`;
      const countParams: any[] = [];

      if (userId) {
        countParams.push(parseInt(userId));
        countQuery += ` AND cl.user_id = $${countParams.length}`;
      }

      if (startDate) {
        countParams.push(startDate);
        countQuery += ` AND cl.timestamp >= $${countParams.length}`;
      }

      if (endDate) {
        countParams.push(endDate);
        countQuery += ` AND cl.timestamp <= $${countParams.length}`;
      }

      const countResult = await pool.query(countQuery, countParams);

      // Format the results
      const urls = result.rows.map(row => {
        let metadata = null;
        try {
          metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
        } catch {}

        return {
          id: row.id,
          userId: row.user_id,
          username: row.username,
          url: metadata?.url || 'Unknown',
          productName: metadata?.productName || null,
          articleNumber: metadata?.articleNumber || null,
          scrapingMethod: metadata?.scrapingMethod || null,
          contentLength: metadata?.contentLength || 0,
          success: metadata?.success !== false,
          responseTime: metadata?.responseTime || row.duration,
          timestamp: row.timestamp?.toISOString(),
        };
      });

      res.json({
        urls,
        total: parseInt(countResult.rows[0].count),
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Scraped URLs error:', error);
      res.status(500).json({ message: 'Failed to fetch scraped URLs' });
    }
  });

  // Get flattened Excel-like list of all searches with URLs and tokens per row
  app.get('/api/product-searches/flat', requireAuth, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 500;
      const offset = parseInt(req.query.offset as string) || 0;
      const userId = req.query.user_id as string;
      const searchTab = req.query.search_tab as string;
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;

      // Build filters
      const conditions: string[] = [];
      const params: any[] = [];

      if (userId) {
        params.push(parseInt(userId));
        conditions.push(`ual.user_id = $${params.length}`);
      }

      if (searchTab) {
        params.push(`%${searchTab}%`);
        conditions.push(`ual.activity_type LIKE $${params.length}`);
      }

      if (startDate) {
        params.push(startDate);
        conditions.push(`ual.timestamp >= $${params.length}`);
      }

      if (endDate) {
        params.push(endDate);
        conditions.push(`ual.timestamp <= $${params.length}`);
      }

      const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

      // Get all search activity logs with their related data
      const searchQuery = `
        SELECT
          ual.id as search_id,
          ual.user_id,
          ual.username,
          ual.activity_type,
          ual.action,
          ual.request_data,
          ual.response_data,
          ual.duration as search_duration,
          ual.success,
          ual.error_message,
          ual.timestamp as search_timestamp
        FROM user_activity_logs ual
        WHERE (
          ual.activity_type LIKE 'search:%'
          OR ual.activity_type LIKE 'custom_search:%'
          OR ual.activity_type LIKE 'batch_search:%'
          OR ual.activity_type LIKE 'extraction_session:%'
        )
        ${whereClause}
        ORDER BY ual.timestamp DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(limit, offset);

      const searchResult = await pool.query(searchQuery, params);

      // Get count for pagination
      const countParams = params.slice(0, -2);
      const countQuery = `
        SELECT COUNT(*) FROM user_activity_logs ual
        WHERE (
          ual.activity_type LIKE 'search:%'
          OR ual.activity_type LIKE 'custom_search:%'
          OR ual.activity_type LIKE 'batch_search:%'
          OR ual.activity_type LIKE 'extraction_session:%'
        )
        ${whereClause}
      `;
      const countResult = await pool.query(countQuery, countParams);

      // Process each search and create flat rows
      const flatRows: any[] = [];

      for (const row of searchResult.rows) {
        let requestData = null;
        let responseData = null;

        try {
          requestData = typeof row.request_data === 'string' ? JSON.parse(row.request_data) : row.request_data;
        } catch {}

        try {
          responseData = typeof row.response_data === 'string' ? JSON.parse(row.response_data) : row.response_data;
        } catch {}

        // Parse activity type to get search method
        const activityParts = row.activity_type?.split(':') || [];
        const searchType = activityParts[0] || 'unknown';
        const searchTab = activityParts[1] || 'unknown';
        const searchMode = activityParts[2] || 'unknown';
        const method = searchTab === 'automatisch' ? 'Automatisch' : 'Manuelle Quellen';

        const productName = requestData?.productName || 'Unknown';
        const articleNumber = requestData?.articleNumber || '';
        const urls = requestData?.sourceUrls || (requestData?.webUrl ? [requestData.webUrl] : []);

        // FIXED: Get token usage for this specific product by matching article number
        // instead of using time-window aggregation (which caused duplicate counting in batches)
        //
        // The fix: Query console_logs with source='ai-api-call' where the metadata contains
        // the specific articleNumber for this product search. This ensures each product
        // only counts its own API calls, not the entire batch.
        //
        // ENHANCED: Now includes separate input/output tokens and their individual costs
        
        let inputTokens = 0;
        let outputTokens = 0;
        let totalTokens = 0;
        let inputCost = 0;
        let outputCost = 0;
        let totalCost = 0;
        let modelInfo = '';

        try {
          // Method 1: If articleNumber is available, match by exact article number in AI call metadata
          if (articleNumber && articleNumber.trim() !== '') {
            const tokenByArticleQuery = `
              SELECT
                cl.metadata
              FROM console_logs cl
              WHERE cl.user_id = $1
                AND cl.source = 'ai-api-call'
                AND cl.metadata->>'articleNumber' = $2
                AND cl.timestamp >= $3::timestamp - INTERVAL '5 minutes'
                AND cl.timestamp <= $3::timestamp + INTERVAL '5 minutes'
              ORDER BY cl.timestamp ASC
            `;
            
            const tokenResult = await pool.query(tokenByArticleQuery, [row.user_id, articleNumber, row.search_timestamp]);
            
            for (const tokenRow of tokenResult.rows) {
              let metadata = null;
              try {
                metadata = typeof tokenRow.metadata === 'string' ? JSON.parse(tokenRow.metadata) : tokenRow.metadata;
              } catch {}
              
              if (metadata) {
                inputTokens += parseInt(metadata.inputTokens) || 0;
                outputTokens += parseInt(metadata.outputTokens) || 0;
                totalTokens += parseInt(metadata.totalTokens) || 0;
                inputCost += parseFloat(metadata.inputCost) || 0;
                outputCost += parseFloat(metadata.outputCost) || 0;
                totalCost += parseFloat(metadata.cost) || parseFloat(metadata.totalCost) || 0;
                if (!modelInfo && metadata.modelName) {
                  modelInfo = `${metadata.provider}/${metadata.modelName}`;
                }
              }
            }
          }
          
          // Method 2: Fallback - If no article number or no results, use product name matching
          if (totalTokens === 0 && productName && productName !== 'Unknown') {
            const tokenByProductQuery = `
              SELECT
                cl.metadata
              FROM console_logs cl
              WHERE cl.user_id = $1
                AND cl.source = 'ai-api-call'
                AND cl.metadata->>'productName' = $2
                AND cl.timestamp >= $3::timestamp - INTERVAL '5 minutes'
                AND cl.timestamp <= $3::timestamp + INTERVAL '5 minutes'
              ORDER BY cl.timestamp ASC
            `;
            
            const tokenResult = await pool.query(tokenByProductQuery, [row.user_id, productName, row.search_timestamp]);
            
            for (const tokenRow of tokenResult.rows) {
              let metadata = null;
              try {
                metadata = typeof tokenRow.metadata === 'string' ? JSON.parse(tokenRow.metadata) : tokenRow.metadata;
              } catch {}
              
              if (metadata) {
                inputTokens += parseInt(metadata.inputTokens) || 0;
                outputTokens += parseInt(metadata.outputTokens) || 0;
                totalTokens += parseInt(metadata.totalTokens) || 0;
                inputCost += parseFloat(metadata.inputCost) || 0;
                outputCost += parseFloat(metadata.outputCost) || 0;
                totalCost += parseFloat(metadata.cost) || parseFloat(metadata.totalCost) || 0;
                if (!modelInfo && metadata.modelName) {
                  modelInfo = `${metadata.provider}/${metadata.modelName}`;
                }
              }
            }
          }
          
          // Method 3: Last resort - Check token_usage_logs with very tight time window (5 seconds)
          // This is for cases where console_logs may not have the article/product info
          if (totalTokens === 0) {
            const tightWindowQuery = `
              SELECT
                tul.input_tokens,
                tul.output_tokens,
                tul.total_tokens,
                tul.input_cost,
                tul.output_cost,
                tul.total_cost,
                tul.model_provider,
                tul.model_name
              FROM token_usage_logs tul
              WHERE tul.user_id = $1
                AND tul.timestamp >= $2::timestamp - INTERVAL '5 seconds'
                AND tul.timestamp <= $2::timestamp + INTERVAL '10 seconds'
              LIMIT 5
            `;
            
            const tokenResult = await pool.query(tightWindowQuery, [row.user_id, row.search_timestamp]);
            for (const tokenRow of tokenResult.rows) {
              inputTokens += parseInt(tokenRow.input_tokens) || 0;
              outputTokens += parseInt(tokenRow.output_tokens) || 0;
              totalTokens += parseInt(tokenRow.total_tokens) || 0;
              inputCost += parseFloat(tokenRow.input_cost) || 0;
              outputCost += parseFloat(tokenRow.output_cost) || 0;
              totalCost += parseFloat(tokenRow.total_cost) || 0;
              if (!modelInfo && tokenRow.model_name) {
                modelInfo = `${tokenRow.model_provider}/${tokenRow.model_name}`;
              }
            }
          }
        } catch (tokenError) {
          console.error('[MONITORING] Error fetching token usage:', tokenError);
        }

        // Get scraped URLs for this search
        const scrapedQuery = `
          SELECT
            cl.metadata
          FROM console_logs cl
          WHERE cl.user_id = $1
            AND cl.source = 'scraped-data'
            AND cl.timestamp >= $2::timestamp - INTERVAL '30 seconds'
            AND cl.timestamp <= $2::timestamp + INTERVAL '60 seconds'
          ORDER BY cl.timestamp ASC
        `;

        let scrapedUrls: string[] = [];

        try {
          const scrapedResult = await pool.query(scrapedQuery, [row.user_id, row.search_timestamp]);
          for (const scrapedRow of scrapedResult.rows) {
            let metadata = null;
            try {
              metadata = typeof scrapedRow.metadata === 'string' ? JSON.parse(scrapedRow.metadata) : scrapedRow.metadata;
            } catch {}
            if (metadata?.url) {
              scrapedUrls.push(metadata.url);
            }
          }
        } catch {}

        // Combine requestData URLs and scraped URLs
        const allUrls = [...new Set([...urls, ...scrapedUrls])];

        // Create one row per search with separate input/output tokens and costs
        flatRows.push({
          searchId: row.search_id,
          timestamp: row.search_timestamp?.toISOString(),
          userId: row.user_id,
          username: row.username,
          productName,
          articleNumber,
          method,
          searchType,
          searchMode,
          urls: allUrls.join('\n'),
          urlCount: allUrls.length,
          inputTokens,
          outputTokens,
          totalTokens,
          inputCost: inputCost.toFixed(6),
          outputCost: outputCost.toFixed(6),
          totalCost: totalCost.toFixed(6),
          modelInfo,
          duration: row.search_duration,
          success: row.success,
          errorMessage: row.error_message || '',
          propertiesExtracted: responseData?.extractedPropertiesCount || responseData?.propertiesExtracted || 0,
        });
      }

      res.json({
        rows: flatRows,
        total: parseInt(countResult.rows[0].count),
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Flat product searches error:', error);
      res.status(500).json({ message: 'Failed to fetch flat product searches' });
    }
  });

  // ==========================================
  // EMAIL MANAGEMENT ENDPOINTS
  // ==========================================

  // Import email service dynamically
  let monitoringEmailService: any = null;
  
  const getEmailService = async () => {
    if (!monitoringEmailService) {
      try {
        const { MonitoringEmailService } = await import('./emailService');
        monitoringEmailService = new MonitoringEmailService();
        await monitoringEmailService.initializeSMTP();
      } catch (error) {
        console.error('[MONITORING-API] Failed to initialize email service:', error);
      }
    }
    return monitoringEmailService;
  };

  // Initialize email tables
  app.post('/api/emails/initialize', requireAuth, async (req: Request, res: Response) => {
    try {
      const { initializeEmailTables } = await import('./init-email-table');
      await initializeEmailTables();
      res.json({ message: 'Email tables initialized successfully' });
    } catch (error: any) {
      console.error('[MONITORING-API] Initialize email tables error:', error);
      res.status(500).json({ message: 'Failed to initialize email tables', error: error.message });
    }
  });

  // Get emails with pagination and filtering
  app.get('/api/emails', requireAuth, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const folder = req.query.folder as string || 'inbox';
      const isRead = req.query.is_read as string;
      const isStarred = req.query.is_starred as string;
      const search = req.query.search as string;

      // First check if table exists, if not initialize it
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'monitoring_emails'
        )
      `);
      
      if (!tableCheck.rows[0].exists) {
        // Table doesn't exist, initialize it
        try {
          const { initializeEmailTables } = await import('./init-email-table');
          await initializeEmailTables();
        } catch (initError) {
          console.error('[MONITORING-API] Failed to initialize email tables:', initError);
          // Return empty result if initialization fails
          return res.json({
            emails: [],
            total: 0,
            limit,
            offset,
            folder,
          });
        }
      }

      // Build query
      let query = 'SELECT * FROM monitoring_emails WHERE folder = $1';
      const params: any[] = [folder];
      
      if (isRead !== undefined) {
        params.push(isRead === 'true');
        query += ` AND is_read = $${params.length}`;
      }
      
      if (isStarred !== undefined) {
        params.push(isStarred === 'true');
        query += ` AND is_starred = $${params.length}`;
      }
      
      if (search) {
        params.push(`%${search}%`);
        query += ` AND (subject ILIKE $${params.length} OR body ILIKE $${params.length} OR "from" ILIKE $${params.length})`;
      }
      
      // Get total count
      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
      const countResult = await pool.query(countQuery, params);
      
      // Add pagination
      query += ` ORDER BY received_at DESC NULLS LAST, created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
      
      const result = await pool.query(query, params);

      res.json({
        emails: result.rows.map(row => ({
          ...row,
          received_at: row.received_at?.toISOString(),
          sent_at: row.sent_at?.toISOString(),
          created_at: row.created_at?.toISOString(),
        })),
        total: parseInt(countResult.rows[0].count),
        limit,
        offset,
        folder,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Get emails error:', error);
      // Return empty result on error instead of 500
      res.json({
        emails: [],
        total: 0,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
        folder: req.query.folder as string || 'inbox',
      });
    }
  });

  // Get email statistics - MUST be before /api/emails/:emailId to prevent route collision
  app.get('/api/emails/stats', requireAuth, async (req: Request, res: Response) => {
    try {
      // First check if table exists, if not initialize it
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'monitoring_emails'
        )
      `);
      
      if (!tableCheck.rows[0].exists) {
        // Table doesn't exist, initialize it
        try {
          const { initializeEmailTables } = await import('./init-email-table');
          await initializeEmailTables();
        } catch (initError) {
          console.error('[MONITORING-API] Failed to initialize email tables:', initError);
          // Return empty stats if initialization fails
          return res.json({
            folders: {},
            unread: 0,
            starred: 0,
            today: 0,
          });
        }
      }
      
      // Count by folder
      const folderCountsResult = await pool.query(`
        SELECT folder, COUNT(*) as count
        FROM monitoring_emails
        GROUP BY folder
      `);
      
      // Unread count
      const unreadResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM monitoring_emails
        WHERE is_read = false AND folder = 'inbox'
      `);
      
      // Starred count
      const starredResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM monitoring_emails
        WHERE is_starred = true
      `);
      
      // Today's emails
      const todayResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM monitoring_emails
        WHERE created_at >= CURRENT_DATE
      `);
      
      const folderCounts: Record<string, number> = {};
      folderCountsResult.rows.forEach(row => {
        folderCounts[row.folder] = parseInt(row.count);
      });
      
      res.json({
        folders: folderCounts,
        unread: parseInt(unreadResult.rows[0].count),
        starred: parseInt(starredResult.rows[0].count),
        today: parseInt(todayResult.rows[0].count),
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Email stats error:', error);
      // Return empty stats on error instead of 500
      res.json({
        folders: {},
        unread: 0,
        starred: 0,
        today: 0,
      });
    }
  });

  // Get all users with emails (for bulk send) - MUST be before /api/emails/:emailId
  app.get('/api/emails/recipients', requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT id, username, email, role, is_active
        FROM users
        WHERE email IS NOT NULL AND email != ''
        ORDER BY username ASC
      `);
      
      res.json({
        recipients: result.rows,
        total: result.rows.length,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Get recipients error:', error);
      res.status(500).json({ message: 'Failed to fetch recipients' });
    }
  });

  // Get single email - Dynamic route MUST come after specific routes like /stats, /recipients
  app.get('/api/emails/:emailId', requireAuth, async (req: Request, res: Response) => {
    try {
      const emailId = parseInt(req.params.emailId);
      
      const result = await pool.query('SELECT * FROM monitoring_emails WHERE id = $1', [emailId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Email not found' });
      }
      
      const email = result.rows[0];
      
      // Mark as read
      if (!email.is_read) {
        await pool.query('UPDATE monitoring_emails SET is_read = true WHERE id = $1', [emailId]);
        email.is_read = true;
      }
      
      res.json({
        ...email,
        received_at: email.received_at?.toISOString(),
        sent_at: email.sent_at?.toISOString(),
        created_at: email.created_at?.toISOString(),
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Get email error:', error);
      res.status(500).json({ message: 'Failed to fetch email' });
    }
  });

  // Send email
  app.post('/api/emails/send', requireAuth, async (req: Request, res: Response) => {
    try {
      const { to, cc, bcc, subject, body, html } = req.body;
      
      if (!to || !subject) {
        return res.status(400).json({ message: 'To and subject are required' });
      }
      
      const emailService = await getEmailService();
      if (!emailService) {
        return res.status(503).json({ message: 'Email service not available' });
      }
      
      const result = await emailService.sendEmail({
        to: Array.isArray(to) ? to : [to],
        cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
        bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
        subject,
        text: body,
        html,
      });
      
      res.json({
        message: 'Email sent successfully',
        messageId: result.messageId,
        emailId: result.emailId,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Send email error:', error);
      res.status(500).json({ message: 'Failed to send email', error: error.message });
    }
  });

  // Send bulk email to all users or selected users
  app.post('/api/emails/bulk-send', requireAuth, async (req: Request, res: Response) => {
    try {
      const { userIds, subject, body, html, allUsers } = req.body;
      
      if (!subject) {
        return res.status(400).json({ message: 'Subject is required' });
      }
      
      const emailService = await getEmailService();
      if (!emailService) {
        return res.status(503).json({ message: 'Email service not available' });
      }
      
      // Get user emails
      let usersQuery = 'SELECT id, username, email FROM users WHERE email IS NOT NULL AND email != \'\'';
      const params: any[] = [];
      
      if (!allUsers && userIds && userIds.length > 0) {
        usersQuery += ` AND id = ANY($1)`;
        params.push(userIds);
      }
      
      const usersResult = await pool.query(usersQuery, params);
      
      if (usersResult.rows.length === 0) {
        return res.status(400).json({ message: 'No valid user emails found' });
      }
      
      const recipients = usersResult.rows.map(u => ({
        email: u.email,
        name: u.username,
      }));
      
      const result = await emailService.sendBulkEmail({
        recipients,
        subject,
        text: body,
        html,
      });
      
      res.json({
        message: 'Bulk email sent',
        totalRecipients: result.totalRecipients,
        successCount: result.successCount,
        failedCount: result.failedCount,
        results: result.results,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Bulk send email error:', error);
      res.status(500).json({ message: 'Failed to send bulk email', error: error.message });
    }
  });

  // Sync inbox from IMAP
  app.post('/api/emails/sync', requireAuth, async (req: Request, res: Response) => {
    try {
      const emailService = await getEmailService();
      if (!emailService) {
        return res.status(503).json({ message: 'Email service not available' });
      }
      
      const result = await emailService.syncInbox();
      
      res.json({
        message: 'Inbox synced successfully',
        newEmails: result.newEmails,
        totalEmails: result.totalEmails,
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Sync emails error:', error);
      res.status(500).json({ message: 'Failed to sync inbox', error: error.message });
    }
  });

  // Mark email as read/unread
  app.patch('/api/emails/:emailId/read', requireAuth, async (req: Request, res: Response) => {
    try {
      const emailId = parseInt(req.params.emailId);
      const { isRead } = req.body;
      
      await pool.query('UPDATE monitoring_emails SET is_read = $1 WHERE id = $2', [isRead !== false, emailId]);
      
      res.json({ message: isRead !== false ? 'Marked as read' : 'Marked as unread' });
    } catch (error: any) {
      console.error('[MONITORING-API] Mark email read error:', error);
      res.status(500).json({ message: 'Failed to update email' });
    }
  });

  // Star/unstar email
  app.patch('/api/emails/:emailId/star', requireAuth, async (req: Request, res: Response) => {
    try {
      const emailId = parseInt(req.params.emailId);
      const { isStarred } = req.body;
      
      await pool.query('UPDATE monitoring_emails SET is_starred = $1 WHERE id = $2', [isStarred !== false, emailId]);
      
      res.json({ message: isStarred !== false ? 'Starred' : 'Unstarred' });
    } catch (error: any) {
      console.error('[MONITORING-API] Star email error:', error);
      res.status(500).json({ message: 'Failed to update email' });
    }
  });

  // Move email to folder (trash, archive)
  app.patch('/api/emails/:emailId/move', requireAuth, async (req: Request, res: Response) => {
    try {
      const emailId = parseInt(req.params.emailId);
      const { folder } = req.body;
      
      const validFolders = ['inbox', 'sent', 'drafts', 'trash', 'archive', 'spam'];
      if (!validFolders.includes(folder)) {
        return res.status(400).json({ message: 'Invalid folder' });
      }
      
      await pool.query('UPDATE monitoring_emails SET folder = $1 WHERE id = $2', [folder, emailId]);
      
      res.json({ message: `Moved to ${folder}` });
    } catch (error: any) {
      console.error('[MONITORING-API] Move email error:', error);
      res.status(500).json({ message: 'Failed to move email' });
    }
  });

  // Delete email (permanently)
  app.delete('/api/emails/:emailId', requireAuth, async (req: Request, res: Response) => {
    try {
      const emailId = parseInt(req.params.emailId);
      
      await pool.query('DELETE FROM monitoring_emails WHERE id = $1', [emailId]);
      
      res.json({ message: 'Email deleted permanently' });
    } catch (error: any) {
      console.error('[MONITORING-API] Delete email error:', error);
      res.status(500).json({ message: 'Failed to delete email' });
    }
  });

  // Note: /api/emails/stats is defined earlier to prevent route collision with /api/emails/:emailId

  // Get email templates
  app.get('/api/email-templates', requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT * FROM monitoring_email_templates
        WHERE is_active = true
        ORDER BY name ASC
      `);
      
      res.json({
        templates: result.rows.map(row => ({
          ...row,
          created_at: row.created_at?.toISOString(),
          updated_at: row.updated_at?.toISOString(),
        })),
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Get templates error:', error);
      res.status(500).json({ message: 'Failed to fetch email templates' });
    }
  });

  // Create email template
  app.post('/api/email-templates', requireAuth, async (req: Request, res: Response) => {
    try {
      const { name, subject, body, html, variables } = req.body;
      
      if (!name || !subject) {
        return res.status(400).json({ message: 'Name and subject are required' });
      }
      
      const result = await pool.query(`
        INSERT INTO monitoring_email_templates (name, subject, body, html, variables)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [name, subject, body, html, JSON.stringify(variables || [])]);
      
      res.status(201).json({
        message: 'Template created',
        template: result.rows[0],
      });
    } catch (error: any) {
      console.error('[MONITORING-API] Create template error:', error);
      res.status(500).json({ message: 'Failed to create template' });
    }
  });

  // Delete email template
  app.delete('/api/email-templates/:templateId', requireAuth, async (req: Request, res: Response) => {
    try {
      const templateId = parseInt(req.params.templateId);
      
      await pool.query('UPDATE monitoring_email_templates SET is_active = false WHERE id = $1', [templateId]);
      
      res.json({ message: 'Template deleted' });
    } catch (error: any) {
      console.error('[MONITORING-API] Delete template error:', error);
      res.status(500).json({ message: 'Failed to delete template' });
    }
  });

  // Note: /api/emails/recipients is defined earlier to prevent route collision with /api/emails/:emailId

  console.log('[MONITORING-API] ✅ Routes registered successfully');
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Create schema backup using pool (fallback when pg_dump not available)
async function createSchemaBackup(backupDir: string, timestamp: string): Promise<any | null> {
  try {
    const fs = await import('fs').then(m => m.promises);
    const path = await import('path');
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    
    const filename = `backup_${timestamp}_schema.sql`;
    const filepath = path.join(backupDir, filename);
    
    // Get table schemas
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `);
    
    let schemaSQL = `-- Schema backup created at ${new Date().toISOString()}\n\n`;
    
    for (const row of tablesResult.rows) {
      const tableName = row.table_name;
      
      // Get column definitions
      const columnsResult = await pool.query(`
        SELECT column_name, data_type, character_maximum_length,
               column_default, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      schemaSQL += `-- Table: ${tableName}\n`;
      schemaSQL += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
      
      const columnDefs = columnsResult.rows.map(col => {
        let def = `  "${col.column_name}" ${col.data_type}`;
        if (col.character_maximum_length) {
          def += `(${col.character_maximum_length})`;
        }
        if (col.column_default) {
          def += ` DEFAULT ${col.column_default}`;
        }
        if (col.is_nullable === 'NO') {
          def += ' NOT NULL';
        }
        return def;
      });
      
      schemaSQL += columnDefs.join(',\n');
      schemaSQL += '\n);\n\n';
    }
    
    await fs.writeFile(filepath, schemaSQL);
    const stat = await fs.stat(filepath);
    
    await pool.end();
    
    return {
      filename,
      size: stat.size,
      sizeFormatted: formatBytes(stat.size),
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[MONITORING-API] Schema backup error:', error);
    return null;
  }
}

// Helper function to format uptime
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}