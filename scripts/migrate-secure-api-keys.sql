-- Migration: Add encrypted API key storage for users
-- This migration adds columns for storing encrypted API keys per-user
-- API keys are encrypted using AES-256-GCM before storage

-- Add encrypted API key columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_openai_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_valueserp_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_keys_updated_at TIMESTAMP;

-- Create an index for faster lookups when checking if keys exist
CREATE INDEX IF NOT EXISTS idx_users_has_openai_key ON users ((encrypted_openai_key IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_users_has_valueserp_key ON users ((encrypted_valueserp_key IS NOT NULL));

-- Create rate limiting table for persistent storage
CREATE TABLE IF NOT EXISTS rate_limits (
    id SERIAL PRIMARY KEY,
    identifier TEXT NOT NULL,           -- IP address or user ID
    endpoint TEXT NOT NULL,             -- API endpoint being rate limited
    request_count INTEGER DEFAULT 1,    -- Number of requests in current window
    window_start TIMESTAMP NOT NULL,    -- Start of current rate limit window
    blocked_until TIMESTAMP,            -- If blocked, when block expires
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(identifier, endpoint)
);

-- Create index for efficient rate limit lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits(identifier, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

-- Add comment for documentation
COMMENT ON COLUMN users.encrypted_openai_key IS 'AES-256-GCM encrypted OpenAI API key';
COMMENT ON COLUMN users.encrypted_valueserp_key IS 'AES-256-GCM encrypted ValueSERP API key';

-- Encrypt existing plaintext API keys in app_settings (if any)
-- Note: This should be done via application code, not SQL, because encryption requires the app key

-- Drop any old plaintext API key storage from client-side migrations (if they exist)
-- Note: We don't delete app_settings columns as they may be used for system-wide defaults

-- Create audit log for API key changes
CREATE TABLE IF NOT EXISTS api_key_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,               -- 'created', 'updated', 'deleted', 'used'
    key_type TEXT NOT NULL,             -- 'openai', 'valueserp'
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_key_audit_user ON api_key_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_api_key_audit_created ON api_key_audit_log(created_at);

COMMENT ON TABLE api_key_audit_log IS 'Audit trail for API key operations for security monitoring';

-- Create table for storing encrypted security tokens (reset tokens, verification tokens)
-- This replaces plaintext token storage with hashed versions
CREATE TABLE IF NOT EXISTS secure_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_type TEXT NOT NULL,           -- 'reset', 'verification', 'api_session'
    token_hash TEXT NOT NULL,           -- PBKDF2 hash of the token
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,                  -- When the token was consumed
    ip_address TEXT,                    -- IP that created the token
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, token_type) -- Only one active token per type per user
);

CREATE INDEX IF NOT EXISTS idx_secure_tokens_user ON secure_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_secure_tokens_expires ON secure_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_secure_tokens_type ON secure_tokens(token_type);

COMMENT ON TABLE secure_tokens IS 'Secure token storage using PBKDF2 hashes instead of plaintext';