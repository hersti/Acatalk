@echo off
cd /d "C:\Users\ozgur\Desktop\acatalk"

git config --global user.email "hersti@github.com"
git config --global user.name "hersti"

rmdir /s /q .workspace 2>nul

git init
git add .
git commit -m "initial commit"
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/hersti/Acatalk.git
git push -u origin main
pause
