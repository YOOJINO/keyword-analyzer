@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  상위노출 추적 워커를 시작합니다...
echo  (이 창을 닫으면 워커가 멈춥니다)
echo.
python worker.py
echo.
echo  워커가 종료되었습니다.
pause
