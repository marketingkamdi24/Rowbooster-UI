import { config } from 'dotenv';
config(); // Uses the .env from the parent directory

import pkg from 'pg';
const { Pool } = pkg;
import { v4 as uuidv4 } from 'uuid';

// Create a separate connection pool for monitoring database
// Uses the same DATABASE_URL as main app since monitoring tables are in the same DB
const connectionString = process.env.DATABASE_URL;

// Determine if SSL is needed based on environment and database URL
// More comprehensive detection for various cloud providers and environments
function shouldUseSSL(dbUrl: string | undefined, nodeEnv: string | undefined): boolean {
  // 1. Check if DATABASE_URL explicitly requires SSL
  if (dbUrl?.includes('sslmode=require') || dbUrl?.includes('ssl=true')) {
    console.log('[MONITORING-LOGGER] SSL enabled: sslmode=require detected in DATABASE_URL');
    return true;
  }
  
  // 2. Check for localhost - no SSL needed
  if (dbUrl?.includes('localhost') || dbUrl?.includes('127.0.0.1')) {
    console.log('[MONITORING-LOGGER] SSL disabled: localhost detected');
    return false;
  }
  
  // 3. Check for explicit cloud database hostnames (expanded list)
  const cloudPatterns = [
    'render.com',           // Render
    '.render.com',          // Render subdomains
    'postgres.render.com',  // Render Postgres specifically
    'oregon-postgres.render.com', // Render Oregon region
    'amazonaws.com',        // AWS RDS
    'rds.amazonaws.com',    // AWS RDS specifically
    'supabase.com',         // Supabase
    '.supabase.co',         // Supabase
    'neon.tech',            // Neon
    '.neon.tech',           // Neon subdomains
    'railway.app',          // Railway
    'elephantsql.com',      // ElephantSQL
    'cockroachlabs.cloud',  // CockroachDB
    'digitalocean.com',     // DigitalOcean
    'azure.com',            // Azure
    'googleapis.com',       // Google Cloud SQL
  ];
  
  for (const pattern of cloudPatterns) {
    if (dbUrl?.includes(pattern)) {
      console.log(`[MONITORING-LOGGER] SSL enabled: cloud provider pattern "${pattern}" detected`);
      return true;
    }
  }
  
  // 4. Check for production environment - always use SSL in production if not localhost
  if (nodeEnv === 'production') {
    console.log('[MONITORING-LOGGER] SSL enabled: NODE_ENV=production (non-localhost)');
    return true;
  }
  
  // 5. Check if URL looks like a cloud database (has port 5432 and non-localhost host)
  if (dbUrl && !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1')) {
    try {
      const url = new URL(dbUrl);
      // If it's a postgres URL with a remote host, likely needs SSL
      if (url.protocol === 'postgres:' || url.protocol === 'postgresql:') {
        console.log('[MONITORING-LOGGER] SSL enabled: remote PostgreSQL URL detected');
        return true;
      }
    } catch (e) {
      // URL parsing failed, continue with default behavior
    }
  }
  
  console.log('[MONITORING-LOGGER] SSL disabled: no cloud indicators detected');
  return false;
}

const useSSL = shouldUseSSL(connectionString, process.env.NODE_ENV);

// Build pool configuration with SSL support for cloud databases
let poolConfig: any = {
  connectionString: connectionString,
  max: 5, // Smaller pool for monitoring
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

if (useSSL) {
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
  console.log('[MONITORING-LOGGER] ✅ SSL configuration added to pool');
} else {
  console.log('[MONITORING-LOGGER] ℹ️ Using non-SSL connection');
}

// Log pool configuration (without sensitive data)
console.log('[MONITORING-LOGGER] Pool config:', {
  max: poolConfig.max,
  idleTimeoutMillis: poolConfig.idleTimeoutMillis,
  connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
  ssl: poolConfig.ssl ? 'enabled (rejectUnauthorized: false)' : 'disabled',
  hasConnectionString: !!connectionString,
  connectionStringPreview: connectionString ?
    connectionString.substring(0, 30) + '...' : 'not set',
  nodeEnv: process.env.NODE_ENV || 'not set',
});

const monitoringPool = new Pool(poolConfig);

// Track connection status
let connectionVerified = false;
let connectionError: string | null = null;

// Add error handler for pool connection errors
monitoringPool.on('error', (err) => {
  connectionError = err.message;
  console.error('[MONITORING-LOGGER] ❌ Pool error:', err.message);
  console.error('[MONITORING-LOGGER] Error details:', {
    code: (err as any).code,
    routine: (err as any).routine,
    stack: err.stack?.substring(0, 300)
  });
});

// Log successful connections
monitoringPool.on('connect', (client) => {
  connectionVerified = true;
  connectionError = null;
  console.log('[MONITORING-LOGGER] ✅ Database pool client connected successfully');
});

// Test connection on startup
async function testConnection(): Promise<void> {
  try {
    console.log('[MONITORING-LOGGER] Testing database connection...');
    const result = await monitoringPool.query('SELECT NOW() as current_time, version() as pg_version');
    connectionVerified = true;
    connectionError = null;
    console.log('[MONITORING-LOGGER] ✅ Database connection test successful:', {
      serverTime: result.rows[0].current_time,
      pgVersion: result.rows[0].pg_version?.substring(0, 50) + '...'
    });
  } catch (err: any) {
    connectionVerified = false;
    connectionError = err.message;
    console.error('[MONITORING-LOGGER] ❌ Database connection test FAILED:', {
      error: err.message,
      code: err.code,
      routine: err.routine,
      detail: err.detail,
      hint: err.hint,
    });
    
    // Try to provide helpful debugging info
    if (err.code === 'ENOTFOUND') {
      console.error('[MONITORING-LOGGER] 🔍 Hint: Database hostname not found. Check DATABASE_URL.');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('[MONITORING-LOGGER] 🔍 Hint: Connection refused. Database may not be running or firewall issue.');
    } else if (err.message?.includes('SSL') || err.message?.includes('ssl')) {
      console.error('[MONITORING-LOGGER] 🔍 Hint: SSL-related error. Check if SSL is required for your database.');
    } else if (err.code === '28P01') {
      console.error('[MONITORING-LOGGER] 🔍 Hint: Authentication failed. Check username/password in DATABASE_URL.');
    }
  }
}

// Run connection test immediately (non-blocking)
testConnection().catch(err => {
  console.error('[MONITORING-LOGGER] Connection test threw exception:', err);
});

// Track if tables have been initialized
let tablesInitialized = false;

// Log levels for structured logging
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// Categories for log classification
export type LogCategory =
  | 'general'
  | 'api'
  | 'database'
  | 'auth'
  | 'search'
  | 'scraping'
  | 'ai'
  | 'pdf'
  | 'email'
  | 'session'
  | 'user'
  | 'system'
  | 'performance'
  | 'security';

interface ActivityLogData {
  userId: number;
  username: string;
  activityType: string;
  action: string;
  endpoint?: string;
  method?: string;
  requestData?: any;
  responseData?: any;
  ipAddress?: string;
  userAgent?: string;
  duration?: number;
  statusCode?: number;
  success?: boolean;
  errorMessage?: string;
  errorStack?: string;
}

interface ConsoleLogData {
  userId?: number;
  username?: string;
  logLevel: LogLevel;
  category: LogCategory;
  message: string;
  metadata?: any;
  stackTrace?: string;
  source?: string;
  requestId?: string;
  sessionId?: string;
  duration?: number;
}

interface SystemHealthData {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  message?: string;
  responseTime?: number;
  details?: any;
}

interface TokenLogData {
  userId: number;
  username: string;
  modelProvider: string;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: string;
  outputCost: string;
  totalCost: string;
  apiCallType: string;
}

interface ApiCallLogData {
  userId: number;
  username: string;
  endpoint: string;
  method: string;
  requestBody?: any;
  responseBody?: any;
  headers?: any;
  queryParams?: any;
  statusCode: number;
  duration: number;
  ipAddress?: string;
  userAgent?: string;
}

interface ErrorLogData {
  userId?: number;
  username?: string;
  errorType: string;
  errorMessage: string;
  errorStack?: string;
  endpoint?: string;
  method?: string;
  requestData?: any;
  severity?: string;
}

// ==========================================
// DETAILED USER ACTIVITY INTERFACES
// ==========================================

// Interface for detailed search activity logging
export interface SearchActivityData {
  userId: number;
  username: string;
  searchTab: 'automatisch' | 'manuelle_quellen';  // Which main tab user is using
  searchMode: 'manual' | 'datei' | 'url_only' | 'url_pdf';  // Sub-mode within the tab
  articleNumber?: string;
  productName: string;
  sourceUrls?: string[];  // URLs that were scraped
  scrapedDataSummary?: {
    totalSources: number;
    successfulSources: number;
    failedSources: number;
    totalContentLength: number;
  };
  extractedProperties?: {
    propertyName: string;
    value: string;
    confidence: number;
    source?: string;
  }[];
  processingTime?: number;
  success: boolean;
  errorMessage?: string;
  tableId?: number;  // Property table used
  tableName?: string;
}

// Interface for batch search activity logging
export interface BatchSearchActivityData {
  userId: number;
  username: string;
  searchTab: 'automatisch' | 'manuelle_quellen';
  searchMode: 'datei' | 'url_pdf';  // Batch modes
  totalProducts: number;
  products: {
    articleNumber?: string;
    productName: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    sourceUrls?: string[];
    extractedPropertiesCount?: number;
    processingTime?: number;
    errorMessage?: string;
  }[];
  startTime: number;
  endTime?: number;
  successCount: number;
  failedCount: number;
  tableId?: number;
  tableName?: string;
}

// Interface for product extraction result
export interface ProductExtractionResultData {
  userId: number;
  username: string;
  articleNumber?: string;
  productName: string;
  searchTab: 'automatisch' | 'manuelle_quellen';
  searchMode: 'manual' | 'datei' | 'url_only' | 'url_pdf';
  sourceUrl?: string;
  extractedProperties: {
    name: string;
    value: string;
    confidence: number;
    isConsistent?: boolean;
    sources?: { url: string; title: string }[];
  }[];
  rawContentPreview?: string;  // First 500 chars of scraped content for debugging
  processingTimeMs: number;
  success: boolean;
  errorMessage?: string;
}

// Interface for custom search activity (Manuelle Quellen tab)
export interface CustomSearchActivityData {
  userId: number;
  username: string;
  searchTab: 'manuelle_quellen';
  searchMode: 'url_only' | 'url_pdf';
  articleNumber?: string;
  productName: string;
  webUrl?: string;
  pdfFilesCount?: number;
  pdfFilesInfo?: string[];
  extractedProperties?: {
    name: string;
    value: string;
    confidence: number;
    isConsistent?: boolean;
    sources?: { url: string; title: string }[];
  }[];
  scrapedDataSummary?: {
    webContentLength: number;
    pdfContentLength: number;
    totalContentLength: number;
  };
  processingTime?: number;
  success: boolean;
  errorMessage?: string;
}

// New interfaces for scraping-specific error logging
export interface ScrapingErrorData {
  userId: number;
  username: string;
  url: string;
  errorType: 'scraping_failed' | 'browser_error' | 'timeout' | 'blocked' | 'invalid_content' | 'network_error';
  errorMessage: string;
  errorStack?: string;
  scrapingMethod?: 'http' | 'browser' | 'fast' | 'hybrid' | 'js-extractor' | 'html' | 'browser-rendered' | string;
  articleNumber?: string;
  productName?: string;
  contentLength?: number;
  responseTime?: number;
  httpStatus?: number;
}

export interface PdfExtractionErrorData {
  userId: number;
  username: string;
  pdfUrl?: string;
  pdfFileName?: string;
  errorType: 'extraction_failed' | 'parsing_error' | 'download_failed' | 'invalid_pdf' | 'size_limit_exceeded';
  errorMessage: string;
  errorStack?: string;
  articleNumber?: string;
  productName?: string;
  pdfSize?: number;
  pageCount?: number;
}

export interface SearchApiErrorData {
  userId: number;
  username: string;
  searchQuery: string;
  apiProvider: 'valueserp' | 'google';
  errorType: 'api_error' | 'rate_limit' | 'authentication' | 'invalid_response' | 'timeout';
  errorMessage: string;
  errorStack?: string;
  httpStatus?: number;
  articleNumber?: string;
  productName?: string;
}

export interface AiExtractionErrorData {
  userId: number;
  username: string;
  aiProvider: 'openai';
  modelName?: string;
  errorType: 'api_error' | 'rate_limit' | 'authentication' | 'context_length' | 'timeout' | 'invalid_response';
  errorMessage: string;
  errorStack?: string;
  articleNumber?: string;
  productName?: string;
  inputTokens?: number;
  sourceUrl?: string;
}

// Summary of failed URLs for batch operations
export interface BatchScrapingSummary {
  userId: number;
  username: string;
  totalUrls: number;
  successfulUrls: number;
  failedUrls: Array<{
    url: string;
    errorType: string;
    errorMessage: string;
  }>;
  articleNumber?: string;
  productName?: string;
  totalDuration?: number;
}

// ==========================================
// DETAILED SCRAPED DATA INTERFACES
// ==========================================

// Interface for storing actual scraped content
export interface ScrapedDataLogEntry {
  userId: number;
  username: string;
  articleNumber?: string;
  productName: string;
  url: string;
  scrapingMethod: 'http' | 'browser' | 'fast' | 'hybrid' | 'js-extractor' | 'html' | 'browser-rendered' | string;
  rawContent: string;  // The actual scraped HTML/text content
  contentLength: number;
  contentType?: string;  // text/html, text/plain, etc.
  title?: string;  // Page title if available
  statusCode?: number;
  responseTime: number;
  success: boolean;
  errorMessage?: string;
}

// Interface for AI API call with full prompt and response
export interface AiApiCallLogEntry {
  userId: number;
  username: string;
  articleNumber?: string;
  productName: string;
  provider: 'openai';
  modelName: string;
  apiCallType: 'extraction' | 'search' | 'validation' | 'other';
  systemPrompt?: string;
  userPrompt: string;
  rawResponse: string;  // The full AI response text
  parsedOutput?: any;  // The parsed JSON output if applicable
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: string;  // Total cost (for backward compatibility)
  inputCost?: string;  // Separate input cost (correctly calculated)
  outputCost?: string;  // Separate output cost (correctly calculated)
  apiCallId?: string;  // Unique identifier for this API call
  responseTime: number;
  success: boolean;
  errorMessage?: string;
}

// Interface for detailed extraction session (combines scraping + AI for a product)
export interface ExtractionSessionLog {
  userId: number;
  username: string;
  sessionId: string;
  articleNumber?: string;
  productName: string;
  searchTab: 'automatisch' | 'manuelle_quellen';
  searchMode: 'manual' | 'datei' | 'url_only' | 'url_pdf';
  scrapedSources: {
    url: string;
    contentPreview: string;  // First 1000 chars
    contentLength: number;
    success: boolean;
    scrapingMethod?: string;
  }[];
  aiCalls: {
    provider: string;
    model: string;
    promptPreview: string;  // First 500 chars of prompt
    responsePreview: string;  // First 500 chars of response
    tokens: number;
    cost: string;
  }[];
  extractedProperties: {
    name: string;
    value: string;
    confidence: number;
    source?: string;
  }[];
  totalProcessingTime: number;
  success: boolean;
}

export class MonitoringLogger {
  /**
   * Initialize monitoring tables if they don't exist
   * This should be called once when the main app starts
   */
  static async initialize(): Promise<void> {
    if (tablesInitialized) {
      return;
    }

    try {
      console.log('[MONITORING-LOGGER] Initializing monitoring tables...');

      // Create all monitoring tables if they don't exist
      await monitoringPool.query(`
        -- User Activity Logs
        CREATE TABLE IF NOT EXISTS user_activity_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          username TEXT NOT NULL,
          activity_type TEXT NOT NULL,
          action TEXT NOT NULL,
          endpoint TEXT,
          method TEXT,
          request_data JSONB,
          response_data JSONB,
          ip_address TEXT,
          user_agent TEXT,
          duration INTEGER,
          status_code INTEGER,
          success BOOLEAN DEFAULT true,
          error_message TEXT,
          error_stack TEXT,
          timestamp TIMESTAMP DEFAULT NOW() NOT NULL
        );

        -- Token Usage Logs
        CREATE TABLE IF NOT EXISTS token_usage_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          username TEXT NOT NULL,
          model_provider TEXT NOT NULL,
          model_name TEXT NOT NULL,
          input_tokens INTEGER NOT NULL,
          output_tokens INTEGER NOT NULL,
          total_tokens INTEGER NOT NULL,
          input_cost TEXT NOT NULL DEFAULT '0',
          output_cost TEXT NOT NULL DEFAULT '0',
          total_cost TEXT NOT NULL DEFAULT '0',
          api_call_type TEXT NOT NULL,
          timestamp TIMESTAMP DEFAULT NOW() NOT NULL
        );

        -- API Call Logs
        CREATE TABLE IF NOT EXISTS api_call_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          username TEXT NOT NULL,
          endpoint TEXT NOT NULL,
          method TEXT NOT NULL,
          request_body JSONB,
          response_body JSONB,
          headers JSONB,
          query_params JSONB,
          status_code INTEGER NOT NULL,
          duration INTEGER NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          timestamp TIMESTAMP DEFAULT NOW() NOT NULL
        );

        -- Error Logs
        CREATE TABLE IF NOT EXISTS error_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          username TEXT,
          error_type TEXT NOT NULL,
          error_message TEXT NOT NULL,
          error_stack TEXT,
          endpoint TEXT,
          method TEXT,
          request_data JSONB,
          severity TEXT NOT NULL DEFAULT 'error',
          resolved BOOLEAN DEFAULT false,
          timestamp TIMESTAMP DEFAULT NOW() NOT NULL
        );

        -- User Sessions
        CREATE TABLE IF NOT EXISTS user_sessions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          username TEXT NOT NULL,
          session_id TEXT NOT NULL,
          login_time TIMESTAMP NOT NULL,
          logout_time TIMESTAMP,
          ip_address TEXT,
          user_agent TEXT,
          is_active BOOLEAN DEFAULT true,
          duration INTEGER
        );

        -- User Statistics
        CREATE TABLE IF NOT EXISTS user_statistics (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL UNIQUE,
          username TEXT NOT NULL,
          total_api_calls INTEGER DEFAULT 0,
          total_tokens_used BIGINT DEFAULT 0,
          total_cost TEXT DEFAULT '0',
          total_errors INTEGER DEFAULT 0,
          total_sessions INTEGER DEFAULT 0,
          last_activity TIMESTAMP,
          first_seen TIMESTAMP DEFAULT NOW(),
          last_updated TIMESTAMP DEFAULT NOW()
        );

        -- Console/Terminal Output Logs
        CREATE TABLE IF NOT EXISTS console_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          username TEXT,
          log_level TEXT NOT NULL DEFAULT 'info',
          category TEXT NOT NULL DEFAULT 'general',
          message TEXT NOT NULL,
          metadata JSONB,
          stack_trace TEXT,
          source TEXT,
          request_id TEXT,
          session_id TEXT,
          duration INTEGER,
          timestamp TIMESTAMP DEFAULT NOW() NOT NULL
        );

        -- System Health Status
        CREATE TABLE IF NOT EXISTS system_health (
          id SERIAL PRIMARY KEY,
          component TEXT NOT NULL,
          status TEXT NOT NULL,
          message TEXT,
          response_time INTEGER,
          details JSONB,
          checked_at TIMESTAMP DEFAULT NOW() NOT NULL
        );

        -- System Metrics
        CREATE TABLE IF NOT EXISTS system_metrics (
          id SERIAL PRIMARY KEY,
          metric_type TEXT NOT NULL,
          metric_value TEXT NOT NULL,
          unit TEXT,
          timestamp TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `);

      // Create indexes for performance
      await monitoringPool.query(`
        -- Indexes for user_activity_logs
        CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_activity_logs_timestamp ON user_activity_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_timestamp ON user_activity_logs(user_id, timestamp);
        CREATE INDEX IF NOT EXISTS idx_user_activity_logs_activity_type ON user_activity_logs(activity_type);

        -- Indexes for token_usage_logs
        CREATE INDEX IF NOT EXISTS idx_token_usage_logs_user_id ON token_usage_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_token_usage_logs_timestamp ON token_usage_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_token_usage_logs_user_timestamp ON token_usage_logs(user_id, timestamp);

        -- Indexes for api_call_logs
        CREATE INDEX IF NOT EXISTS idx_api_call_logs_user_id ON api_call_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_api_call_logs_timestamp ON api_call_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_api_call_logs_endpoint ON api_call_logs(endpoint);

        -- Indexes for error_logs
        CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
        CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);

        -- Indexes for user_sessions
        CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);

        -- Indexes for console_logs
        CREATE INDEX IF NOT EXISTS idx_console_logs_user_id ON console_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_console_logs_timestamp ON console_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_console_logs_log_level ON console_logs(log_level);
        CREATE INDEX IF NOT EXISTS idx_console_logs_category ON console_logs(category);
        CREATE INDEX IF NOT EXISTS idx_console_logs_source ON console_logs(source);
        CREATE INDEX IF NOT EXISTS idx_console_logs_user_timestamp ON console_logs(user_id, timestamp);

        -- Indexes for system_health
        CREATE INDEX IF NOT EXISTS idx_system_health_component ON system_health(component);
        CREATE INDEX IF NOT EXISTS idx_system_health_checked_at ON system_health(checked_at);
        CREATE INDEX IF NOT EXISTS idx_system_health_status ON system_health(status);
      `);

      tablesInitialized = true;
      console.log('[MONITORING-LOGGER] ✅ Monitoring tables initialized successfully');
    } catch (error) {
      console.error('[MONITORING-LOGGER] ❌ Failed to initialize monitoring tables:', error);
      // Don't throw - allow the app to continue without monitoring if DB init fails
    }
  }

  /**
   * Ensure tables are initialized before logging
   * This is called automatically by logging methods
   */
  private static async ensureInitialized(): Promise<boolean> {
    if (!tablesInitialized) {
      await this.initialize();
    }
    return tablesInitialized;
  }

  /**
   * Log user activity
   */
  static async logActivity(data: ActivityLogData): Promise<void> {
    try {
      await this.ensureInitialized();
      await monitoringPool.query(
        `INSERT INTO user_activity_logs (
          user_id, username, activity_type, action, endpoint, method,
          request_data, response_data, ip_address, user_agent, duration,
          status_code, success, error_message, error_stack
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          data.userId,
          data.username,
          data.activityType,
          data.action,
          data.endpoint || null,
          data.method || null,
          data.requestData ? JSON.stringify(data.requestData) : null,
          data.responseData ? JSON.stringify(data.responseData) : null,
          data.ipAddress || null,
          data.userAgent || null,
          data.duration || null,
          data.statusCode || null,
          data.success !== undefined ? data.success : true,
          data.errorMessage || null,
          data.errorStack || null,
        ]
      );

      // Update user statistics
      await this.updateUserStatistics(data.userId);
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to log activity:', error);
    }
  }

  /**
   * Log token usage
   */
  static async logTokenUsage(data: TokenLogData): Promise<void> {
    try {
      await this.ensureInitialized();
      await monitoringPool.query(
        `INSERT INTO token_usage_logs (
          user_id, username, model_provider, model_name, input_tokens,
          output_tokens, total_tokens, input_cost, output_cost, total_cost,
          api_call_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          data.userId,
          data.username,
          data.modelProvider,
          data.modelName,
          data.inputTokens,
          data.outputTokens,
          data.totalTokens,
          data.inputCost,
          data.outputCost,
          data.totalCost,
          data.apiCallType,
        ]
      );

      // Update user statistics
      await this.updateUserStatistics(data.userId);
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to log token usage:', error);
    }
  }

  /**
   * Log API call
   */
  static async logApiCall(data: ApiCallLogData): Promise<void> {
    try {
      await this.ensureInitialized();
      await monitoringPool.query(
        `INSERT INTO api_call_logs (
          user_id, username, endpoint, method, request_body, response_body,
          headers, query_params, status_code, duration, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          data.userId,
          data.username,
          data.endpoint,
          data.method,
          data.requestBody ? JSON.stringify(data.requestBody) : null,
          data.responseBody ? JSON.stringify(data.responseBody) : null,
          data.headers ? JSON.stringify(data.headers) : null,
          data.queryParams ? JSON.stringify(data.queryParams) : null,
          data.statusCode,
          data.duration,
          data.ipAddress || null,
          data.userAgent || null,
        ]
      );

      // Update user statistics
      await this.updateUserStatistics(data.userId);
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to log API call:', error);
    }
  }

  /**
   * Log error
   */
  static async logError(data: ErrorLogData): Promise<void> {
    try {
      await this.ensureInitialized();
      await monitoringPool.query(
        `INSERT INTO error_logs (
          user_id, username, error_type, error_message, error_stack,
          endpoint, method, request_data, severity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          data.userId || null,
          data.username || null,
          data.errorType,
          data.errorMessage,
          data.errorStack || null,
          data.endpoint || null,
          data.method || null,
          data.requestData ? JSON.stringify(data.requestData) : null,
          data.severity || 'error',
        ]
      );

      // Update user statistics if userId is provided
      if (data.userId) {
        await this.updateUserStatistics(data.userId);
      }
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to log error:', error);
    }
  }

  // ==========================================
  // SCRAPING-SPECIFIC ERROR LOGGING METHODS
  // ==========================================

  /**
   * Log a scraping error for a specific URL
   */
  static async logScrapingError(data: ScrapingErrorData): Promise<void> {
    try {
      await this.ensureInitialized();
      // Log to error_logs table with detailed scraping information
      await monitoringPool.query(
        `INSERT INTO error_logs (
          user_id, username, error_type, error_message, error_stack,
          endpoint, method, request_data, severity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          data.userId,
          data.username,
          `scraping:${data.errorType}`,
          data.errorMessage,
          data.errorStack || null,
          data.url,
          data.scrapingMethod || 'unknown',
          JSON.stringify({
            url: data.url,
            articleNumber: data.articleNumber,
            productName: data.productName,
            scrapingMethod: data.scrapingMethod,
            contentLength: data.contentLength,
            responseTime: data.responseTime,
            httpStatus: data.httpStatus,
          }),
          'error',
        ]
      );

      // Also log to console_logs for real-time monitoring
      await this.logConsole({
        userId: data.userId,
        username: data.username,
        logLevel: 'error',
        category: 'scraping',
        message: `[SCRAPING-ERROR] Failed to scrape ${data.url}: ${data.errorMessage}`,
        metadata: {
          url: data.url,
          errorType: data.errorType,
          scrapingMethod: data.scrapingMethod,
          articleNumber: data.articleNumber,
          productName: data.productName,
          contentLength: data.contentLength,
          responseTime: data.responseTime,
          httpStatus: data.httpStatus,
        },
        stackTrace: data.errorStack,
        source: 'scraping-service',
      });

      // Update user statistics
      await this.updateUserStatistics(data.userId);

      console.log(`[MONITORING] Logged scraping error for user ${data.username}: ${data.url} - ${data.errorType}`);
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to log scraping error:', error);
    }
  }

  /**
   * Log a PDF extraction error
   */
  static async logPdfExtractionError(data: PdfExtractionErrorData): Promise<void> {
    try {
      await this.ensureInitialized();
      await monitoringPool.query(
        `INSERT INTO error_logs (
          user_id, username, error_type, error_message, error_stack,
          endpoint, method, request_data, severity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          data.userId,
          data.username,
          `pdf:${data.errorType}`,
          data.errorMessage,
          data.errorStack || null,
          data.pdfUrl || data.pdfFileName || 'unknown',
          'pdf-extraction',
          JSON.stringify({
            pdfUrl: data.pdfUrl,
            pdfFileName: data.pdfFileName,
            articleNumber: data.articleNumber,
            productName: data.productName,
            pdfSize: data.pdfSize,
            pageCount: data.pageCount,
          }),
          'error',
        ]
      );

      await this.logConsole({
        userId: data.userId,
        username: data.username,
        logLevel: 'error',
        category: 'pdf',
        message: `[PDF-ERROR] Failed to extract ${data.pdfFileName || data.pdfUrl}: ${data.errorMessage}`,
        metadata: {
          pdfUrl: data.pdfUrl,
          pdfFileName: data.pdfFileName,
          errorType: data.errorType,
          articleNumber: data.articleNumber,
          productName: data.productName,
          pdfSize: data.pdfSize,
          pageCount: data.pageCount,
        },
        stackTrace: data.errorStack,
        source: 'pdf-extractor',
      });

      await this.updateUserStatistics(data.userId);

      console.log(`[MONITORING] Logged PDF error for user ${data.username}: ${data.pdfFileName || data.pdfUrl} - ${data.errorType}`);
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to log PDF extraction error:', error);
    }
  }

  /**
   * Log a search API error
   */
  static async logSearchApiError(data: SearchApiErrorData): Promise<void> {
    try {
      await this.ensureInitialized();
      await monitoringPool.query(
        `INSERT INTO error_logs (
          user_id, username, error_type, error_message, error_stack,
          endpoint, method, request_data, severity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          data.userId,
          data.username,
          `search_api:${data.errorType}`,
          data.errorMessage,
          data.errorStack || null,
          data.apiProvider,
          'search',
          JSON.stringify({
            searchQuery: data.searchQuery,
            apiProvider: data.apiProvider,
            httpStatus: data.httpStatus,
            articleNumber: data.articleNumber,
            productName: data.productName,
          }),
          data.errorType === 'rate_limit' ? 'warning' : 'error',
        ]
      );

      await this.logConsole({
        userId: data.userId,
        username: data.username,
        logLevel: data.errorType === 'rate_limit' ? 'warn' : 'error',
        category: 'search',
        message: `[SEARCH-API-ERROR] ${data.apiProvider} error: ${data.errorMessage}`,
        metadata: {
          searchQuery: data.searchQuery,
          apiProvider: data.apiProvider,
          errorType: data.errorType,
          httpStatus: data.httpStatus,
          articleNumber: data.articleNumber,
          productName: data.productName,
        },
        stackTrace: data.errorStack,
        source: 'search-service',
      });

      await this.updateUserStatistics(data.userId);

      console.log(`[MONITORING] Logged search API error for user ${data.username}: ${data.apiProvider} - ${data.errorType}`);
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to log search API error:', error);
    }
  }

  /**
   * Log an AI extraction error
   */
  static async logAiExtractionError(data: AiExtractionErrorData): Promise<void> {
    try {
      await this.ensureInitialized();
      await monitoringPool.query(
        `INSERT INTO error_logs (
          user_id, username, error_type, error_message, error_stack,
          endpoint, method, request_data, severity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          data.userId,
          data.username,
          `ai:${data.errorType}`,
          data.errorMessage,
          data.errorStack || null,
          data.aiProvider,
          'ai-extraction',
          JSON.stringify({
            aiProvider: data.aiProvider,
            modelName: data.modelName,
            articleNumber: data.articleNumber,
            productName: data.productName,
            inputTokens: data.inputTokens,
            sourceUrl: data.sourceUrl,
          }),
          data.errorType === 'rate_limit' ? 'warning' : 'error',
        ]
      );

      await this.logConsole({
        userId: data.userId,
        username: data.username,
        logLevel: data.errorType === 'rate_limit' ? 'warn' : 'error',
        category: 'ai',
        message: `[AI-ERROR] ${data.aiProvider} extraction failed: ${data.errorMessage}`,
        metadata: {
          aiProvider: data.aiProvider,
          modelName: data.modelName,
          errorType: data.errorType,
          articleNumber: data.articleNumber,
          productName: data.productName,
          inputTokens: data.inputTokens,
          sourceUrl: data.sourceUrl,
        },
        stackTrace: data.errorStack,
        source: 'ai-service',
      });

      await this.updateUserStatistics(data.userId);

      console.log(`[MONITORING] Logged AI error for user ${data.username}: ${data.aiProvider} - ${data.errorType}`);
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to log AI extraction error:', error);
    }
  }

  /**
   * Log a batch scraping summary (for showing which URLs failed in a batch operation)
   */
  static async logBatchScrapingSummary(data: BatchScrapingSummary): Promise<void> {
    try {
      await this.ensureInitialized();
      // Log each failed URL as a separate error
      for (const failedUrl of data.failedUrls) {
        await monitoringPool.query(
          `INSERT INTO error_logs (
            user_id, username, error_type, error_message, error_stack,
            endpoint, method, request_data, severity
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            data.userId,
            data.username,
            `batch_scraping:${failedUrl.errorType}`,
            failedUrl.errorMessage,
            null,
            failedUrl.url,
            'batch-scraping',
            JSON.stringify({
              url: failedUrl.url,
              articleNumber: data.articleNumber,
              productName: data.productName,
              batchTotal: data.totalUrls,
              batchSuccessful: data.successfulUrls,
              batchFailed: data.failedUrls.length,
            }),
            'error',
          ]
        );
      }

      // Log a summary console message
      await this.logConsole({
        userId: data.userId,
        username: data.username,
        logLevel: data.failedUrls.length > 0 ? 'warn' : 'info',
        category: 'scraping',
        message: `[BATCH-SCRAPING] Completed: ${data.successfulUrls}/${data.totalUrls} successful, ${data.failedUrls.length} failed`,
        metadata: {
          totalUrls: data.totalUrls,
          successfulUrls: data.successfulUrls,
          failedUrls: data.failedUrls,
          articleNumber: data.articleNumber,
          productName: data.productName,
          totalDuration: data.totalDuration,
        },
        source: 'batch-scraping',
        duration: data.totalDuration,
      });

      await this.updateUserStatistics(data.userId);

      console.log(`[MONITORING] Logged batch summary for user ${data.username}: ${data.successfulUrls}/${data.totalUrls} successful, ${data.failedUrls.length} failed`);
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to log batch scraping summary:', error);
    }
  }

  /**
   * Log a warning for skipped content (e.g., PDF scraper disabled)
   * Logs to both error_logs (as warning) and console_logs for visibility
   */
  static async logContentSkipped(
    userId: number,
    username: string,
    url: string,
    reason: string,
    metadata?: { articleNumber?: string; productName?: string; contentType?: string }
  ): Promise<void> {
    try {
      await this.ensureInitialized();
      // Log to error_logs table as a warning so it appears in the Errors page
      await monitoringPool.query(
        `INSERT INTO error_logs (
          user_id, username, error_type, error_message, error_stack,
          endpoint, method, request_data, severity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId,
          username,
          'content:skipped',
          `Content skipped: ${reason}`,
          null,
          url,
          'content-filter',
          JSON.stringify({
            url,
            reason,
            articleNumber: metadata?.articleNumber,
            productName: metadata?.productName,
            contentType: metadata?.contentType,
          }),
          'warning',
        ]
      );

      // Also log to console_logs for real-time monitoring
      await this.logConsole({
        userId,
        username,
        logLevel: 'warn',
        category: 'scraping',
        message: `[CONTENT-SKIPPED] ${url}: ${reason}`,
        metadata: {
          url,
          reason,
          ...metadata,
        },
        source: 'content-filter',
      });

      console.log(`[MONITORING] Logged skipped content for user ${username}: ${url} - ${reason}`);
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to log content skipped:', error);
    }
  }

  /**
   * Log user session
   */
  static async logSession(
    userId: number,
    username: string,
    sessionId: string,
    action: 'login' | 'logout',
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await this.ensureInitialized();
      if (action === 'login') {
        await monitoringPool.query(
          `INSERT INTO user_sessions (user_id, username, session_id, login_time, ip_address, user_agent, is_active)
           VALUES ($1, $2, $3, NOW(), $4, $5, true)`,
          [userId, username, sessionId, ipAddress || null, userAgent || null]
        );
      } else {
        await monitoringPool.query(
          `UPDATE user_sessions 
           SET logout_time = NOW(), 
               is_active = false,
               duration = EXTRACT(EPOCH FROM (NOW() - login_time))::INTEGER
           WHERE session_id = $1 AND is_active = true`,
          [sessionId]
        );
      }

      // Update user statistics
      await this.updateUserStatistics(userId);
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to log session:', error);
    }
  }

  /**
   * Update user statistics
   */
  private static async updateUserStatistics(userId: number): Promise<void> {
    try {
      // Get username
      const userResult = await monitoringPool.query(
        'SELECT username FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) return;

      const username = userResult.rows[0].username;

      // Calculate statistics
      const apiCallsResult = await monitoringPool.query(
        'SELECT COUNT(*) FROM api_call_logs WHERE user_id = $1',
        [userId]
      );

      const tokensResult = await monitoringPool.query(
        'SELECT SUM(total_tokens) as total, SUM(CAST(total_cost AS DECIMAL)) as cost FROM token_usage_logs WHERE user_id = $1',
        [userId]
      );

      const errorsResult = await monitoringPool.query(
        'SELECT COUNT(*) FROM error_logs WHERE user_id = $1',
        [userId]
      );

      const sessionsResult = await monitoringPool.query(
        'SELECT COUNT(*) FROM user_sessions WHERE user_id = $1',
        [userId]
      );

      const totalApiCalls = parseInt(apiCallsResult.rows[0].count) || 0;
      const totalTokens = parseInt(tokensResult.rows[0].total) || 0;
      const totalCost = tokensResult.rows[0].cost || '0';
      const totalErrors = parseInt(errorsResult.rows[0].count) || 0;
      const totalSessions = parseInt(sessionsResult.rows[0].count) || 0;

      // Upsert statistics
      await monitoringPool.query(
        `INSERT INTO user_statistics (
          user_id, username, total_api_calls, total_tokens_used, total_cost,
          total_errors, total_sessions, last_activity, last_updated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          total_api_calls = $3,
          total_tokens_used = $4,
          total_cost = $5,
          total_errors = $6,
          total_sessions = $7,
          last_activity = NOW(),
          last_updated = NOW()`,
        [userId, username, totalApiCalls, totalTokens, totalCost.toString(), totalErrors, totalSessions]
      );
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to update user statistics:', error);
    }
  }

  /**
   * Close the monitoring pool (for graceful shutdown)
   */
  static async close(): Promise<void> {
    await monitoringPool.end();
  }

  // ==========================================
  // CONSOLE/TERMINAL LOGGING METHODS
  // ==========================================

  /**
   * Log a console message (captures terminal output per user)
   */
  static async logConsole(data: ConsoleLogData): Promise<void> {
    // Extra logging for AI API calls which are critical for token tracking
    const isAiApiCall = data.source === 'ai-api-call';
    if (isAiApiCall) {
      console.log(`[MONITORING-LOGGER] logConsole called for AI API call: ${data.message?.substring(0, 100)}...`);
    }
    
    try {
      await this.ensureInitialized();
      
      const result = await monitoringPool.query(
        `INSERT INTO console_logs (
          user_id, username, log_level, category, message,
          metadata, stack_trace, source, request_id, session_id, duration
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id`,
        [
          data.userId || null,
          data.username || null,
          data.logLevel,
          data.category,
          data.message,
          data.metadata ? JSON.stringify(data.metadata) : null,
          data.stackTrace || null,
          data.source || null,
          data.requestId || null,
          data.sessionId || null,
          data.duration || null,
        ]
      );
      
      // Confirm successful insert for AI API calls
      if (isAiApiCall && result.rows[0]?.id) {
        console.log(`[MONITORING-LOGGER] ✅ AI API call logged to console_logs with id: ${result.rows[0].id}`);
      }
    } catch (error: any) {
      // Handle duplicate key violation - sequence might be out of sync
      if (error.code === '23505' && error.constraint === 'console_logs_pkey') {
        console.log('[MONITORING-LOGGER] Detected sequence out of sync for console_logs, attempting to fix...');
        
        try {
          // Reset the sequence to the max current ID + 1
          await monitoringPool.query(`
            SELECT setval(
              pg_get_serial_sequence('console_logs', 'id'),
              COALESCE((SELECT MAX(id) FROM console_logs), 0) + 1,
              false
            )
          `);
          console.log('[MONITORING-LOGGER] Sequence reset successful, retrying insert...');
          
          // Retry the insert
          const retryResult = await monitoringPool.query(
            `INSERT INTO console_logs (
              user_id, username, log_level, category, message,
              metadata, stack_trace, source, request_id, session_id, duration
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id`,
            [
              data.userId || null,
              data.username || null,
              data.logLevel,
              data.category,
              data.message,
              data.metadata ? JSON.stringify(data.metadata) : null,
              data.stackTrace || null,
              data.source || null,
              data.requestId || null,
              data.sessionId || null,
              data.duration || null,
            ]
          );
          
          // Confirm successful insert for AI API calls
          if (isAiApiCall && retryResult.rows[0]?.id) {
            console.log(`[MONITORING-LOGGER] ✅ AI API call logged to console_logs with id: ${retryResult.rows[0].id} (after sequence fix)`);
          }
          return; // Success after retry
        } catch (retryError: any) {
          console.error('[MONITORING-LOGGER] ❌ Failed to fix sequence and retry:', retryError.message);
          // Fall through to standard error handling
        }
      }
      
      // Don't fail silently but also don't break the app
      console.error('[MONITORING-LOGGER] ❌ Failed to log console message:', {
        error: error.message,
        code: error.code,
        source: data.source,
        category: data.category,
        userId: data.userId,
      });
      
      // Additional diagnostics for AI API calls
      if (isAiApiCall) {
        console.error('[MONITORING-LOGGER] ⚠️ AI API call logging failed - token tracking will not work for this call');
        console.error('[MONITORING-LOGGER] Connection status:', {
          connectionVerified,
          connectionError,
          tablesInitialized,
        });
      }
    }
  }

  /**
   * Log a debug message
   */
  static async debug(
    message: string,
    category: LogCategory = 'general',
    options?: { userId?: number; username?: string; metadata?: any; source?: string; requestId?: string; sessionId?: string }
  ): Promise<void> {
    await this.logConsole({
      logLevel: 'debug',
      category,
      message,
      ...options
    });
  }

  /**
   * Log an info message
   */
  static async info(
    message: string,
    category: LogCategory = 'general',
    options?: { userId?: number; username?: string; metadata?: any; source?: string; requestId?: string; sessionId?: string }
  ): Promise<void> {
    await this.logConsole({
      logLevel: 'info',
      category,
      message,
      ...options
    });
  }

  /**
   * Log a warning message
   */
  static async warn(
    message: string,
    category: LogCategory = 'general',
    options?: { userId?: number; username?: string; metadata?: any; source?: string; requestId?: string; sessionId?: string }
  ): Promise<void> {
    await this.logConsole({
      logLevel: 'warn',
      category,
      message,
      ...options
    });
  }

  /**
   * Log an error message with stack trace
   */
  static async error(
    message: string,
    error?: Error,
    category: LogCategory = 'general',
    options?: { userId?: number; username?: string; metadata?: any; source?: string; requestId?: string; sessionId?: string }
  ): Promise<void> {
    await this.logConsole({
      logLevel: 'error',
      category,
      message,
      stackTrace: error?.stack,
      metadata: {
        ...options?.metadata,
        errorName: error?.name,
        errorMessage: error?.message,
      },
      ...options
    });

    // Also log to error_logs for critical tracking
    if (options?.userId) {
      await this.logError({
        userId: options.userId,
        username: options.username,
        errorType: error?.name || 'Error',
        errorMessage: message,
        errorStack: error?.stack,
        severity: 'error',
      });
    }
  }

  /**
   * Log a fatal error
   */
  static async fatal(
    message: string,
    error?: Error,
    category: LogCategory = 'general',
    options?: { userId?: number; username?: string; metadata?: any; source?: string; requestId?: string; sessionId?: string }
  ): Promise<void> {
    await this.logConsole({
      logLevel: 'fatal',
      category,
      message,
      stackTrace: error?.stack,
      metadata: {
        ...options?.metadata,
        errorName: error?.name,
        errorMessage: error?.message,
      },
      ...options
    });

    // Also log to error_logs as critical
    if (options?.userId) {
      await this.logError({
        userId: options.userId,
        username: options.username,
        errorType: error?.name || 'FatalError',
        errorMessage: message,
        errorStack: error?.stack,
        severity: 'critical',
      });
    }
  }

  // ==========================================
  // SYSTEM HEALTH METHODS
  // ==========================================

  /**
   * Record system health check result
   */
  static async recordHealthCheck(data: SystemHealthData): Promise<void> {
    try {
      await this.ensureInitialized();
      await monitoringPool.query(
        `INSERT INTO system_health (
          component, status, message, response_time, details
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          data.component,
          data.status,
          data.message || null,
          data.responseTime || null,
          data.details ? JSON.stringify(data.details) : null,
        ]
      );
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to record health check:', error);
    }
  }

  /**
   * Get latest health status for all components
   */
  static async getSystemHealth(): Promise<SystemHealthData[]> {
    try {
      const result = await monitoringPool.query(`
        SELECT DISTINCT ON (component)
          component, status, message, response_time as "responseTime", details, checked_at as "checkedAt"
        FROM system_health
        ORDER BY component, checked_at DESC
      `);
      return result.rows;
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to get system health:', error);
      return [];
    }
  }

  /**
   * Perform and record a database health check
   */
  static async checkDatabaseHealth(): Promise<SystemHealthData> {
    const startTime = Date.now();
    try {
      await monitoringPool.query('SELECT 1');
      const responseTime = Date.now() - startTime;
      
      const healthData: SystemHealthData = {
        component: 'database',
        status: responseTime < 1000 ? 'healthy' : responseTime < 3000 ? 'degraded' : 'unhealthy',
        message: `Database responding in ${responseTime}ms`,
        responseTime,
        details: { connectionPool: 'active' }
      };
      
      await this.recordHealthCheck(healthData);
      return healthData;
    } catch (error) {
      const healthData: SystemHealthData = {
        component: 'database',
        status: 'unhealthy',
        message: `Database error: ${(error as Error).message}`,
        responseTime: Date.now() - startTime,
        details: { error: (error as Error).message }
      };
      
      await this.recordHealthCheck(healthData);
      return healthData;
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Generate a unique request ID for log correlation
   */
  static generateRequestId(): string {
    return uuidv4();
  }

  /**
   * Create a logger context for a specific user/request
   */
  static createContext(userId?: number, username?: string, requestId?: string, sessionId?: string) {
    const contextRequestId = requestId || this.generateRequestId();
    
    return {
      requestId: contextRequestId,
      userId,
      username,
      sessionId,
      
      debug: (message: string, category: LogCategory = 'general', metadata?: any) =>
        this.debug(message, category, { userId, username, metadata, requestId: contextRequestId, sessionId }),
      
      info: (message: string, category: LogCategory = 'general', metadata?: any) =>
        this.info(message, category, { userId, username, metadata, requestId: contextRequestId, sessionId }),
      
      warn: (message: string, category: LogCategory = 'general', metadata?: any) =>
        this.warn(message, category, { userId, username, metadata, requestId: contextRequestId, sessionId }),
      
      error: (message: string, error?: Error, category: LogCategory = 'general', metadata?: any) =>
        this.error(message, error, category, { userId, username, metadata, requestId: contextRequestId, sessionId }),
      
      fatal: (message: string, error?: Error, category: LogCategory = 'general', metadata?: any) =>
        this.fatal(message, error, category, { userId, username, metadata, requestId: contextRequestId, sessionId }),
    };
  }

  /**
   * Log a performance metric (operation timing)
   */
  static async logPerformance(
    operation: string,
    duration: number,
    options?: { userId?: number; username?: string; metadata?: any; requestId?: string; sessionId?: string }
  ): Promise<void> {
    await this.logConsole({
      logLevel: duration > 5000 ? 'warn' : 'info',
      category: 'performance',
      message: `[PERF] ${operation} completed in ${duration}ms`,
      duration,
      ...options
    });
  }

  /**
   * Wrap an async function with performance logging
   */
  static async withTiming<T>(
    operation: string,
    fn: () => Promise<T>,
    options?: { userId?: number; username?: string; requestId?: string; sessionId?: string }
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      await this.logPerformance(operation, duration, options);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.error(
        `[PERF] ${operation} failed after ${duration}ms`,
        error as Error,
        'performance',
        { ...options, metadata: { operation, duration } }
      );
      throw error;
    }
  }

  // ==========================================
  // DETAILED USER SEARCH ACTIVITY METHODS
  // ==========================================

  /**
   * Log a detailed search activity (single product search)
   * This captures the full context of what the user is doing in the app
   */
  static async logSearchActivity(data: SearchActivityData): Promise<void> {
    try {
      // Determine activity type based on tab and mode
      const activityType = `search:${data.searchTab}:${data.searchMode}`;
      
      // Create a human-readable action description
      let actionDescription = '';
      if (data.searchTab === 'automatisch') {
        if (data.searchMode === 'manual') {
          actionDescription = `Automatisch Tab - Einzeln Mode: Searched for "${data.productName}"${data.articleNumber ? ` (${data.articleNumber})` : ''}`;
        } else if (data.searchMode === 'datei') {
          actionDescription = `Automatisch Tab - Datei Mode (Excel Upload): Processed "${data.productName}"${data.articleNumber ? ` (${data.articleNumber})` : ''}`;
        }
      } else if (data.searchTab === 'manuelle_quellen') {
        if (data.searchMode === 'url_only') {
          actionDescription = `Manuelle Quellen Tab - URL Only: Extracted from "${data.productName}"${data.articleNumber ? ` (${data.articleNumber})` : ''}`;
        } else if (data.searchMode === 'url_pdf') {
          actionDescription = `Manuelle Quellen Tab - URL+PDF Mode: Extracted from "${data.productName}"${data.articleNumber ? ` (${data.articleNumber})` : ''}`;
        }
      }

      // Log to user_activity_logs with rich metadata
      await this.logActivity({
        userId: data.userId,
        username: data.username,
        activityType,
        action: actionDescription,
        endpoint: `/api/${data.searchMode === 'manual' ? 'analyze-content' : 'batch-analyze-content'}`,
        method: 'POST',
        requestData: {
          searchTab: data.searchTab,
          searchMode: data.searchMode,
          articleNumber: data.articleNumber,
          productName: data.productName,
          tableId: data.tableId,
          tableName: data.tableName,
          sourceUrls: data.sourceUrls?.slice(0, 10), // Limit to first 10 URLs for storage
        },
        responseData: {
          scrapedDataSummary: data.scrapedDataSummary,
          extractedPropertiesCount: data.extractedProperties?.length || 0,
          extractedProperties: data.extractedProperties, // Log all properties for monitoring
        },
        duration: data.processingTime,
        success: data.success,
        errorMessage: data.errorMessage,
      });

      // Also log to console_logs for real-time visibility
      await this.logConsole({
        userId: data.userId,
        username: data.username,
        logLevel: data.success ? 'info' : 'error',
        category: 'search',
        message: `[SEARCH-ACTIVITY] ${actionDescription}`,
        metadata: {
          searchTab: data.searchTab,
          searchMode: data.searchMode,
          articleNumber: data.articleNumber,
          productName: data.productName,
          sourcesCount: data.sourceUrls?.length || 0,
          scrapedDataSummary: data.scrapedDataSummary,
          extractedPropertiesCount: data.extractedProperties?.length || 0,
          tableId: data.tableId,
          tableName: data.tableName,
          processingTime: data.processingTime,
          success: data.success,
        },
        source: 'search-activity',
        duration: data.processingTime,
      });

      console.log(`[MONITORING] Logged search activity for user ${data.username}: ${activityType} - ${data.productName}`);
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to log search activity:', error);
    }
  }

  /**
   * Log a batch search activity (file upload with multiple products)
   * This captures the overview of a batch operation
   */
  static async logBatchSearchActivity(data: BatchSearchActivityData): Promise<void> {
    try {
      const activityType = `batch_search:${data.searchTab}:${data.searchMode}`;
      const totalTime = data.endTime ? data.endTime - data.startTime : undefined;
      
      // Create action description
      let actionDescription = '';
      if (data.searchTab === 'automatisch') {
        actionDescription = `Automatisch Tab - Datei Mode (Excel): Batch processed ${data.totalProducts} products (${data.successCount} success, ${data.failedCount} failed)`;
      } else {
        actionDescription = `Manuelle Quellen Tab - URL+PDF Batch: Processed ${data.totalProducts} products (${data.successCount} success, ${data.failedCount} failed)`;
      }

      // Log to user_activity_logs
      await this.logActivity({
        userId: data.userId,
        username: data.username,
        activityType,
        action: actionDescription,
        endpoint: '/api/batch-analyze-content',
        method: 'POST',
        requestData: {
          searchTab: data.searchTab,
          searchMode: data.searchMode,
          totalProducts: data.totalProducts,
          tableId: data.tableId,
          tableName: data.tableName,
          products: data.products.map(p => ({
            articleNumber: p.articleNumber,
            productName: p.productName,
            status: p.status,
          })),
        },
        responseData: {
          successCount: data.successCount,
          failedCount: data.failedCount,
          products: data.products.map(p => ({
            articleNumber: p.articleNumber,
            productName: p.productName,
            status: p.status,
            extractedPropertiesCount: p.extractedPropertiesCount,
            processingTime: p.processingTime,
            errorMessage: p.errorMessage,
          })),
        },
        duration: totalTime,
        success: data.failedCount === 0,
        errorMessage: data.failedCount > 0 ? `${data.failedCount} products failed to process` : undefined,
      });

      // Log to console_logs for visibility
      await this.logConsole({
        userId: data.userId,
        username: data.username,
        logLevel: data.failedCount === 0 ? 'info' : 'warn',
        category: 'search',
        message: `[BATCH-SEARCH] ${actionDescription}`,
        metadata: {
          searchTab: data.searchTab,
          searchMode: data.searchMode,
          totalProducts: data.totalProducts,
          successCount: data.successCount,
          failedCount: data.failedCount,
          tableId: data.tableId,
          tableName: data.tableName,
          totalTime,
          products: data.products.map(p => ({
            articleNumber: p.articleNumber,
            productName: p.productName,
            status: p.status,
            sourceUrlsCount: p.sourceUrls?.length || 0,
            extractedPropertiesCount: p.extractedPropertiesCount,
          })),
        },
        source: 'batch-search',
        duration: totalTime,
      });

      console.log(`[MONITORING] Logged batch search for user ${data.username}: ${data.totalProducts} products, ${data.successCount} success, ${data.failedCount} failed`);
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to log batch search activity:', error);
    }
  }

  /**
   * Log individual product extraction result with full details
   * This is for detailed per-product logging with extracted properties
   */
  static async logProductExtractionResult(data: ProductExtractionResultData): Promise<void> {
    try {
      const activityType = `extraction:${data.searchTab}:${data.searchMode}`;
      
      // Create detailed action description
      const actionDescription = `Extracted ${data.extractedProperties.length} properties from "${data.productName}"${data.articleNumber ? ` (${data.articleNumber})` : ''}`;

      // Log detailed console entry with all extraction details
      await this.logConsole({
        userId: data.userId,
        username: data.username,
        logLevel: data.success ? 'info' : 'error',
        category: 'ai',
        message: `[EXTRACTION-RESULT] ${actionDescription}`,
        metadata: {
          searchTab: data.searchTab,
          searchMode: data.searchMode,
          articleNumber: data.articleNumber,
          productName: data.productName,
          sourceUrl: data.sourceUrl,
          extractedPropertiesCount: data.extractedProperties.length,
          extractedProperties: data.extractedProperties.map(p => ({
            name: p.name,
            value: p.value,
            confidence: p.confidence,
            isConsistent: p.isConsistent,
            sourcesCount: p.sources?.length || 0,
          })),
          rawContentPreview: data.rawContentPreview?.substring(0, 500),
          processingTimeMs: data.processingTimeMs,
          success: data.success,
          errorMessage: data.errorMessage,
        },
        source: 'extraction-result',
        duration: data.processingTimeMs,
      });

      // For successful extractions, also log as activity
      if (data.success && data.extractedProperties.length > 0) {
        await this.logActivity({
          userId: data.userId,
          username: data.username,
          activityType,
          action: actionDescription,
          endpoint: data.sourceUrl,
          method: 'extraction',
          requestData: {
            productName: data.productName,
            articleNumber: data.articleNumber,
            searchTab: data.searchTab,
            searchMode: data.searchMode,
          },
          responseData: {
            propertiesExtracted: data.extractedProperties.length,
            properties: data.extractedProperties.map(p => ({
              name: p.name,
              value: p.value,
              confidence: p.confidence,
            })),
          },
          duration: data.processingTimeMs,
          success: true,
        });
      }

      console.log(`[MONITORING] Logged extraction result for user ${data.username}: ${data.productName} - ${data.extractedProperties.length} properties`);
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to log product extraction result:', error);
    }
  }

  /**
   * Log a custom search activity (Manuelle Quellen tab - URL and/or PDF extraction)
   * This captures activities from the Custom Search / Manuelle Quellen tab
   */
  static async logCustomSearchActivity(data: CustomSearchActivityData): Promise<void> {
    try {
      const activityType = `custom_search:${data.searchTab}:${data.searchMode}`;
      
      // Create a human-readable action description
      let actionDescription = '';
      if (data.searchMode === 'url_only') {
        actionDescription = `Manuelle Quellen Tab - URL Only: Extracted from "${data.productName}"${data.articleNumber ? ` (${data.articleNumber})` : ''} via ${data.webUrl || 'unknown URL'}`;
      } else if (data.searchMode === 'url_pdf') {
        const pdfInfo = data.pdfFilesCount ? ` with ${data.pdfFilesCount} PDF(s)` : '';
        actionDescription = `Manuelle Quellen Tab - URL+PDF: Extracted from "${data.productName}"${data.articleNumber ? ` (${data.articleNumber})` : ''}${pdfInfo}`;
      }

      // Log to user_activity_logs with rich metadata
      await this.logActivity({
        userId: data.userId,
        username: data.username,
        activityType,
        action: actionDescription,
        endpoint: '/api/extract-url-product-data',
        method: 'POST',
        requestData: {
          searchTab: data.searchTab,
          searchMode: data.searchMode,
          articleNumber: data.articleNumber,
          productName: data.productName,
          webUrl: data.webUrl,
          pdfFilesCount: data.pdfFilesCount,
          pdfFilesInfo: data.pdfFilesInfo?.slice(0, 5), // Limit PDF info for storage
        },
        responseData: {
          scrapedDataSummary: data.scrapedDataSummary,
          extractedPropertiesCount: data.extractedProperties?.length || 0,
          extractedProperties: data.extractedProperties, // Log all properties for monitoring
        },
        duration: data.processingTime,
        success: data.success,
        errorMessage: data.errorMessage,
      });

      // Also log to console_logs for real-time visibility
      await this.logConsole({
        userId: data.userId,
        username: data.username,
        logLevel: data.success ? 'info' : 'error',
        category: 'search',
        message: `[CUSTOM-SEARCH] ${actionDescription}`,
        metadata: {
          searchTab: data.searchTab,
          searchMode: data.searchMode,
          articleNumber: data.articleNumber,
          productName: data.productName,
          webUrl: data.webUrl,
          pdfFilesCount: data.pdfFilesCount,
          pdfFilesInfo: data.pdfFilesInfo,
          scrapedDataSummary: data.scrapedDataSummary,
          extractedPropertiesCount: data.extractedProperties?.length || 0,
          processingTime: data.processingTime,
          success: data.success,
        },
        source: 'custom-search',
        duration: data.processingTime,
      });

      console.log(`[MONITORING] Logged custom search activity for user ${data.username}: ${activityType} - ${data.productName}`);
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to log custom search activity:', error);
    }
  }

  /**
   * Helper method to get a human-readable description of the search tab/mode
   */
  static getSearchModeDescription(searchTab: string, searchMode: string): string {
    const descriptions: Record<string, Record<string, string>> = {
      automatisch: {
        manual: 'Automatisch Tab - Single Product (Einzeln)',
        datei: 'Automatisch Tab - Excel File Upload (Datei)',
      },
      manuelle_quellen: {
        url_only: 'Manuelle Quellen Tab - URL Extraction Only',
        url_pdf: 'Manuelle Quellen Tab - URL + PDF Extraction',
      },
    };
    
    return descriptions[searchTab]?.[searchMode] || `${searchTab}:${searchMode}`;
  }

  // ==========================================
  // DETAILED SCRAPED DATA & AI CALL LOGGING
  // ==========================================

  /**
   * Log actual scraped content from a URL
   * This stores the full scraped content for later review
   */
  static async logScrapedData(data: ScrapedDataLogEntry): Promise<void> {
    try {
      // Create a unique session ID for this scraping event
      const scrapingId = this.generateRequestId();
      
      // Truncate very large content but keep enough for debugging
      const maxContentLength = 50000; // 50KB limit per entry
      const truncatedContent = data.rawContent.length > maxContentLength
        ? data.rawContent.substring(0, maxContentLength) + '\n\n[CONTENT TRUNCATED - Original length: ' + data.rawContent.length + ' chars]'
        : data.rawContent;

      // Log to console_logs with full scraped content in metadata
      await this.logConsole({
        userId: data.userId,
        username: data.username,
        logLevel: data.success ? 'info' : 'error',
        category: 'scraping',
        message: `[SCRAPED-DATA] ${data.url} - ${data.scrapingMethod} - ${data.contentLength} chars`,
        metadata: {
          scrapingId,
          url: data.url,
          scrapingMethod: data.scrapingMethod,
          contentType: data.contentType,
          title: data.title,
          statusCode: data.statusCode,
          contentLength: data.contentLength,
          responseTime: data.responseTime,
          success: data.success,
          errorMessage: data.errorMessage,
          articleNumber: data.articleNumber,
          productName: data.productName,
          // Store actual content in a separate field for detailed view
          rawContent: truncatedContent,
          contentPreview: data.rawContent.substring(0, 2000), // First 2000 chars for quick preview
        },
        source: 'scraped-data',
        duration: data.responseTime,
      });

      console.log(`[MONITORING] Logged scraped data for user ${data.username}: ${data.url} (${data.contentLength} chars)`);
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to log scraped data:', error);
    }
  }

  /**
   * Log an AI API call with full prompt and response
   * This stores the complete AI interaction for review
   */
  static async logAiApiCall(data: AiApiCallLogEntry): Promise<void> {
    // Log attempt for debugging in production
    console.log(`[MONITORING-LOGGER] logAiApiCall called for user ${data.username}: ${data.provider}/${data.modelName} (${data.totalTokens} tokens, $${data.cost})`);
    
    // Check connection status
    if (!connectionVerified) {
      console.warn('[MONITORING-LOGGER] ⚠️ Database connection not verified yet - attempting to log AI API call anyway');
      if (connectionError) {
        console.error('[MONITORING-LOGGER] Last connection error:', connectionError);
      }
    }
    
    try {
      await this.ensureInitialized();
      const callId = this.generateRequestId();
      
      console.log(`[MONITORING-LOGGER] AI API call logging - callId: ${callId}, initialized: ${tablesInitialized}`);
      
      // Truncate very long prompts/responses but keep enough for debugging
      const maxLength = 30000; // 30KB limit per field
      const truncateWithNotice = (text: string, fieldName: string) => {
        if (text.length > maxLength) {
          return text.substring(0, maxLength) + `\n\n[${fieldName} TRUNCATED - Original length: ${text.length} chars]`;
        }
        return text;
      };

      // Log to console_logs with full AI interaction
      await this.logConsole({
        userId: data.userId,
        username: data.username,
        logLevel: data.success ? 'info' : 'error',
        category: 'ai',
        message: `[AI-API-CALL] ${data.provider} - ${data.modelName} - ${data.apiCallType} - ${data.totalTokens} tokens - $${data.cost}`,
        metadata: {
          callId,
          provider: data.provider,
          modelName: data.modelName,
          apiCallType: data.apiCallType,
          articleNumber: data.articleNumber,
          productName: data.productName,
          inputTokens: data.inputTokens,
          outputTokens: data.outputTokens,
          totalTokens: data.totalTokens,
          cost: data.cost,
          responseTime: data.responseTime,
          success: data.success,
          errorMessage: data.errorMessage,
          // Store full prompts and responses
          systemPrompt: data.systemPrompt ? truncateWithNotice(data.systemPrompt, 'SYSTEM_PROMPT') : null,
          userPrompt: truncateWithNotice(data.userPrompt, 'USER_PROMPT'),
          rawResponse: truncateWithNotice(data.rawResponse, 'RESPONSE'),
          parsedOutput: data.parsedOutput,
          // Previews for quick display
          userPromptPreview: data.userPrompt.substring(0, 500),
          responsePreview: data.rawResponse.substring(0, 500),
        },
        source: 'ai-api-call',
        duration: data.responseTime,
      });

      // Also log to token_usage_logs for cost tracking
      // Use correctly calculated input/output costs if provided, otherwise estimate from total
      let inputCost: string;
      let outputCost: string;
      
      if (data.inputCost && data.outputCost) {
        // Use correctly calculated costs from TokenTracker
        inputCost = data.inputCost;
        outputCost = data.outputCost;
      } else {
        // Fallback: estimate by splitting total cost proportionally (less accurate)
        const totalCost = parseFloat(data.cost);
        const inputRatio = data.inputTokens / data.totalTokens;
        const outputRatio = data.outputTokens / data.totalTokens;
        inputCost = (totalCost * inputRatio).toFixed(6);
        outputCost = (totalCost * outputRatio).toFixed(6);
        console.warn('[MONITORING-LOGGER] Using estimated input/output costs - for accuracy, pass inputCost and outputCost directly');
      }
      
      await this.logTokenUsage({
        userId: data.userId,
        username: data.username,
        modelProvider: data.provider,
        modelName: data.modelName,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.totalTokens,
        inputCost,
        outputCost,
        totalCost: data.cost,
        apiCallType: data.apiCallType,
      });

      console.log(`[MONITORING] ✅ Successfully logged AI API call for user ${data.username}: ${data.provider}/${data.modelName} (${data.totalTokens} tokens, callId: ${callId})`);
    } catch (error: any) {
      console.error('[MONITORING-LOGGER] ❌ Failed to log AI API call:', {
        error: error.message,
        code: error.code,
        routine: error.routine,
        detail: error.detail,
        hint: error.hint,
        stack: error.stack?.substring(0, 300),
        // Include data context for debugging
        context: {
          userId: data.userId,
          username: data.username,
          provider: data.provider,
          modelName: data.modelName,
          totalTokens: data.totalTokens,
          cost: data.cost,
        }
      });
      
      // Additional hints for common errors
      if (error.code === 'ECONNREFUSED') {
        console.error('[MONITORING-LOGGER] 🔍 Hint: Connection refused - database may not be accessible');
      } else if (error.message?.includes('SSL') || error.message?.includes('ssl')) {
        console.error('[MONITORING-LOGGER] 🔍 Hint: SSL-related error - check SSL configuration');
      } else if (error.code === '42P01') {
        console.error('[MONITORING-LOGGER] 🔍 Hint: Table does not exist - run table initialization');
      } else if (error.code === '57014') {
        console.error('[MONITORING-LOGGER] 🔍 Hint: Query cancelled - likely timeout');
      }
    }
  }

  /**
   * Log a complete extraction session with all scraped sources and AI calls
   * This provides a unified view of a product extraction
   */
  static async logExtractionSession(data: ExtractionSessionLog): Promise<void> {
    try {
      // Log to console_logs with full session details
      await this.logConsole({
        userId: data.userId,
        username: data.username,
        logLevel: data.success ? 'info' : 'error',
        category: 'search',
        message: `[EXTRACTION-SESSION] ${data.productName}${data.articleNumber ? ` (${data.articleNumber})` : ''} - ${data.scrapedSources.length} sources, ${data.aiCalls.length} AI calls, ${data.extractedProperties.length} properties`,
        metadata: {
          sessionId: data.sessionId,
          searchTab: data.searchTab,
          searchMode: data.searchMode,
          articleNumber: data.articleNumber,
          productName: data.productName,
          scrapedSourcesCount: data.scrapedSources.length,
          aiCallsCount: data.aiCalls.length,
          extractedPropertiesCount: data.extractedProperties.length,
          totalProcessingTime: data.totalProcessingTime,
          success: data.success,
          // Detailed data
          scrapedSources: data.scrapedSources,
          aiCalls: data.aiCalls,
          extractedProperties: data.extractedProperties,
        },
        source: 'extraction-session',
        duration: data.totalProcessingTime,
      });

      // Also log as activity for the activity log page
      await this.logActivity({
        userId: data.userId,
        username: data.username,
        activityType: `extraction_session:${data.searchTab}:${data.searchMode}`,
        action: `Extraction session for "${data.productName}"${data.articleNumber ? ` (${data.articleNumber})` : ''}: ${data.scrapedSources.length} sources scraped, ${data.aiCalls.length} AI calls made, ${data.extractedProperties.length} properties extracted`,
        requestData: {
          sessionId: data.sessionId,
          searchTab: data.searchTab,
          searchMode: data.searchMode,
          articleNumber: data.articleNumber,
          productName: data.productName,
          scrapedSources: data.scrapedSources.map(s => ({
            url: s.url,
            contentLength: s.contentLength,
            success: s.success,
          })),
        },
        responseData: {
          aiCalls: data.aiCalls.map(c => ({
            provider: c.provider,
            model: c.model,
            tokens: c.tokens,
            cost: c.cost,
          })),
          extractedProperties: data.extractedProperties,
        },
        duration: data.totalProcessingTime,
        success: data.success,
      });

      console.log(`[MONITORING] Logged extraction session for user ${data.username}: ${data.productName} - ${data.scrapedSources.length} sources, ${data.aiCalls.length} AI calls`);
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to log extraction session:', error);
    }
  }

  /**
   * Get scraped data logs for a user (for the Scraped Data tab)
   */
  static async getScrapedDataLogs(
    userId: number,
    options?: { limit?: number; startDate?: string; endDate?: string }
  ): Promise<any[]> {
    try {
      const limit = options?.limit || 50;
      let query = `
        SELECT id, user_id, username, category, message, metadata, timestamp, duration
        FROM console_logs
        WHERE user_id = $1 AND source = 'scraped-data'
      `;
      const params: any[] = [userId];

      if (options?.startDate) {
        params.push(options.startDate);
        query += ` AND timestamp >= $${params.length}`;
      }
      if (options?.endDate) {
        params.push(options.endDate);
        query += ` AND timestamp <= $${params.length}`;
      }

      query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await monitoringPool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to get scraped data logs:', error);
      return [];
    }
  }

  /**
   * Get AI API call logs for a user (for the AI Calls tab)
   */
  static async getAiApiCallLogs(
    userId: number,
    options?: { limit?: number; startDate?: string; endDate?: string; provider?: string }
  ): Promise<any[]> {
    try {
      const limit = options?.limit || 50;
      let query = `
        SELECT id, user_id, username, category, message, metadata, timestamp, duration
        FROM console_logs
        WHERE user_id = $1 AND source = 'ai-api-call'
      `;
      const params: any[] = [userId];

      if (options?.startDate) {
        params.push(options.startDate);
        query += ` AND timestamp >= $${params.length}`;
      }
      if (options?.endDate) {
        params.push(options.endDate);
        query += ` AND timestamp <= $${params.length}`;
      }
      if (options?.provider) {
        params.push(`%${options.provider}%`);
        query += ` AND message ILIKE $${params.length}`;
      }

      query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await monitoringPool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to get AI API call logs:', error);
      return [];
    }
  }

  /**
   * Get extraction sessions for a user (for detailed session view)
   */
  static async getExtractionSessions(
    userId: number,
    options?: { limit?: number; startDate?: string; endDate?: string }
  ): Promise<any[]> {
    try {
      const limit = options?.limit || 30;
      let query = `
        SELECT id, user_id, username, category, message, metadata, timestamp, duration
        FROM console_logs
        WHERE user_id = $1 AND source = 'extraction-session'
      `;
      const params: any[] = [userId];

      if (options?.startDate) {
        params.push(options.startDate);
        query += ` AND timestamp >= $${params.length}`;
      }
      if (options?.endDate) {
        params.push(options.endDate);
        query += ` AND timestamp <= $${params.length}`;
      }

      query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await monitoringPool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('[MONITORING-LOGGER] Failed to get extraction sessions:', error);
      return [];
    }
  }
}