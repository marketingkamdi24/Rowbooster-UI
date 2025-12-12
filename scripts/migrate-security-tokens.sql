-- Security Tokens Migration Script
-- This migration creates tables for storing security-related tokens in the database
-- instead of in-memory storage, making them persistent across server restarts
-- and compatible with multi-instance deployments

-- ============================================
-- SECURITY TOKENS TABLE
-- Stores email verification and password reset tokens
-- ============================================

CREATE TABLE IF NOT EXISTS security_tokens (
    id SERIAL PRIMARY KEY,
    
    -- Token identification
    token VARCHAR(128) NOT NULL UNIQUE,
    token_type VARCHAR(50) NOT NULL, -- 'email_verification', 'password_reset', 'api_key_rotation'
    
    -- Associated user
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Additional data (for verification codes, etc.)
    verification_code VARCHAR(10),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE, -- Set when token is consumed
    
    -- Metadata
    ip_address VARCHAR(45), -- IPv6 max length
    user_agent TEXT,
    
    -- Indexes for fast lookup
    CONSTRAINT valid_token_type CHECK (token_type IN ('email_verification', 'password_reset', 'api_key_rotation', 'session_refresh'))
);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_security_tokens_token ON security_tokens(token);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_security_tokens_user_id ON security_tokens(user_id);

-- Index for expired token cleanup
CREATE INDEX IF NOT EXISTS idx_security_tokens_expires_at ON security_tokens(expires_at);

-- Index for verification code lookup
CREATE INDEX IF NOT EXISTS idx_security_tokens_verification_code ON security_tokens(verification_code) WHERE verification_code IS NOT NULL;

-- Composite index for type and expiry (for cleanup jobs)
CREATE INDEX IF NOT EXISTS idx_security_tokens_type_expires ON security_tokens(token_type, expires_at);

-- ============================================
-- SECURITY AUDIT LOGS TABLE
-- Stores security-related events for compliance and investigation
-- ============================================

CREATE TABLE IF NOT EXISTS security_audit_logs (
    id SERIAL PRIMARY KEY,
    
    -- Event details
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    
    -- Associated user (optional - some events may not have a user)
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(255),
    
    -- Request context
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_id VARCHAR(64),
    
    -- Event data
    details JSONB,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'critical')),
    CONSTRAINT valid_event_type CHECK (event_type IN (
        'login', 'logout', 'login_failed', 'password_change', 'password_reset',
        'account_locked', 'rate_limited', 'csrf_blocked', 'suspicious_activity',
        'permission_denied', 'session_hijack_attempt', 'api_key_access', 'admin_action',
        'email_verification', 'account_created', 'account_deleted', 'settings_changed'
    ))
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_security_audit_user_id ON security_audit_logs(user_id);

-- Index for event type filtering
CREATE INDEX IF NOT EXISTS idx_security_audit_event_type ON security_audit_logs(event_type);

-- Index for severity filtering
CREATE INDEX IF NOT EXISTS idx_security_audit_severity ON security_audit_logs(severity);

-- Index for timestamp-based queries (most common)
CREATE INDEX IF NOT EXISTS idx_security_audit_created_at ON security_audit_logs(created_at DESC);

-- Composite index for filtered timestamp queries
CREATE INDEX IF NOT EXISTS idx_security_audit_type_created ON security_audit_logs(event_type, created_at DESC);

-- Index for IP-based investigation
CREATE INDEX IF NOT EXISTS idx_security_audit_ip ON security_audit_logs(ip_address) WHERE ip_address IS NOT NULL;

-- ============================================
-- ENCRYPTED SETTINGS TABLE
-- Stores encrypted API keys and sensitive configuration
-- ============================================

-- Add encrypted columns to app_settings if they don't exist
DO $$
BEGIN
    -- Add encrypted OpenAI API key column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'app_settings' AND column_name = 'openai_api_key_encrypted'
    ) THEN
        ALTER TABLE app_settings ADD COLUMN openai_api_key_encrypted TEXT;
    END IF;
    
    -- Add encrypted ValueSERP API key column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'app_settings' AND column_name = 'valueserp_api_key_encrypted'
    ) THEN
        ALTER TABLE app_settings ADD COLUMN valueserp_api_key_encrypted TEXT;
    END IF;
    
    -- Add encrypted Google API key column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'app_settings' AND column_name = 'google_api_key_encrypted'
    ) THEN
        ALTER TABLE app_settings ADD COLUMN google_api_key_encrypted TEXT;
    END IF;
    
    -- Add encryption migration flag
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'app_settings' AND column_name = 'keys_encrypted'
    ) THEN
        ALTER TABLE app_settings ADD COLUMN keys_encrypted BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- ============================================
-- LOGIN ATTEMPT TRACKING TABLE
-- For distributed rate limiting (useful for multi-instance deployments)
-- ============================================

CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    
    -- Identifier (IP address or IP + username hash)
    identifier VARCHAR(128) NOT NULL,
    identifier_type VARCHAR(20) NOT NULL DEFAULT 'ip', -- 'ip', 'ip_user', 'user'
    
    -- Attempt tracking
    attempt_count INTEGER NOT NULL DEFAULT 1,
    first_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Blocking status
    blocked BOOLEAN DEFAULT FALSE,
    blocked_until TIMESTAMP WITH TIME ZONE,
    
    -- Alert tracking
    last_alert_sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Auto-expire old records
    CONSTRAINT identifier_unique UNIQUE (identifier, identifier_type)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts(identifier);

-- Index for cleanup of old records
CREATE INDEX IF NOT EXISTS idx_login_attempts_last_attempt ON login_attempts(last_attempt_at);

-- Index for blocked entries
CREATE INDEX IF NOT EXISTS idx_login_attempts_blocked ON login_attempts(blocked) WHERE blocked = TRUE;

-- ============================================
-- CLEANUP FUNCTIONS
-- ============================================

-- Function to clean up expired security tokens
CREATE OR REPLACE FUNCTION cleanup_expired_security_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM security_tokens
    WHERE expires_at < NOW()
    OR (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '1 day');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old login attempts (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM login_attempts
    WHERE last_attempt_at < NOW() - INTERVAL '24 hours'
    AND (blocked = FALSE OR (blocked_until IS NOT NULL AND blocked_until < NOW()));
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old audit logs (configurable retention)
-- Default: Keep 90 days of logs
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM security_audit_logs
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE security_tokens IS 'Stores temporary security tokens for email verification, password reset, etc.';
COMMENT ON COLUMN security_tokens.token IS 'Unique cryptographic token (64 bytes hex = 128 chars)';
COMMENT ON COLUMN security_tokens.verification_code IS 'Optional 6-digit code for email verification';
COMMENT ON COLUMN security_tokens.used_at IS 'Set when token is consumed - prevents reuse';

COMMENT ON TABLE security_audit_logs IS 'Immutable log of security-related events for compliance and investigation';
COMMENT ON COLUMN security_audit_logs.details IS 'JSON blob containing event-specific data';
COMMENT ON COLUMN security_audit_logs.request_id IS 'Correlation ID for tracing requests across services';

COMMENT ON TABLE login_attempts IS 'Tracks failed login attempts for rate limiting and security alerts';
COMMENT ON COLUMN login_attempts.identifier IS 'Usually IP address, can be hashed combination of IP and username';

COMMENT ON FUNCTION cleanup_expired_security_tokens IS 'Call periodically to remove expired tokens. Run: SELECT cleanup_expired_security_tokens();';
COMMENT ON FUNCTION cleanup_old_login_attempts IS 'Call periodically to remove old login attempt records. Run: SELECT cleanup_old_login_attempts();';
COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Call periodically to remove old audit logs. Run: SELECT cleanup_old_audit_logs(90);';

-- ============================================
-- GRANT PERMISSIONS (adjust role name as needed)
-- ============================================

-- If you have a specific application role, uncomment and adjust:
-- GRANT SELECT, INSERT, UPDATE, DELETE ON security_tokens TO app_role;
-- GRANT SELECT, INSERT ON security_audit_logs TO app_role;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON login_attempts TO app_role;
-- GRANT USAGE, SELECT ON SEQUENCE security_tokens_id_seq TO app_role;
-- GRANT USAGE, SELECT ON SEQUENCE security_audit_logs_id_seq TO app_role;
-- GRANT USAGE, SELECT ON SEQUENCE login_attempts_id_seq TO app_role;
-- GRANT EXECUTE ON FUNCTION cleanup_expired_security_tokens TO app_role;
-- GRANT EXECUTE ON FUNCTION cleanup_old_login_attempts TO app_role;
-- GRANT EXECUTE ON FUNCTION cleanup_old_audit_logs TO app_role;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Security tables migration completed successfully.';
    RAISE NOTICE 'Tables created: security_tokens, security_audit_logs, login_attempts';
    RAISE NOTICE 'Remember to run cleanup functions periodically:';
    RAISE NOTICE '  - SELECT cleanup_expired_security_tokens();';
    RAISE NOTICE '  - SELECT cleanup_old_login_attempts();';
    RAISE NOTICE '  - SELECT cleanup_old_audit_logs(90);';
END $$;