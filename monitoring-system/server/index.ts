import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory (main app directory)
config({ path: path.join(__dirname, '../../.env') });

import express, { Request, Response, NextFunction } from 'express';
import { registerRoutes } from './routes';
import { initializeMonitoringDatabase } from './init-database';
import { setupVite, serveStatic, log } from './vite';
import cookieParser from 'cookie-parser';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createServer } from 'http';

const execAsync = promisify(exec);

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));
app.use(cookieParser());

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (path.startsWith('/api')) {
      console.log(`[MONITORING] ${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

// CORS for development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
}

// Kill process on port if exists
async function killProcessOnPort(port: number): Promise<void> {
  try {
    console.log(`[MONITORING] Checking for process on port ${port}...`);
    
    if (process.platform === 'win32') {
      // Windows
      try {
        const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
        const lines = stdout.trim().split('\n');
        
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          
          if (pid && pid !== '0') {
            console.log(`[MONITORING] Killing process ${pid} on port ${port}...`);
            await execAsync(`taskkill /F /PID ${pid}`);
            console.log(`[MONITORING] ✅ Process ${pid} killed successfully`);
          }
        }
      } catch (error) {
        // No process found on port - this is fine
        console.log(`[MONITORING] No existing process found on port ${port}`);
      }
    } else {
      // Unix/Linux/Mac
      try {
        const { stdout } = await execAsync(`lsof -ti:${port}`);
        const pid = stdout.trim();
        
        if (pid) {
          console.log(`[MONITORING] Killing process ${pid} on port ${port}...`);
          await execAsync(`kill -9 ${pid}`);
          console.log(`[MONITORING] ✅ Process ${pid} killed successfully`);
        }
      } catch (error) {
        // No process found on port - this is fine
        console.log(`[MONITORING] No existing process found on port ${port}`);
      }
    }
    
    // Wait a bit for the port to be released
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    console.error(`[MONITORING] Error checking/killing process on port ${port}:`, error);
  }
}

(async () => {
  try {
    console.log('[MONITORING] 🚀 Starting Monitoring System initialization...');
    
    // Initialize database
    console.log('[MONITORING] Initializing database...');
    await initializeMonitoringDatabase();
    
    // Create HTTP server
    const server = createServer(app);
    
    // Register API routes FIRST
    log('Registering API routes...');
    registerRoutes(app);

    // Setup Vite in development or serve static files in production
    // This MUST be after API routes to handle catch-all
    if (process.env.NODE_ENV === 'production') {
      log('Setting up static file serving...');
      serveStatic(app);
    } else {
      log('Setting up Vite dev server...');
      await setupVite(app, server);
    }

    // Error handling middleware - MUST be LAST
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || 'Internal Server Error';
      
      log(`[ERROR] ${status}: ${message}`);
      res.status(status).json({ message });
    });

    // Port configuration - different from main app
    const DEFAULT_MONITORING_PORT = 5001; // Different from main app (5000)
    const port = process.env.MONITORING_PORT 
      ? parseInt(process.env.MONITORING_PORT) 
      : DEFAULT_MONITORING_PORT;

    // Kill any existing process on the port
    await killProcessOnPort(port);

    // Start server
    const host = process.env.NODE_ENV === 'production' 
      ? '0.0.0.0' 
      : (process.platform === 'win32' ? '127.0.0.1' : '0.0.0.0');

    server.listen(port, host, () => {
      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('   🔍 ROWBOOSTER MONITORING SYSTEM');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`✅ Server ready on ${host}:${port}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Database: ${process.env.DATABASE_URL ? 'Connected' : 'NOT CONFIGURED'}`);
      console.log(`👤 Login: Use RBManager account (password set via RB_MANAGER_DEFAULT_PASSWORD)`);
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');
      console.log('[MONITORING] 🚀 System fully initialized and ready');
      console.log(`[MONITORING] 🌐 Access dashboard at: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
      console.log('');
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[MONITORING-ERROR] Port ${port} is still in use after cleanup attempt`);
        console.error('[MONITORING-ERROR] Please manually kill the process or use a different port');
        process.exit(1);
      } else {
        console.error(`[MONITORING-ERROR] Server failed to start:`, err);
        process.exit(1);
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('[MONITORING] SIGTERM signal received: closing HTTP server');
      server.close(() => {
        console.log('[MONITORING] HTTP server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('[MONITORING] SIGINT signal received: closing HTTP server');
      server.close(() => {
        console.log('[MONITORING] HTTP server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('[MONITORING-FATAL] Application initialization failed:', error);
    process.exit(1);
  }
})();