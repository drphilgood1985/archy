@echo off
echo Dumping current schema from Render PostgreSQL...

REM Escape @ in password as %40
SET PG_URL=postgresql://archybot:SwimClub2025%%40Nash@dpg-d147kge3jp1c739sojm0-a.virginia-postgres.render.com/archy_archive

REM Path to write the updated schema file
SET OUTPUT=C:\Projects\Archy\schema.sql

REM Dump only the schema, no data, no ownership info
pg_dump --schema-only --no-owner --no-privileges --dbname="%PG_URL%" > "%OUTPUT%"

IF %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to dump schema. Check your PostgreSQL connection and pg_dump availability.
) ELSE (
    echo ✅ Schema successfully updated at %OUTPUT%.
)

pause
