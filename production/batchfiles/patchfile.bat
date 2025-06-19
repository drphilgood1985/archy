@echo off
setlocal EnableDelayedExpansion

:: === CONFIGURATION ===
set "TARGET_FILE=archiveHandler.mjs"
set "PATCH_FILE=patch_payload.json"
set "TEMP_FILE=patched.tmp"

echo 🛠️ Applying patch to %TARGET_FILE%...

:: === Validate files exist ===
if not exist "%TARGET_FILE%" (
  echo ❌ Target file not found: %TARGET_FILE%
  exit /b 1
)
if not exist "%PATCH_FILE%" (
  echo ❌ Patch file not found: %PATCH_FILE%
  exit /b 1
)

:: === Strip BOM if present ===
type "%PATCH_FILE%" > "%TEMP_FILE%"

:: === Clear target file ===
break > "%TARGET_FILE%"

:: === Read JSON as lines and write safely ===
for /f "usebackq tokens=* delims=" %%L in ("%TEMP_FILE%") do (
  set "line=%%L"
  echo(!line!>>"%TARGET_FILE%"
)

:: === Cleanup ===
del "%TEMP_FILE%"

echo ✅ Patch applied successfully to %TARGET_FILE%.
pause
