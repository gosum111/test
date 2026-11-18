@echo off
rem ===== เปิดเว็บจากเครื่องนี้ให้คนภายนอกเข้าได้ ผ่าน Cloudflare Tunnel (ดูขั้นตอนใน DEPLOY.md ทางเลือก B) =====
rem ต้องติดตั้ง cloudflared และสร้าง tunnel ชื่อ herbgarden ไว้ก่อน
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
set TRUST_PROXY=1
cd /d "%~dp0.."
start "herbgarden-server" python server\server.py
cloudflared tunnel run herbgarden
pause
