-- Rowbooster Database Initialization Script for Render
-- Run this in Render PostgreSQL Shell

-- Connect to the database
\c rowbooster

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  failed_login_attempts INTEGER DEFAULT 0,
  last_failed_login TIMESTAMP,
  locked_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create property_tables table
CREATE TABLE IF NOT EXISTS property_tables (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create product_properties table
CREATE TABLE IF NOT EXISTS product_properties (
  id SERIAL PRIMARY KEY,
  property_table_id INTEGER REFERENCES property_tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  expected_format TEXT,
  order_index INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT FALSE
);

-- Create search_results table
CREATE TABLE IF NOT EXISTS search_results (
  id SERIAL PRIMARY KEY,
  article_number TEXT NOT NULL,
  product_name TEXT NOT NULL,
  search_method TEXT NOT NULL,
  properties JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
  id SERIAL PRIMARY KEY,
  openai_api_key TEXT,
  valueserp_api_key TEXT,
  valueserp_location TEXT DEFAULT 'us',
  default_ai_model TEXT DEFAULT 'openai',
  default_search_method TEXT DEFAULT 'google',
  use_valueserp BOOLEAN DEFAULT TRUE,
  use_ai BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create token_usage table
CREATE TABLE IF NOT EXISTS token_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  model_provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  input_cost TEXT NOT NULL DEFAULT '0',
  output_cost TEXT NOT NULL DEFAULT '0',
  total_cost TEXT NOT NULL DEFAULT '0',
  api_call_type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create manufacturer_domains table
CREATE TABLE IF NOT EXISTS manufacturer_domains (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create excluded_domains table
CREATE TABLE IF NOT EXISTS excluded_domains (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  reason TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_product_properties_table_id ON product_properties(property_table_id);
CREATE INDEX IF NOT EXISTS idx_search_results_article_number ON search_results(article_number);
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_manufacturer_domains_user_id ON manufacturer_domains(user_id);
CREATE INDEX IF NOT EXISTS idx_manufacturer_domains_is_active ON manufacturer_domains(is_active);
CREATE INDEX IF NOT EXISTS idx_excluded_domains_user_id ON excluded_domains(user_id);
CREATE INDEX IF NOT EXISTS idx_excluded_domains_is_active ON excluded_domains(is_active);

-- Insert default admin user
-- Username: admin
-- Password: admin123
INSERT INTO users (username, password, email, role, is_active, failed_login_attempts)
VALUES (
  'admin',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYITHqZzXZe',
  'admin@rowbooster.local',
  'admin',
  true,
  0
)
ON CONFLICT (username) DO NOTHING;

-- Create default property table
INSERT INTO property_tables (name, description, is_default)
VALUES ('Kamin', 'Default property table for Kaminofen products', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Verify tables were created
\dt

-- Show admin user
SELECT id, username, email, role, is_active FROM users;

-- Success message
SELECT 'Database initialization complete! You can now login with username: admin, password: admin123' AS status;