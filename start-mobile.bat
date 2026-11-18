@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
echo เปิดเว็บให้มือถือสแกนได้ (ลิงก์ชั่วคราวผ่าน Cloudflare) ...
echo ปิดหน้าต่างนี้ = ปิดลิงก์และเซิร์ฟเวอร์
echo.
python server\mobile.py
pause
