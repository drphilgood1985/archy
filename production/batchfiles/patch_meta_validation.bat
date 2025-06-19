@echo off
setlocal enabledelayedexpansion

set "TARGET=archiveHandler.mjs"
set "BACKUP=archiveHandler.backup.mjs"

if exist "%TARGET%" (
    echo Backing up %TARGET%...
    copy /Y "%TARGET%" "%BACKUP%" > nul
) else (
    echo ERROR: %TARGET% not found.
    exit /b 1
)

set "PATCHED=_patched.mjs"
break > "%PATCHED%"

set "injectNextLine=0"
for /f "usebackq delims=" %%L in ("%TARGET%") do (
    set "line=%%L"
    echo !line! | find "const metadata = await extractMetadataFromMessages(messageLog);" > nul
    if !errorlevel! == 0 (
        echo !line!>>"%PATCHED%"
        set "injectNextLine=1"
        goto :next
    )
    if !injectNextLine! == 1 (
        echo const { validateMetadataSchema } = require('./assistantsClient.mjs');>>"%PATCHED%"
        echo const validation = validateMetadataSchema(metadata);>>"%PATCHED%"
        echo if (!validation.valid^) {>>"%PATCHED%"
        echo     console.error('Metadata validation failed:', validation.issues);>>"%PATCHED%"
        echo     await message.channel.send('❌ Archive aborted due to metadata error.');>>"%PATCHED%"
        echo     return;>>"%PATCHED%"
        echo }>>"%PATCHED%"
        set "injectNextLine=0"
    )
    echo !line!>>"%PATCHED%"
    :next
)

move /Y "%PATCHED%" "%TARGET%" > nul
echo Patch applied successfully to %TARGET%.
endlocal
