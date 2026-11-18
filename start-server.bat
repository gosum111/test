@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
start "" http://localhost:8000

rem ถ้าเซิร์ฟเวอร์หยุดทำงานเพราะเกิดข้อผิดพลาด จะเปิดใหม่ให้อัตโนมัติใน 5 วินาที
rem ต้องการหยุดถาวร: ปิดหน้าต่างนี้
:loop
python server\server.py
echo.
echo เซิร์ฟเวอร์หยุดทำงาน — จะเปิดใหม่ใน 5 วินาที (ปิดหน้าต่างนี้ถ้าต้องการหยุดถาวร)
echo รายละเอียดข้อผิดพลาดดูได้ที่ server\logs\server.log
timeout /t 5 >nul
goto loop
