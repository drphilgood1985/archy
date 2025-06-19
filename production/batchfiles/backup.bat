@echo off
setlocal

echo 🗂️ Backing up deployed ArchyBot to C:\Projects\knowngood...

REM Clean up previous known good copy if it exists
rmdir /s /q C:\Projects\knowngood 2>nul

REM Clone fresh copy from GitHub
git clone git@github.com:pduckettscmg/archybot.git C:\Projects\knowngood


IF %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to clone repo. Check GitHub access or internet connection.
    pause
    exit /b 1
)

echo 🟢 Repo successfully cloned to C:\Projects\knowngood

REM Optional: remove .git folder to make it a static backup
rmdir /s /q C:\Projects\knowngood\.git

echo ✅ Clean known-good snapshot ready.
pause
