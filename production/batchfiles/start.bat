@echo off
echo 🧼 Clearing cached GitHub credentials...
git credential-manager erase https://github.com


echo 🔒 Setting Git to use your SCMG identity...
git config --global user.name "Philip Duckett"
git config --global user.email "pduckett@swimclubmanagement.com"


echo 📂 Changing directory to archybot...
cd c:\projects\archy\

echo 📦 Installing dependencies...
npm install --legacy-peer-deps


echo ✅ Done. ArchyBot is ready in /archybot.
pause
