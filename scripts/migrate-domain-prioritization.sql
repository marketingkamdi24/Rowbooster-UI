-- Migration: Add domain prioritization tables for manufacturer domains and excluded domains
-- This migration creates the necessary tables for domain prioritization in the search pipeline.

-- Create manufacturer_domains table for prioritized/producer domains
CREATE TABLE IF NOT EXISTS manufacturer_domains (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    website_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create excluded_domains table for blocked domains
CREATE TABLE IF NOT EXISTS excluded_domains (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    reason TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_manufacturer_domains_user_id ON manufacturer_domains(user_id);
CREATE INDEX IF NOT EXISTS idx_manufacturer_domains_is_active ON manufacturer_domains(is_active);
CREATE INDEX IF NOT EXISTS idx_excluded_domains_user_id ON excluded_domains(user_id);
CREATE INDEX IF NOT EXISTS idx_excluded_domains_is_active ON excluded_domains(is_active);

-- Add some example manufacturer domains (optional - can be removed)
-- Users will add their own domains through the Settings UI
-- INSERT INTO manufacturer_domains (name, website_url, is_active) VALUES
--     ('Aduro Fire', 'https://www.adurofire.de', true),
--     ('Extraflame', 'https://www.extraflame.com', true),
--     ('Lotus Stoves', 'https://www.lotusstoves.com', true);

-- Add some example excluded domains (optional - can be removed)
-- These are common domains that typically don't contain useful product data
-- INSERT INTO excluded_domains (domain, reason, is_active) VALUES
--     ('amazon.com', 'E-commerce platform - not manufacturer data', true),
--     ('ebay.com', 'E-commerce marketplace', true),
--     ('pinterest.com', 'Social media', true);

-- Grant appropriate permissions if needed
-- GRANT SELECT, INSERT, UPDATE, DELETE ON manufacturer_domains TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON excluded_domains TO your_app_user;

-- Output confirmation
SELECT 'Domain prioritization tables created successfully!' AS status;
SELECT 
    (SELECT COUNT(*) FROM manufacturer_domains) AS manufacturer_domains_count,
    (SELECT COUNT(*) FROM excluded_domains) AS excluded_domains_count;