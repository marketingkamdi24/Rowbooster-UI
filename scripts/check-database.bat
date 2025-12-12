@echo off
echo ========================================
echo  RowBooster Database Status Check
echo ========================================
echo.
echo Database: rowbooster
echo Host: localhost:5432
echo User: postgres
echo.
echo Checking connection...
echo.

psql -h localhost -p 5432 -U postgres -d rowbooster -c "SELECT 'users' as table_name, COUNT(*) as count FROM users UNION ALL SELECT 'product_properties', COUNT(*) FROM product_properties UNION ALL SELECT 'manufacturer_domains', COUNT(*) FROM manufacturer_domains UNION ALL SELECT 'excluded_domains', COUNT(*) FROM excluded_domains UNION ALL SELECT 'app_settings', COUNT(*) FROM app_settings UNION ALL SELECT 'search_results', COUNT(*) FROM search_results UNION ALL SELECT 'token_usage', COUNT(*) FROM token_usage UNION ALL SELECT 'sessions', COUNT(*) FROM sessions;"

echo.
echo ========================================
echo  View Users
echo ========================================
psql -h localhost -p 5432 -U postgres -d rowbooster -c "SELECT id, username, role, created_at FROM users;"

echo.
echo ========================================
echo  View Product Properties (first 10)
echo ========================================
psql -h localhost -p 5432 -U postgres -d rowbooster -c "SELECT id, name, category, display_order FROM product_properties ORDER BY display_order LIMIT 10;"

echo.
echo Done!
pause