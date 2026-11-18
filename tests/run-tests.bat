@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d "%~dp0.."
echo ทดสอบระบบทั้งหมด (ใช้สำเนาข้อมูล ไม่แตะข้อมูลจริง) ...
python tests\run_tests.py
pause
