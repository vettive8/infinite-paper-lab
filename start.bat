@echo off
rem Infinite Paper — start the local server, then open the app.
cd /d "%~dp0"
set "NOTES_DIR=%~dp0..\InfiniteBoards-Notes"
start "" http://127.0.0.1:4321
node server.js
pause
