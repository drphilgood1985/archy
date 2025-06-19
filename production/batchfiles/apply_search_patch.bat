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

for /f "usebackq delims=" %%L in ("%TARGET%") do (
    set "line=%%L"
    echo !line! | find "const ticketList = tickets" > nul
    if !errorlevel! == 0 (
        >> "%PATCHED%" echo const ticketList = tickets.map((t, i) => {
        >> "%PATCHED%" echo     const title = t.ticket_title || t.property_name || '(untitled)';
        >> "%PATCHED%" echo     const channelRef = t.channel_id ? `<#${t.channel_id}>` : '`unknown-channel`';
        >> "%PATCHED%" echo     return `**${i + 1}.** ${title} — ${channelRef}`;
        >> "%PATCHED%" echo }).join('\n');
        >> "%PATCHED%" echo console.log('DEBUG: Tickets returned from search:', tickets);
        >> "%PATCHED%" echo console.log('DEBUG: Setting session state for user:', message.author.id);
        goto :skip
    )
    echo !line!>>"%PATCHED%"
)

move /Y "%PATCHED%" "%TARGET%" > nul
echo Patch applied successfully to %TARGET%.
endlocal
