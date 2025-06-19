@echo off
REM Usage: apply_patch_template.bat PATCHNAME.mjs searchHandler.mjs
set PATCH=%1
set TARGET=%2
set PATCHNAME=%~n1

echo [DEBUG] PATCH: %PATCH%
echo [DEBUG] TARGET: %TARGET%
echo [DEBUG] CD: %CD%

if not exist "..\backups" mkdir "..\backups"
if not exist "..\debugginglogs" mkdir "..\debugginglogs"

copy /Y "%TARGET%" "..\backups\%PATCHNAME%_%~nx2" > nul

node "%PATCH%" "%TARGET%" > "..\debugginglogs\%PATCHNAME%.log" 2>&1

echo Patch %PATCH% applied to %TARGET%. Log at ..\debugginglogs\%PATCHNAME%.log
