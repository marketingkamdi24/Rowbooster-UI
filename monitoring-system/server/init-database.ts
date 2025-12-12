import { db, pool } from './db';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export async function initializeMonitoringDatabase() {
  console.log('[MONITORING-INIT] Starting database initialization...');

  try {
    // Create tables if they don't exist
    console.log('[MONITORING-INIT] Creating monitoring tables...');
    
    await pool.query(`
      -- RBManager table
      CREATE TABLE IF NOT EXISTS rb_manager (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

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

      -- System Metrics
      CREATE TABLE IF NOT EXISTS system_metrics (
        id SERIAL PRIMARY KEY,
        metric_type TEXT NOT NULL,
        metric_value TEXT NOT NULL,
        unit TEXT,
        timestamp TIMESTAMP DEFAULT NOW() NOT NULL
      );

      -- Console/Terminal Output Logs - Per user terminal output tracking
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

      -- System Health Status - For health check tracking
      CREATE TABLE IF NOT EXISTS system_health (
        id SERIAL PRIMARY KEY,
        component TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT,
        response_time INTEGER,
        details JSONB,
        checked_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    console.log('[MONITORING-INIT] Creating indexes for performance...');
    
    await pool.query(`
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
      CREATE INDEX IF NOT EXISTS idx_console_logs_request_id ON console_logs(request_id);
      CREATE INDEX IF NOT EXISTS idx_console_logs_user_timestamp ON console_logs(user_id, timestamp);

      -- Indexes for system_health
      CREATE INDEX IF NOT EXISTS idx_system_health_component ON system_health(component);
      CREATE INDEX IF NOT EXISTS idx_system_health_checked_at ON system_health(checked_at);
      CREATE INDEX IF NOT EXISTS idx_system_health_status ON system_health(status);
    `);

    // Initialize RBManager user
    console.log('[MONITORING-INIT] Initializing RBManager user...');
    
    const existingManager = await pool.query(
      'SELECT * FROM rb_manager WHERE username = $1',
      ['RBManager']
    );

    if (existingManager.rows.length === 0) {
      // Use environment variable for default password, or generate a secure random one
      const defaultPassword = process.env.RB_MANAGER_DEFAULT_PASSWORD ||
        require('crypto').randomBytes(16).toString('hex');
      
      const hashedPassword = await bcrypt.hash(defaultPassword, 12); // Use 12 rounds for better security
      await pool.query(
        'INSERT INTO rb_manager (username, password) VALUES ($1, $2)',
        ['RBManager', hashedPassword]
      );
      console.log('[MONITORING-INIT] ✅ RBManager user created successfully');
      console.log('[MONITORING-INIT] Username: RBManager');
      
      // Only show password hint in development, never expose the actual password in logs
      if (process.env.NODE_ENV !== 'production') {
        if (process.env.RB_MANAGER_DEFAULT_PASSWORD) {
          console.log('[MONITORING-INIT] Password: Set via RB_MANAGER_DEFAULT_PASSWORD environment variable');
        } else {
          console.log('[MONITORING-INIT] Password: [Auto-generated] - Check RB_MANAGER_DEFAULT_PASSWORD env var');
          console.log('[MONITORING-INIT] ⚠️  IMPORTANT: Set RB_MANAGER_DEFAULT_PASSWORD in production!');
        }
      } else {
        console.log('[MONITORING-INIT] ⚠️  Please change the default password immediately!');
      }
    } else {
      console.log('[MONITORING-INIT] ✅ RBManager user already exists');
    }

    console.log('[MONITORING-INIT] ✅ Database initialization completed successfully');
  } catch (error) {
    console.error('[MONITORING-INIT] ❌ Database initialization failed:', error);
    throw error;
  }
}