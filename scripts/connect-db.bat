@echo off
echo Connecting to PostgreSQL database: rowbooster
echo.
echo Database location: C:\Program Files\PostgreSQL\<version>\data
echo (Replace <version> with your PostgreSQL version, e.g., 16)
echo.
echo Running psql command...
psql -h localhost -p 5432 -U postgres -d rowbooster