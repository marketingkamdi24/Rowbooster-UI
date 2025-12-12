-- Seed script for RowBooster database
-- Creates default admin user and product properties

-- Clear existing data (if any)
TRUNCATE users, product_properties RESTART IDENTITY CASCADE;

-- Insert default admin user
-- Username: admin
-- Password: admin123 (bcrypt hash with 12 rounds)
-- Email: admin@rowbooster.local
INSERT INTO users (username, password, email, role, is_active, failed_login_attempts, created_at, updated_at)
VALUES (
  'admin',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYITHqZzXZe',
  'admin@rowbooster.local',
  'admin',
  true,
  0,
  NOW(),
  NOW()
);

-- Insert 24 default product properties
INSERT INTO product_properties (name, description, order_index, is_required) VALUES
('Hersteller', 'Manufacturer of the product', 1, false),
('Modell', 'Product model name/number', 2, false),
('Artikelnummer', 'Article/SKU number', 3, false),
('EAN', 'European Article Number barcode', 4, false),
('Gewicht', 'Weight of the product', 5, false),
('Abmessungen', 'Dimensions (length x width x height)', 6, false),
('Material', 'Material composition', 7, false),
('Farbe', 'Color/finish', 8, false),
('Leistung', 'Power/performance rating', 9, false),
('Spannung', 'Voltage rating', 10, false),
('Kapazität', 'Capacity/volume', 11, false),
('Energieeffizienzklasse', 'Energy efficiency class', 12, false),
('Garantie', 'Warranty period', 13, false),
('Herstellungsland', 'Country of manufacture', 14, false),
('Zertifizierungen', 'Certifications (CE, TÜV, etc.)', 15, false),
('Lieferumfang', 'Package contents', 16, false),
('Besonderheiten', 'Special features', 17, false),
('Einsatzbereich', 'Application area/use case', 18, false),
('Kompatibilität', 'Compatibility information', 19, false),
('Anschlüsse', 'Connections/ports available', 20, false),
('Betriebstemperatur', 'Operating temperature range', 21, false),
('Schutzklasse', 'Protection class (IP rating)', 22, false),
('Lautstärke', 'Noise level (dB)', 23, false),
('Verbrauch', 'Power consumption', 24, false);

-- Verify data was inserted
SELECT 'Users created:' as info, COUNT(*) as count FROM users;
SELECT 'Product properties created:' as info, COUNT(*) as count FROM product_properties;

-- Show the admin user (without password hash)
SELECT id, username, role, is_active, created_at FROM users;

-- Show first 10 product properties
SELECT id, name, description, order_index FROM product_properties ORDER BY order_index LIMIT 10;