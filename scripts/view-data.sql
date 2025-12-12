-- Quick commands to view your database data

-- View all users
SELECT id, username, role, created_at FROM users;

-- View all product properties
SELECT id, name, category, display_order FROM product_properties ORDER BY display_order;

-- View manufacturer domains
SELECT * FROM manufacturer_domains;

-- View excluded domains
SELECT * FROM excluded_domains;

-- View app settings
SELECT * FROM app_settings;

-- Count records in each table
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'product_properties', COUNT(*) FROM product_properties
UNION ALL
SELECT 'manufacturer_domains', COUNT(*) FROM manufacturer_domains
UNION ALL
SELECT 'excluded_domains', COUNT(*) FROM excluded_domains
UNION ALL
SELECT 'app_settings', COUNT(*) FROM app_settings
UNION ALL
SELECT 'search_results', COUNT(*) FROM search_results
UNION ALL
SELECT 'token_usage', COUNT(*) FROM token_usage;