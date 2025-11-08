@echo off
chcp 65001 > nul
echo Resolving merge conflicts...
cd /d "c:/Users/Administrator/CodeBuddy/20251108020700"

"C:\Program Files\Git\bin\git.exe" checkout --theirs index.html
"C:\Program Files\Git\bin\git.exe" checkout --theirs index.js
"C:\Program Files\Git\bin\git.exe" checkout --theirs README.md
"C:\Program Files\Git\bin\git.exe" add .
"C:\Program Files\Git\bin\git.exe" commit -m "Resolve merge conflicts and deploy Haoqing Timer App"
"C:\Program Files\Git\bin\git.exe" push origin main

echo.
echo Done! Visit https://github.com/heibaiaxx1/AJCCT2 to view your repository
echo And https://heibaiaxx1.github.io/AJCCT2/ to view your app (after enabling GitHub Pages)
pause