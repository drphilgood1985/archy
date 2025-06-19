@echo off
setlocal enabledelayedexpansion

set "TARGET=searchHandler.mjs"
set "BACKUP=searchHandler.backup.mjs"

if exist "%TARGET%" (
    echo Backing up %TARGET%...
    copy /Y "%TARGET%" "%BACKUP%" > nul
) else (
    echo ERROR: %TARGET% not found.
    exit /b 1
)

set "PATCHED=_patched.mjs"
break > "%PATCHED%"

set "injected=0"
for /f "usebackq delims=" %%L in ("%TARGET%") do (
    set "line=%%L"
    if "!line!"=="const searchSessions = new Map();" (
        echo // PATCH: Begin Redis session persistence stub>>"%PATCHED%"
        echo const redis = require('redis');>>"%PATCHED%"
        echo // You must initialize and use a Redis client here.>>"%PATCHED%"
        echo // For now, falls back to in-memory if Redis is unavailable.>>"%PATCHED%"
        echo let searchSessions;>>"%PATCHED%"
        echo try {>>"%PATCHED%"
        echo     searchSessions = redis.createClient(); // Replace with actual Redis session logic>>"%PATCHED%"
        echo } catch (e) {>>"%PATCHED%"
        echo     searchSessions = new Map(); // Fallback>>"%PATCHED%"
        echo }>>"%PATCHED%"
        echo // PATCH: End Redis session persistence stub>>"%PATCHED%"
        set "injected=1"
        goto :skipline
    )
    echo !line!>>"%PATCHED%"
    :skipline
)

if "%injected%"=="0" (
    echo ERROR: Target code line not found in %TARGET%.
    exit /b 1
)

move /Y "%PATCHED%" "%TARGET%" > nul
echo Patch applied successfully to %TARGET%.
endlocal
