@echo off
set /p VERSION=Enter version or update note for commit: 
echo Committing with message: %VERSION%

git add .
git commit -m "%VERSION%"
git push

pause
