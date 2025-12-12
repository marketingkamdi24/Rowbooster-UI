// Load environment variables from .env file FIRST
import { config } from 'dotenv';
config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./init-database";
import { initializePropertyTables } from "./init-property-tables";
import { initializeAdminUser } from "./init-admin-user";
import { accountCleanupService } from "./services/accountCleanup";
import { startSessionCleanup } from "./services/sessionCleanup";
import { MonitoringLogger } from "./services/monitoringLogger";
import { apiKeyManager } from "./services/apiKeyManager";
import { AuthenticatedRequest } from "./auth";
import { initializeMonitoringDatabase } from "../monitoring-system/server/init-database.js";
import {
  securityHeaders,
  csrfProtection,
  sanitizeInput,
  rateLimitAuth,
  rateLimitGeneral,
  validateIdParam,
  sessionBinding,
  blockDebugEndpoints,
  detectMaliciousPatterns
} from "./middleware/security";
import { secureLog } from "./utils/secureLogger";
import {
  errorHandler,
  notFoundHandler,
  requestIdMiddleware
} from "./middleware/errorHandler";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security middleware - apply FIRST before any routes
app.use(securityHeaders);
app.use(blockDebugEndpoints);
app.use(sanitizeInput);
app.use(rateLimitAuth);

// Body parsing middleware - reduced limits for security
app.use(express.json({ limit: '10mb' })); // Reduced from 50mb for DoS protection
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Additional security middleware after body parsing
app.use(detectMaliciousPatterns);
app.use(rateLimitGeneral);
app.use(sessionBinding);

// CSRF protection for state-changing requests
app.use(csrfProtection);

// Add request ID for tracing/correlation using centralized middleware
app.use(requestIdMiddleware);

// Monitoring middleware - log ALL API calls
app.use(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Only log API calls, not static files
  if (!req.path.startsWith('/api')) {
    return next();
  }

  const startTime = Date.now();
  const requestId = (req as any).requestId;
  const originalJson = res.json.bind(res);
  let responseBody: any = null;

  // Capture response
  res.json = function(body: any) {
    responseBody = body;
    return originalJson(body);
  };

  // Log after response is sent
  res.on('finish', async () => {
    const duration = Date.now() - startTime;
    
    // Log to console_logs for all requests (including unauthenticated)
    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    
    MonitoringLogger.logConsole({
      userId: req.user?.id,
      username: req.user?.username,
      logLevel,
      category: 'api',
      message: `${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`,
      metadata: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
      requestId,
      sessionId: req.sessionId,
      duration,
    }).catch(() => {});
    
    // Only log detailed activity for authenticated users
    if (req.user) {
      try {
        await MonitoringLogger.logApiCall({
          userId: req.user.id,
          username: req.user.username,
          endpoint: req.path,
          method: req.method,
          requestBody: req.body,
          responseBody: responseBody,
          statusCode: res.statusCode,
          duration: duration,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });

        await MonitoringLogger.logActivity({
          userId: req.user.id,
          username: req.user.username,
          activityType: 'api_call',
          action: `${req.method} ${req.path}`,
          endpoint: req.path,
          method: req.method,
          duration: duration,
          statusCode: res.statusCode,
          success: res.statusCode < 400,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      } catch (error) {
        secureLog.error('[MONITORING] Failed to log API call', error);
      }
    }
  });

  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    log('[STARTUP] Starting application initialization...');
    
    // Initialize database tables first
    log('[STARTUP] Initializing database tables...');
    await initializeDatabase();
    
    // Initialize property tables (for migration compatibility)
    log('[STARTUP] Checking property tables...');
    await initializePropertyTables();
    
    // Initialize admin user if not exists
    log('[STARTUP] Initializing admin user...');
    await initializeAdminUser();
    
    // Initialize monitoring system database and MonitoringLogger tables
    log('[STARTUP] Initializing monitoring system...');
    await initializeMonitoringDatabase();
    
    // Also initialize MonitoringLogger tables (ensures tables exist for main app logging)
    log('[STARTUP] Initializing MonitoringLogger tables...');
    await MonitoringLogger.initialize();
    
    // Initialize API key manager and security tables (runs database migration automatically)
    log('[STARTUP] Initializing security tables (API key storage, rate limits, tokens)...');
    await apiKeyManager.initialize();
    
    // Start account cleanup service
    log('[STARTUP] Starting account cleanup service...');
    accountCleanupService.start();
    
    // Start session cleanup service for expired/idle sessions
    log('[STARTUP] Starting session cleanup service...');
    startSessionCleanup();
    
    log('[STARTUP] Registering routes...');
    const server = await registerRoutes(app);

    // Serve monitoring system static files in production
    if (app.get("env") !== "development") {
      const monitoringPath = path.join(__dirname, 'public', 'monitoring');
      log(`[STARTUP] Serving monitoring system from: ${monitoringPath}`);
      app.use('/monitoring', express.static(monitoringPath));
      
      // Monitoring SPA fallback
      app.get('/monitoring/*', (_req, res) => {
        res.sendFile(path.join(monitoringPath, 'index.html'));
      });
    }

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      log('[STARTUP] Setting up Vite dev server...');
      await setupVite(app, server);
    } else {
      log('[STARTUP] Setting up static file serving...');
      serveStatic(app);
    }

    // 404 handler for API routes only - MUST be after Vite/static but before error handler
    app.use('/api/*', notFoundHandler);
    
    // Centralized error handling middleware - MUST be last
    app.use(errorHandler);

    // Dynamic port configuration with fallback
    const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
    // Use 0.0.0.0 for cloud deployments, localhost for Windows development
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' :
                 (process.platform === 'win32' ? '127.0.0.1' : '0.0.0.0');
    
    const startServer = (portToTry: number) => {
      server.listen(portToTry, host, async () => {
        log(`✅ Server ready on ${host}:${portToTry}`);
        log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        log(`🔗 Database: ${process.env.DATABASE_URL ? 'Connected' : 'NOT CONFIGURED'}`);
        log(`🚀 Application fully initialized and ready to accept requests`);
        
        // Log startup to monitoring system
        MonitoringLogger.info(
          `Application started successfully on ${host}:${portToTry}`,
          'system',
          {
            metadata: {
              port: portToTry,
              host,
              environment: process.env.NODE_ENV || 'development',
              nodeVersion: process.version,
              platform: process.platform,
            }
          }
        ).catch(() => {});
        
        // Record initial health check
        MonitoringLogger.recordHealthCheck({
          component: 'main-app',
          status: 'healthy',
          message: 'Application started successfully',
          details: { port: portToTry, host, environment: process.env.NODE_ENV },
        }).catch(() => {});
      }).on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          log(`Port ${portToTry} is already in use, trying ${portToTry + 1}...`);
          startServer(portToTry + 1);
        } else {
          log(`[FATAL ERROR] Server failed to start: ${err.message}`);
          
          // Log fatal error
          MonitoringLogger.fatal(
            `Server failed to start: ${err.message}`,
            err,
            'system'
          ).catch(() => {});
          
          throw err;
        }
      });
    };
    
    startServer(port);
    
    // Security: Log startup in secure manner
    secureLog.info('Application started successfully', {
      port,
      host,
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    secureLog.error('Application initialization failed', error);
    log(`[FATAL ERROR] Application initialization failed: ${(error as Error).message}`);
    
    // Log fatal error to monitoring
    MonitoringLogger.fatal(
      `Application initialization failed: ${(error as Error).message}`,
      error as Error,
      'system'
    ).catch(() => {});
    
    console.error(error);
    process.exit(1);
  }
})();
