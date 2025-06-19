@echo off
SETLOCAL

:: Define connection parameters
SET PGUSER=archybot
SET PGPASSWORD=SwimClub2025@Nash
SET PGHOST=dpg-d147kge3jp1c739sojm0-a.virginia-postgres.render.com
SET PGDATABASE=archy_archive
SET PGPORT=5432

:: Connect using psql
psql -U %PGUSER% -h %PGHOST% -d %PGDATABASE% -p %PGPORT%

ENDLOCAL
