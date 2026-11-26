"""
Back End ของเว็บสวนสมุนไพร (Python standard library ล้วน ไม่ต้อง pip install)

  - เสิร์ฟหน้าเว็บ (index.html, css/, js/, images/, admin.html)
  - REST API + ฐานข้อมูล SQLite (ไฟล์ server/herbgarden.db สร้างให้อัตโนมัติ)

วิธีรัน (จากโฟลเดอร์โปรเจกต์):
    python server/server.py
แล้วเปิด http://localhost:8000  และหน้าแอดมิน http://localhost:8000/admin.html

ตั้งรหัสแอดมินเอง:  $env:ADMIN_PASSWORD = "รหัสของคุณ"; python server/server.py
"""
import base64
import csv
import getpass
import hashlib
import hmac
import io
import json
import logging
import logging.handlers
import math
import mimetypes
import os
import re
import secrets
import smtplib
import sqlite3
import ssl
import sys
import urllib.error
import urllib.request
from email.message import EmailMessage
import threading
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
import zipfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from html import escape as html_escape
from urllib.parse import quote, unquote, urlparse

ROOT = Path(__file__).resolve().parent.parent          # โฟลเดอร์เว็บ
DB_PATH = Path(os.environ.get("HERB_DB") or Path(__file__).resolve().parent / "herbgarden.db")
UPLOAD_DIR = ROOT / "images" / "uploads"
PORT = int(os.environ.get("PORT", "8000"))
# HOST: 127.0.0.1 = เปิดได้เฉพาะเครื่องนี้ (ปลอดภัยสุด ใช้คู่กับ Caddy/Cloudflare Tunnel) · 0.0.0.0 = เปิดให้เครื่องอื่นในเครือข่าย
HOST = os.environ.get("HOST", "127.0.0.1")
# TRUST_PROXY=1 เมื่อมี Caddy/Cloudflare อยู่ข้างหน้า → ใช้ IP จริงของผู้ใช้จาก header (สำหรับล็อกรหัส/กันสแปม)
TRUST_PROXY = os.environ.get("TRUST_PROXY", "") == "1"
NOTIFY_FILE = DB_PATH.parent / "notify.json"
# โหมดเว็บไซต์ทดลอง (ค่าเริ่มต้น): แถบแจ้ง "เว็บไซต์ทดลอง" ทุกหน้า + ห้าม Google เก็บเว็บ + แจ้งในฟอร์มติดต่อ
# นำไปใช้เป็นเว็บจริงเมื่อไร ให้ตั้ง DEMO_MODE=0
DEMO_MODE = os.environ.get("DEMO_MODE", "1") != "0"   # ตั้งค่าแจ้งเตือน (มีรหัส → ไม่เก็บในฐานข้อมูล/ไฟล์สำรอง)
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")      # ถ้าตั้งไว้ จะใช้แทน admin.json
ADMIN_FILE = Path(__file__).resolve().parent / "admin.json"  # เก็บแฮชของรหัสแอดมิน (ไม่เก็บรหัสจริง)
PBKDF2_ITER = 200_000
# การเข้าสู่ระบบ: นับเวลาจากการใช้งานครั้งล่าสุด (ใช้อยู่เรื่อย ๆ จะไม่หลุด)
SESSION_IDLE = 12 * 3600                               # ปกติ: ไม่ได้ใช้งาน 12 ชั่วโมง → ออกจากระบบ
SESSION_REMEMBER = 30 * 24 * 3600                      # ติ๊ก "จดจำฉัน": 30 วัน
MAX_BODY = 8 * 1024 * 1024                             # รับ request ได้ไม่เกิน 8MB
BLOCKED_DIRS = {"server", "deploy", "tests", "ขอข้อมูลจากสวน", ".claude", ".git"}           # ห้ามเสิร์ฟไฟล์ในโฟลเดอร์เหล่านี้
# เสิร์ฟได้เฉพาะไฟล์หน้าเว็บ — ไฟล์อื่นในโฟลเดอร์ (เช่น .txt, .bat, .db, .xlsx) เปิดผ่านเว็บไม่ได้
PUBLIC_EXT = {".html", ".css", ".js", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".ico",
              ".pdf", ".woff", ".woff2", ".ttf", ".mp4", ".webm", ".webmanifest"}



# ---------------------------------------------------------------- admin password
def _hash(pw: str, salt: bytes, iterations: int) -> str:
    return hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), salt, iterations).hex()


def set_password(pw: str):
    salt = secrets.token_bytes(16)
    ADMIN_FILE.write_text(json.dumps({"salt": salt.hex(), "iterations": PBKDF2_ITER,
                                      "hash": _hash(pw, salt, PBKDF2_ITER)}), encoding="utf-8")


def password_source() -> str:
    if ADMIN_PASSWORD:
        return "env"
    return "file" if ADMIN_FILE.exists() else "default"


def check_password(pw: str) -> bool:
    src = password_source()
    if src == "env":
        return hmac.compare_digest(pw.encode(), ADMIN_PASSWORD.encode())
    if src == "file":
        cfg = json.loads(ADMIN_FILE.read_text(encoding="utf-8"))
        return hmac.compare_digest(_hash(pw, bytes.fromhex(cfg["salt"]), cfg["iterations"]), cfg["hash"])
    return hmac.compare_digest(pw.encode(), b"admin1234")

# ---------------------------------------------------------------- database
SCHEMA = """
CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'ข่าวสาร',
  detail TEXT NOT NULL DEFAULT '',
  img TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  img TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS workshops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  img TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS brochures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'แนะนำ',
  file TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS herbs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  th TEXT NOT NULL,
  en TEXT NOT NULL DEFAULT '',
  sci TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  uses TEXT NOT NULL DEFAULT '',
  groups TEXT NOT NULL DEFAULT '',
  province TEXT NOT NULL DEFAULT '',
  img TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  img TEXT NOT NULL DEFAULT '',
  contain INTEGER NOT NULL DEFAULT 0,
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  img TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'event',
  date TEXT NOT NULL,
  end_date TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS map_spots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'group',
  num INTEGER NOT NULL DEFAULT 0,
  icon TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  x TEXT NOT NULL DEFAULT '',
  y TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  expires REAL NOT NULL,
  remember INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  img TEXT NOT NULL DEFAULT '',
  is_sample INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
"""

# ข้อมูลตั้งต้น (ย้ายมาจาก js/data.js) — เรียงจากเก่าไปใหม่ เพราะหน้าเว็บแสดง id มากสุดก่อน
SEED_NEWS = [
    ("ภาพบรรยากาศในสวน", "ข่าวสาร", "", "images/news3.jpg"),
    ("โครงการปรับ เปลี่ยน ปลูก", "โครงการ", "", "images/news2.jpg"),
    ("กิจกรรมวันสงกรานต์ และทำบุญ ในวันที่ 18 เมษายน 69 ครบรอบ 41 ปี สวนสมุนไพรสมเด็จพระเทพฯ", "กิจกรรม",
     "วันเสาร์ที่ 18 เมษายน 2569 ครบรอบ 41 ปี สวนสมุนไพรสมเด็จพระเทพรัตนราชสุดาฯ สยามบรมราชกุมารี", "images/news1.jpg"),
]
SEED_ARTICLES = [
    ("", "บทความตัวอย่าง (กระเจียว)", "", "images/article4.jpg", "<p>เนื้อหาตัวอย่าง</p>"),
    ("30/01/2026", 'ประโยชน์ของ "ต้นชะมวง"',
     "ขอให้ชีวิตวันนี้ละมุนเหมือน “ต้นชะมวง”<br>มีทั้งความเปรี้ยวนิดๆ ให้ชีวิตมีรสชาติ<br>แต่สุดท้ายก็กลมกล่อม ลงตัวในแบบของเรา 🍃✨",
     "images/article3.jpg", "<p>เนื้อหาตัวอย่าง</p>"),
    ("30/01/2026", 'ประโยชน์ "ต้นกะเพราแดง"', "เผ็ดร้อนเหมือน “ต้นกะเพราแดง” 🌶️", "images/article2.jpg", "<p>เนื้อหาตัวอย่าง</p>"),
    ("05/05/2026", "E-book ข้อมูลสรรพคุณสมุนไพรในสวนสมุนไพรสมเด็จพระเทพฯ", "", "images/article1.jpg",
     "<p>เนื้อหาตัวอย่าง — ใส่ลิงก์ E-book จริงที่นี่</p>"),
]
SEED_WORKSHOPS = [
    ("ลูกประคบสมุนไพร", "(ตัวอย่าง)", "images/workshop5.jpg"),
    ("สเปรย์สมุนไพรกันยุง", "สารสกัดจากน้ำมันตะไคร้หอม ช่วยกันยุง กลิ่นหอมสดชื่น", "images/workshop4.jpg"),
    ("ขี้ผึ้งไพล", "", "images/workshop3.jpg"),
    ("ยาดมจันทน์เทศ", "", "images/workshop2.jpg"),
    ("พิมเสนน้ำอโรม่า กลิ่นดอกบัวหลวง", "", "images/workshop1.jpg"),
]
SEED_BROCHURES = [
    ("กิจกรรมประจำปี", "กิจกรรม", ""),
    ("สมุนไพรประจำหมวดสรรพคุณ", "สมุนไพร", ""),
    ("แผนที่การเดินทาง", "แผนที่", ""),
    ("แผ่นพับแนะนำสวนสมุนไพร", "แนะนำ", ""),
]
# สมุนไพรตั้งต้น (ย้ายมาจาก js/herb-search.js): th, en, sci, detail, uses, groups, province
SEED_HERBS = [
    ("ไทรย้อยใบแหลม", "Fig, Golden Fig, Weeping Fig", "Ficus benjamina L.",
     "ไทรย้อยใบแหลมมีถิ่นกำเนิดในอินเดียและมาเลเซีย เป็นไม้ยืนต้น สูงได้ถึง 10 เมตร มีรากอากาศห้อยย้อยลงมาจากกิ่ง ใบเดี่ยวเรียงสลับ ปลายใบแหลม",
     "รากมีสรรพคุณแก้ฝีเปื่อยพัง ขับพยาธิ แก้บวม แก้นิ่ว ทาแผลฟกช้ำ สมานลำไส้ แก้ตับพิการ บำรุงโลหิต",
     "กลุ่มยาบำรุงโลหิต", "กรุงเทพมหานคร"),
    ("นนทรี", "Yellow Flame, Copper Pod", "Peltophorum pterocarpum (DC.) K.Heyne",
     "ไม้ยืนต้นขนาดกลางถึงใหญ่ ทรงพุ่มกว้าง ใบประกอบแบบขนนกสองชั้น ดอกสีเหลืองออกเป็นช่อตั้งที่ปลายกิ่ง ฝักแบนสีน้ำตาลแดง",
     "เปลือกต้นใช้เป็นยาสมานแผล แก้ท้องร่วง ตามตำรายาไทย", "กลุ่มยาระบบทางเดินอาหาร", "นนทบุรี"),
    ("ทองกวาว", "Flame of the Forest, Bastard Teak", "Butea monosperma (Lam.) Taub.",
     "ไม้ยืนต้นผลัดใบ สูง 10–15 เมตร ใบประกอบมี 3 ใบย่อย ดอกสีแสดออกเป็นช่อขณะทิ้งใบในฤดูแล้ง",
     "ตำรายาไทยใช้ดอกแก้ไข้ ขับปัสสาวะ ยางใช้แก้ท้องร่วง", "กลุ่มยาแก้ไข้, กลุ่มยาขับปัสสาวะ", "เชียงใหม่"),
    ("ราชพฤกษ์ (คูน)", "Golden Shower, Indian Laburnum", "Cassia fistula L.",
     "ไม้ยืนต้นผลัดใบ สูง 10–20 เมตร ดอกสีเหลืองออกเป็นช่อห้อยลง ฝักกลมยาวสีดำเมื่อแก่",
     "เนื้อในฝักใช้เป็นยาระบายอ่อน ๆ ตามตำรายาไทย", "กลุ่มยาระบบทางเดินอาหาร", "ขอนแก่น"),
    ("ฟ้าทะลายโจร", "Kariyat, The Creat", "Andrographis paniculata (Burm.f.) Nees",
     "ไม้ล้มลุก สูง 30–70 เซนติเมตร ลำต้นเป็นสี่เหลี่ยม ใบเดี่ยวเรียงตรงข้าม ทุกส่วนมีรสขมจัด",
     "บรรเทาอาการเจ็บคอ ไข้หวัด และท้องเสียไม่รุนแรง ตามบัญชียาหลักแห่งชาติด้านสมุนไพร",
     "กลุ่มยาแก้ไข้, กลุ่มยาระบบทางเดินหายใจ", ""),
    ("ขมิ้นชัน", "Turmeric", "Curcuma longa L.",
     "ไม้ล้มลุกมีเหง้าใต้ดิน เนื้อในเหง้าสีเหลืองส้ม มีกลิ่นหอมเฉพาะ ใบเดี่ยวรูปใบหอก",
     "บรรเทาอาการท้องอืด ท้องเฟ้อ อาหารไม่ย่อย ใช้ภายนอกบรรเทาผื่นคัน",
     "กลุ่มยาระบบทางเดินอาหาร, กลุ่มยารักษาโรคผิวหนัง", ""),
    ("ขิง", "Ginger", "Zingiber officinale Roscoe",
     "ไม้ล้มลุก มีเหง้าใต้ดินสีน้ำตาลแกมเหลือง กลิ่นหอมเฉพาะ รสเผ็ดร้อน",
     "ขับลม บรรเทาอาการท้องอืด คลื่นไส้อาเจียน", "กลุ่มยาระบบทางเดินอาหาร", ""),
    ("บอระเพ็ด", "Heart-leaved Moonseed", "Tinospora crispa (L.) Hook.f. & Thomson",
     "ไม้เถาเลื้อย ลำต้นมีปุ่มปมทั่วไป ใบเดี่ยวรูปหัวใจ ทุกส่วนมีรสขมจัด",
     "แก้ไข้ เจริญอาหาร ตามตำรายาไทย", "กลุ่มยาแก้ไข้", ""),
    ("ว่านหางจระเข้", "Aloe", "Aloe vera (L.) Burm.f.",
     "ไม้ล้มลุกอวบน้ำ ใบหนาเรียงซ้อนกัน ขอบใบมีหนาม ภายในมีวุ้นใส",
     "วุ้นใช้ทาบรรเทาแผลไฟไหม้ น้ำร้อนลวก แผลถลอก", "กลุ่มยารักษาโรคผิวหนัง", ""),
    ("ไพล", "Cassumunar Ginger", "Zingiber montanum (J.Koenig) Link ex A.Dietr.",
     "ไม้ล้มลุก มีเหง้าใต้ดิน เนื้อในสีเหลือง กลิ่นหอมฉุน",
     "ใช้ทำลูกประคบและน้ำมันไพล บรรเทาอาการปวดเมื่อย เคล็ดขัดยอก ฟกช้ำ", "กลุ่มยาบรรเทาปวดเมื่อย", ""),
    ("มะขามป้อม", "Indian Gooseberry", "Phyllanthus emblica L.",
     "ไม้ยืนต้นขนาดกลาง ใบเล็กเรียงสลับคล้ายใบประกอบ ผลกลมสีเขียวอมเหลือง รสเปรี้ยวฝาดอมหวาน",
     "บรรเทาอาการไอ ขับเสมหะ ทำให้ชุ่มคอ", "กลุ่มยาระบบทางเดินหายใจ", ""),
    ("บัวบก", "Asiatic Pennywort", "Centella asiatica (L.) Urb.",
     "ไม้ล้มลุก เลื้อยตามผิวดิน ใบเดี่ยวรูปไตออกเป็นกระจุกที่ข้อ",
     "ใช้ภายนอกช่วยสมานแผล ใช้ทำเครื่องดื่มบำรุงร่างกาย", "กลุ่มยาบำรุงร่างกาย, กลุ่มยารักษาโรคผิวหนัง", ""),
    ("ตะไคร้", "Lemongrass", "Cymbopogon citratus (DC.) Stapf",
     "ไม้ล้มลุก ขึ้นเป็นกอ ใบเรียวยาว มีกลิ่นหอมเฉพาะ",
     "ขับลม บรรเทาอาการท้องอืด ขับปัสสาวะ", "กลุ่มยาระบบทางเดินอาหาร, กลุ่มยาขับปัสสาวะ", ""),
]
# หน้าเนื้อหา (ย้ายมาจาก js/main.js) — เขียนแบบข้อความง่าย ๆ: เว้นบรรทัด = ย่อหน้าใหม่,
# "## " = หัวข้อ, "- หัวข้อ: รายละเอียด" = เส้นเวลา, "- ข้อความ" = รายการ
SEED_PAGES = [
    ("/about/history", "ประวัติความเป็นมา", "images/about.jpg",
     "สวนสมุนไพรสมเด็จพระเทพรัตนราชสุดาฯ สยามบรมราชกุมารี จัดตั้งขึ้นเพื่อเป็นแหล่งรวบรวม อนุรักษ์ และเผยแพร่ความรู้ด้านสมุนไพรไทย ซึ่งเป็นภูมิปัญญาที่มีคุณค่าเอนกอนันต์\n\n"
     "## เหตุการณ์สำคัญ\n- ปีที่ก่อตั้ง: ระบุเหตุการณ์สำคัญ\n- ปีที่ขยายพื้นที่: ระบุเหตุการณ์สำคัญ\n"
     "- ปัจจุบัน: รวบรวมพันธุ์สมุนไพรมากกว่า 509 ชนิด บนเนื้อที่ 60 ไร่"),
    ("/about/building", "อาคารเฉลิมพระเกียรติ 50 พรรษา", "images/building.jpg",
     "รายละเอียดอาคาร ห้องนิทรรศการ และพื้นที่ใช้สอยภายในอาคาร"),
    ("/about/awards", "รางวัลที่ได้รับ", "images/awards.jpg",
     "- ชื่อรางวัล: หน่วยงานที่มอบ · ปี\n- ชื่อรางวัล: หน่วยงานที่มอบ · ปี"),
    ("/cookie", "นโยบายคุกกี้", "",
     "เว็บไซต์นี้ใช้คุกกี้เพื่อจดจำการตั้งค่าและปรับปรุงประสบการณ์การใช้งาน ท่านสามารถเลือกยอมรับหรือปฏิเสธได้จากแถบแจ้งเตือนด้านล่างของหน้าเว็บ"),
]
# โครงการและกิจกรรม (ย้ายมาจาก js/activities.js) — เรียงเก่า→ใหม่ (วันที่แบบ ค.ศ. YYYY-MM-DD)
SEED_ACTIVITIES = [
    ("ตลาด", "2026-01-22", "ตลาดในสวน@สวนสมุนไพรสมเด็จพระเทพฯ",
     "กิจกรรมตลาดในสวน@สวนสมุนไพรสมเด็จพระเทพฯ จัดขึ้นทุกวันเสาร์-อาทิตย์สัปดาห์แรกของเดือน",
     "images/activity4.jpg", 0, "เนื้อหาตัวอย่าง"),
    ("Sport Complex", "2026-01-22", "Sport Complex", "", "images/activity3.jpg", 0, "เนื้อหาตัวอย่าง"),
    ("อบรม/เวิร์คช็อป", "2026-01-27", "ยาดมจันทน์เทศ", "", "images/activity2.jpg", 0, "เนื้อหาตัวอย่าง"),
    ("งาน อพ.สธ.", "2026-04-17", "สืบสานพระราชปณิธาน รักษาฐานทรัพยากรแผ่นดิน",
     "จุดเริ่มต้น และ เป้าหมายของโครงการ อพ.สธ.-ปตท.", "images/activity1.jpg", 1,
     "เนื้อหาตัวอย่าง — ใส่รายละเอียดโครงการจริงที่นี่"),
]
# บริการ (หน้าแรก) — ขึ้นบรรทัดใหม่ในชื่อได้
SEED_SERVICES = [
    ("บริการเยี่ยมชม\nพร้อมเจ้าหน้าที่บรรยาย", "images/service1.jpg", "#/contact", 1),
    ("บริการรถนำเที่ยว\nพร้อมเจ้าหน้าที่บรรยาย", "images/service2.jpg", "#/contact", 2),
    ("Workshop\nสมุนไพร", "images/service3.jpg", "#/activities", 3),
    ("Sport Complex\nและสนามฟุตบอล", "images/service4.jpg", "#/activities", 4),
]
# แผนผังสวน (ย้ายมาจาก js/garden-map.js) — kind, num, icon, title, detail, x, y
# group = กลุ่มสรรพคุณ (num = เลขกลุ่ม · detail ว่าง = ยังไม่แสดงบนเว็บ)
# place = อาคาร/สถานที่ (num = ลำดับ · icon = ชื่อไอคอนใน MAP_ICONS หรือตัวอักษร 1 ตัว เช่น A)
# x, y = ตำแหน่งหมุดบนภาพ images/map.jpg (% จากซ้าย/บน · ว่าง = ไม่มีหมุด)
SEED_MAP_SPOTS = [
    ("group", 1, "", "กลุ่มพืชหอมต่างๆ (Aromatic Plants)",
     "กระดังงาไทย / กระดังงาสงขลา / กานพลู / กุหลาบมอญ / ขันทองพยาบาท / จำปา / จำปาขาว / จำปี / จำปีสิรินธร / ชมนาด / ดีปลี / ตะไคร้บ้าน / ตะไคร้หอม / นมแมว / มณฑา / มะกรูด / มะนาว / มะตูม / มะพลับ / มหาหงส์ / โมกหลวง / พิกุล / ยี่หร่า / ส้มเขียวหวาน / ส้มซ่า / มะขามป้อม / มะเฟือง / มะดัน",
     "61.5", "25.2"),
    ("group", 2, "", "กลุ่มแก้โรคผิวหนัง (Treatment of Skin Diseases)",
     "ข่า / ขมิ้นชัน / ข่าใหญ่ / ไพล / คำแสด / ดีปลี / ผักคราดหัวแหวน / ฝรั่ง / มะขาม / มะขามเทศ / มะเกลือ / มะคำดีควาย / มะหาด / พลับพลึง / ฟักข้าว / ระกำ / ว่านหางจระเข้ / สับปะรด / สำหล้า / เสลดพังพอนตัวเมีย",
     "63.3", "66.2"),
    ("group", 3, "", "กลุ่มต้านฮีสตามีน (Antihistaminic Agents)",
     "กะเม็ง / กำยาน / ขลู่ / เถาคัน / เทียนบ้าน / บอระเพ็ด / มะระขี้นก / มะรุม / มังคุด / ย่านาง / หญ้าคา / หญ้าหนวดแมว / หญ้าใต้ใบ (เล็ก) / เสี้ยนกุ่ง / สาบเสือ / แก้ว / เทพทาโร",
     "49.8", "48.6"),
    ("group", 4, "", "กลุ่มยาแก้อ่อนเพลีย บำรุงกำลัง (Tonic)",
     "กะเพรา / กำยาน / ขี้เหล็ก / บุกหลวง / มะตูม / มะขาม / มะดัน", "53.2", "25.7"),
    ("group", 5, "", "กลุ่มแก้ไข้ ลดความร้อน (Antifever, Antipyretic)",
     "กะเพรา / กำยาน / ขี้เหล็ก / ตะไคร้บ้าน / เทียนบ้าน / ดีปลี / ฟ้าทะลายโจร / มะยม / มะกรูด / มะขามป้อม / มะดัน / มังคุด / ย่านาง / ลำโพง / สาบเสือ / หญ้าคา / หญ้าหนวดแมว / มะระขี้นก / สมอพิเภก / สมอไทย",
     "45.2", "37.9"),
    ("group", 6, "", "กลุ่มยาขับน้ำนม (Galactogogues)",
     "กานพลู / กุยช่าย / ไทรย้อยใบแหลม / มะเกลือเทศแดง / เจต / อะลาง", "46.6", "25.5"),
    ("group", 7, "", "กลุ่มยาถ่าย ยาระบาย (Cathartic, Laxative)",
     "กากหมาก / ชุมเห็ดเทศ / ลูก / ตองตึง / บุกค้ำเสา / บุกหอม / ส้มป่อย / มะขามแขก / มะขามเทศ / มะขาม / มะตูม / มะเกลือ / มะหาด / ระกำ / ว่านหางจระเข้ / สมอไทย / สมอพิเภก / สมอเทศ",
     "37.1", "55.8"),
    ("group", 8, "", "กลุ่มยาสมุนไพรตำรับไทย (Thai Herbal Remedies)",
     "ขมิ้นชัน / กระชาย / ยอ / กานพลู / บอระเพ็ด / มะตูมเทศ / ดีปลี / ขี้เหล็ก / ชะพลู / ฟ้าทะลายโจร / มะขามป้อม / มะเกลือ / มะหาด / สมอพิเภก / สมอไทย / สมอเทศ / สมุนไพรตำรับยาไทย",
     "36.3", "40.5"),
    ("group", 9, "", "กลุ่มยาแก้ไอ ขับเสมหะ (Antitussive, Expectorants)",
     "ข่า / กระชาย / กระวาน / กานพลู / ขิง / ขี้เหล็ก / ตะไคร้หอม / มะกรูด / มะขามป้อม / มะดัน / มังคุด / มะนาว / สมอไทย / สมอพิเภก / สมอเทศ / หญ้าหนวดแมว",
     "28.6", "39.2"),
    *[("group", n, "", f"กลุ่มที่ {n}", "", x, y) for n, x, y in [
        (10, "30.6", "28.3"), (11, "22.5", "57.4"), (12, "24.0", "31.4"), (13, "10.8", "71.7"),
        (14, "14.4", "44.2"), (15, "11.8", "57.4"), (16, "15.3", "31.9"), (17, "5.2", "70.6"),
        (18, "9.8", "46.8"), (19, "", ""), (20, "18.1", "27.3")]],
    ("place", 1, "arch", "ซุ้มไม้เลื้อย (Creeper Arches)",
     "พันธุ์ไม้สมุนไพรเลื้อยขึ้นตามโครงสร้างทางเดิน เพิ่มบรรยากาศร่มรื่นตลอดแนวสวนด้านตะวันตก", "49.3", "19.2"),
    ("place", 2, "pond", "สระกฤษณา (Eaglewood (Krishana) Pond)", "สระน้ำขนาดใหญ่ มีเงาสะท้อนภาพของกฤษณาลงบนผิวน้ำ", "6.1", "48.3"),
    ("place", 3, "shop", "ศูนย์บริการร้านค้าชุมชน", "ร้านอาหารและเครื่องดื่ม", "80.5", "8.6"),
    ("place", 4, "museum", "อาคารพิพิธภัณฑ์สมุนไพร (Museum Building)", "รวบรวมประวัติความเป็นมาของสมุนไพรไทยและวิถีชีวิตแบบไทย", "84.5", "26.5"),
    ("place", 5, "zodiac", "ลาน 12 ราศี (Zodiac Court)", "นาฬิกาแดดบอกเวลาตามจักรราศี", "32.4", "57.9"),
    ("place", 6, "lotus", "สระบัวหลวง", "สระบัวรูปครึ่งวงกลม เป็นสัญลักษณ์ต้อนรับผู้มาเยือน", "60.9", "48.1"),
    ("place", 7, "pavilion", "ศาลาพักผ่อน (Recreation Pavilion)", "ศาลาไทยสำหรับพักผ่อน", "10.2", "27.3"),
    ("place", 8, "A", "อาคารเฉลิมพระเกียรติ 50 พรรษา", "", "85.0", "41.6"),
    ("place", 9, "B", "ห้องประชุมสายน้ำผึ้ง", "", "87.8", "59.0"),
    ("place", 10, "C", "จุดขึ้นรถบริการนำชมสวนสมุนไพร", "", "72.1", "25.2"),
    ("place", 11, "toilet", "ห้องน้ำ (Toilet)", "", "82.9", "8.6"),
]
MAP_KINDS = {"group": "กลุ่มสรรพคุณ", "place": "อาคาร/สถานที่"}
MAP_ICONS = {"arch", "pond", "shop", "museum", "zodiac", "lotus", "pavilion", "toilet"}   # ต้องตรงกับ GM_ICONS ใน js/garden-map.js
EVENT_KINDS = {"event": "กิจกรรม", "market": "ตลาดนัด", "closed": "ปิดทำการ"}
# ข้อมูลเว็บไซต์ที่แก้ได้จากหน้าแอดมิน (แท็บ ⚙️ ตั้งค่าเว็บไซต์) — แสดงในหน้าติดต่อเราและส่วนท้ายของทุกหน้า
SITE_INFO_DEFAULTS = {
    "site_address": "39 ทางหลวงระยอง 3191 อ.นิคมพัฒนา จ.ระยอง 21180",
    "site_phones": "03-867-6168, 084-930-6060",
    "site_email": "pr_herbgarden@pttplc.com",
    "site_hours": "สวนสมุนไพร อังคาร–อาทิตย์ 09.00–16.30 น. (ปิดวันจันทร์)\nพื้นที่ออกกำลังกาย ทุกวัน 06.00–20.00 น.\nเข้าชมฟรี",
    "site_facebook": "https://www.facebook.com/ptt.herbgarden",
    "site_youtube": "https://www.youtube.com/@pttherbgardenchannel8378",
    "site_line": "",
    "site_map_query": "PTT Herb Garden Rayong",
    "site_show_info": "0",   # หน้าติดต่อเรา: แสดงที่อยู่/โทร/เวลาทำการข้างฟอร์ม (1 = แสดง)
    "site_show_map": "0",    # หน้าติดต่อเรา: แสดงแผนที่ Google Maps (1 = แสดง)
}
SITE_URL_KEYS = ("site_facebook", "site_youtube", "site_line")
DEFAULT_SETTINGS = {
    "market_auto": "1",     # ตลาดนัดอัตโนมัติ: เสาร์–อาทิตย์สัปดาห์แรกของเดือน
    "closed_monday": "1",   # ปิดทำการทุกวันจันทร์ (ตามเวลาทำการในหน้าติดต่อเรา)
    **SITE_INFO_DEFAULTS,
}
# ตารางใหม่จะได้ข้อมูลตั้งต้นเฉพาะตอนสร้างครั้งแรก (ลบหมดแล้วจะไม่เด้งกลับมา)
SEEDS = {
    "activities": ("INSERT INTO activities(type,date,title,excerpt,img,contain,body) VALUES(?,?,?,?,?,?,?)",
                   SEED_ACTIVITIES),
    "services": ("INSERT INTO services(title,img,link,sort) VALUES(?,?,?,?)", SEED_SERVICES),
    "settings": ("INSERT INTO settings(key,value) VALUES(?,?)", list(DEFAULT_SETTINGS.items())),
    "pages": ("INSERT INTO pages(key,title,img,body) VALUES(?,?,?,?)", SEED_PAGES),
    "herbs": ("INSERT INTO herbs(th,en,sci,detail,uses,groups,province) VALUES(?,?,?,?,?,?,?)", SEED_HERBS),
    "news": ("INSERT INTO news(title,type,detail,img) VALUES(?,?,?,?)", SEED_NEWS),
    "articles": ("INSERT INTO articles(date,title,excerpt,img,body) VALUES(?,?,?,?,?)", SEED_ARTICLES),
    "workshops": ("INSERT INTO workshops(name,detail,img) VALUES(?,?,?)", SEED_WORKSHOPS),
    "brochures": ("INSERT INTO brochures(title,type,file) VALUES(?,?,?)", SEED_BROCHURES),
    "map_spots": ("INSERT INTO map_spots(kind,num,icon,title,detail,x,y) VALUES(?,?,?,?,?,?,?)", SEED_MAP_SPOTS),
}


APP_VERSION = "1.0"
STARTED = time.time()
LOG = logging.getLogger("herbgarden")
LOG_DIR = DB_PATH.parent / "logs"           # อยู่ใน server/ → เปิดผ่านเว็บไม่ได้
HEALTH = {"integrity": "ยังไม่ได้ตรวจ", "checked": 0.0}
ERRORS: list[float] = []                     # เวลาที่เกิดข้อผิดพลาด (ใช้เตือนในแท็บความพร้อม)


def setup_logging():
    """log ทั้งหน้าจอและไฟล์ server/logs/server.log (หมุนไฟล์ละ 1MB เก็บ 5 ไฟล์ — ไม่บวมจนดิสก์เต็ม)"""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s", "%Y-%m-%d %H:%M:%S")
    fh = logging.handlers.RotatingFileHandler(LOG_DIR / "server.log", maxBytes=1_000_000, backupCount=5, encoding="utf-8")
    fh.setFormatter(fmt)
    sh = logging.StreamHandler()
    sh.setFormatter(fmt)
    LOG.handlers[:] = [fh, sh]
    LOG.setLevel(logging.INFO)


def log_error(msg: str):
    ERRORS.append(time.time())
    del ERRORS[:-1000]
    LOG.exception(msg)


def db():
    # timeout: ถ้ามีคนเขียนข้อมูลอยู่ ให้รอได้ถึง 10 วินาที แทนที่จะ error "database is locked" ทันที
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    return con


def check_integrity() -> str:
    """ตรวจความสมบูรณ์ของไฟล์ฐานข้อมูล (ทำทุกวันอัตโนมัติ)"""
    con = db()
    try:
        res = con.execute("PRAGMA quick_check").fetchone()[0]
    finally:
        con.close()
    HEALTH.update(integrity=res, checked=time.time())
    if res != "ok":
        LOG.error("ฐานข้อมูลมีปัญหา: %s — ควรกู้คืนจากไฟล์สำรอง", res)
    return res


def init_db():
    # โหมด WAL: อ่านและเขียนพร้อมกันได้ ทนต่อไฟดับ/เครื่องค้างระหว่างเขียนได้ดีกว่า
    con = db()
    try:
        con.execute("PRAGMA journal_mode=WAL")
    finally:
        con.close()
    with db() as con:
        existing = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        con.executescript(SCHEMA)
        for table, (sql, data) in SEEDS.items():
            if table not in existing:
                con.executemany(sql, data)
        # อัปเกรดฐานข้อมูลเก่า: เพิ่มคอลัมน์ที่มาทีหลัง
        have = {r[1] for r in con.execute("PRAGMA table_info(herbs)")}
        for col in ("img", "status", "img_credit", "other_names", "verse", "verse_src", "detail_en", "uses_en"):
            if col not in have:
                con.execute(f"ALTER TABLE herbs ADD COLUMN {col} TEXT NOT NULL DEFAULT ''")
        # ภาษาอังกฤษของเนื้อหาที่แอดมินพิมพ์ (ว่าง = โหมด EN แสดงภาษาไทย)
        for table, cols in (("pages", ("title_en", "body_en")), ("news", ("title_en", "detail_en")),
                            ("articles", ("title_en", "excerpt_en", "body_en"))):
            have = {r[1] for r in con.execute(f"PRAGMA table_info({table})")}
            for col in cols:
                if col not in have:
                    con.execute(f"ALTER TABLE {table} ADD COLUMN {col} TEXT NOT NULL DEFAULT ''")
        for t in SOFT_TABLES:   # ถังขยะ: deleted_at ว่าง = ใช้งานอยู่, มีค่า = อยู่ในถังขยะ
            if "deleted_at" not in {r[1] for r in con.execute(f"PRAGMA table_info({t})")}:
                con.execute(f"ALTER TABLE {t} ADD COLUMN deleted_at TEXT")


def rows(sql, args=()):
    with db() as con:
        return [dict(r) for r in con.execute(sql, args).fetchall()]


# ---------------------------------------------------------------- การเข้าสู่ระบบ (เก็บในฐานข้อมูล → รีสตาร์ตแล้วไม่หลุด)
def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()   # เก็บแค่ค่าแฮช ไม่เก็บ token จริง


def create_session(remember: bool) -> str:
    token = secrets.token_urlsafe(32)
    ttl = SESSION_REMEMBER if remember else SESSION_IDLE
    with db() as con:
        con.execute("INSERT INTO sessions(token_hash, expires, remember) VALUES(?,?,?)",
                    (_token_hash(token), time.time() + ttl, int(remember)))
    return token


def check_session(token: str) -> bool:
    if not token:
        return False
    h, now = _token_hash(token), time.time()
    r = rows("SELECT expires, remember FROM sessions WHERE token_hash=?", (h,))
    if not r or r[0]["expires"] < now:
        return False
    ttl = SESSION_REMEMBER if r[0]["remember"] else SESSION_IDLE
    if r[0]["expires"] - now < ttl - 300:      # ยังใช้งานอยู่ → ต่อเวลา (อัปเดตไม่เกิน 5 นาทีครั้ง)
        with db() as con:
            con.execute("UPDATE sessions SET expires=? WHERE token_hash=?", (now + ttl, h))
    return True


def end_session(token: str):
    if token:
        with db() as con:
            con.execute("DELETE FROM sessions WHERE token_hash=?", (_token_hash(token),))


def end_all_sessions():
    with db() as con:
        con.execute("DELETE FROM sessions")


def now_ts() -> str:
    return datetime.now().isoformat(sep=" ", timespec="milliseconds")


# ---------------------------------------------------------------- ถังขยะ (ลบแล้วกู้คืนได้ภายใน 30 วัน)
SOFT_TABLES = {"herbs": "th", "news": "title", "articles": "title", "workshops": "name",
               "brochures": "title", "activities": "title", "services": "title", "events": "title",
               "messages": "name", "map_spots": "title"}   # ตาราง → คอลัมน์ที่ใช้เป็นชื่อรายการ
TRASH_DAYS = 30
LIVE = "deleted_at IS NULL"


def trash_groups():
    """รายการในถังขยะ จัดกลุ่มตามครั้งที่ลบ (ลบพร้อมกันหลายรายการ = 1 กลุ่ม)"""
    out = []
    for t, col in SOFT_TABLES.items():
        for g in rows(f"SELECT deleted_at, COUNT(*) AS n FROM {t} WHERE deleted_at IS NOT NULL GROUP BY deleted_at"):
            names = [r[col] for r in rows(f"SELECT {col} FROM {t} WHERE deleted_at=? ORDER BY id LIMIT 6",
                                          (g["deleted_at"],))]
            expires = datetime.fromisoformat(g["deleted_at"]) + timedelta(days=TRASH_DAYS)
            out.append({"type": t, "deleted_at": g["deleted_at"], "count": g["n"], "names": names,
                        "days_left": max(0, math.ceil((expires - datetime.now()).total_seconds() / 86400))})
    return sorted(out, key=lambda g: g["deleted_at"], reverse=True)


def purge_trash():
    cutoff = (datetime.now() - timedelta(days=TRASH_DAYS)).isoformat(sep=" ", timespec="milliseconds")
    with db() as con:
        for t in SOFT_TABLES:
            con.execute(f"DELETE FROM {t} WHERE deleted_at IS NOT NULL AND deleted_at < ?", (cutoff,))


# ---------------------------------------------------------------- สำรองข้อมูล
BACKUP_DIR = DB_PATH.parent / "backups"          # อยู่ใน server/ → เปิดผ่านเว็บไม่ได้
BACKUP_KEEP = 30                                 # เก็บไว้ประเภทละ 30 ชุดล่าสุด
BACKUP_RE = re.compile(r"herbgarden-(\d{8}-\d{9})-(auto|manual|before-import|before-restore)\.db")
BACKUP_LOCK = threading.Lock()


def make_backup(reason: str) -> str:
    with BACKUP_LOCK:
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S%f")[:-3]
        path = BACKUP_DIR / f"herbgarden-{stamp}-{reason}.db"
        src, dst = sqlite3.connect(DB_PATH), sqlite3.connect(path)
        try:
            src.backup(dst)                      # สำเนาที่สมบูรณ์แม้มีการเขียนอยู่
            dst.execute("PRAGMA journal_mode=DELETE")   # ไฟล์สำรองเป็นไฟล์เดียว ดาวน์โหลด/เปิดอ่านได้เลย
        finally:
            dst.close(); src.close()
        LOG.info("สำรองข้อมูล: %s", path.name)
        # ลบชุดเก่า: เก็บอัตโนมัติ 30 ชุด และแบบอื่น (กดเอง/ก่อนนำเข้า/ก่อนกู้คืน) อีก 30 ชุด
        found = [(f, BACKUP_RE.fullmatch(f.name)) for f in sorted(BACKUP_DIR.glob("herbgarden-*.db"), reverse=True)]
        auto = [f for f, m in found if m and m.group(2) == "auto"]
        other = [f for f, m in found if m and m.group(2) != "auto"]
        for group in (auto, other):
            for old in group[BACKUP_KEEP:]:
                old.unlink(missing_ok=True)
        return path.name


def backup_info(f: Path):
    m = BACKUP_RE.fullmatch(f.name)
    counts = {}
    try:
        con = sqlite3.connect(f"file:{f}?mode=ro", uri=True)
        try:
            for t in SOFT_TABLES:
                try:
                    counts[t] = con.execute(f"SELECT COUNT(*) FROM {t} WHERE {LIVE}").fetchone()[0]
                except sqlite3.Error:             # สำรองรุ่นเก่า (ยังไม่มีถังขยะ/ตารางนี้)
                    try:
                        counts[t] = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
                    except sqlite3.Error:
                        counts[t] = 0
        finally:
            con.close()
    except sqlite3.Error:
        pass
    when = datetime.strptime(m.group(1)[:15], "%Y%m%d-%H%M%S")
    return {"name": f.name, "reason": m.group(2), "created": when.strftime("%Y-%m-%d %H:%M:%S"),
            "size": f.stat().st_size, "counts": counts}


def list_backups():
    if not BACKUP_DIR.exists():
        return []
    return [backup_info(f) for f in sorted(BACKUP_DIR.glob("herbgarden-*.db"), reverse=True)
            if BACKUP_RE.fullmatch(f.name)]


def backup_path(name: str) -> Path:
    if not BACKUP_RE.fullmatch(name or "") or not (BACKUP_DIR / name).is_file():
        raise ApiError(404, "ไม่พบไฟล์สำรองนี้")
    return BACKUP_DIR / name


def restore_backup(name: str):
    path = backup_path(name)
    safety = make_backup("before-restore")      # สำรองข้อมูลปัจจุบันไว้ก่อน เผื่ออยากย้อนกลับ
    keep = [tuple(r.values()) for r in rows("SELECT token_hash, expires, remember FROM sessions")]
    with BACKUP_LOCK:
        src, dst = sqlite3.connect(path), sqlite3.connect(DB_PATH)
        try:
            src.backup(dst)
        finally:
            dst.close(); src.close()
    init_db()                                    # สำรองรุ่นเก่า: เติมคอลัมน์/ตารางที่ขาด
    with db() as con:                            # คงการเข้าสู่ระบบปัจจุบันไว้ (ไม่ใช้ของในไฟล์สำรอง)
        con.execute("DELETE FROM sessions")
        con.executemany("INSERT INTO sessions(token_hash, expires, remember) VALUES(?,?,?)", keep)
    return safety


def maintenance_loop():
    """ทำงานเบื้องหลัง: สำรองอัตโนมัติวันละครั้ง + ล้างถังขยะที่เกิน 30 วัน"""
    while True:
        try:
            if time.time() - HEALTH["checked"] > 23 * 3600:
                check_integrity()
            last_auto = next((b for b in list_backups() if b["reason"] == "auto"), None)
            if not last_auto or datetime.now() - datetime.fromisoformat(last_auto["created"]) > timedelta(hours=23):
                make_backup("auto")
            purge_trash()
            with db() as con:   # ลบการเข้าสู่ระบบที่หมดอายุ
                con.execute("DELETE FROM sessions WHERE expires < ?", (time.time(),))
        except Exception:  # noqa: BLE001
            log_error("งานเบื้องหลัง (สำรองข้อมูล/ล้างถังขยะ) ผิดพลาด")
        time.sleep(3600)


class FileResult:
    def __init__(self, path: Path):
        self.path = path


# ---------------------------------------------------------------- กันเดารหัส / กันสแปม
LOGIN_MAX, LOGIN_WINDOW, LOGIN_LOCK = 5, 15 * 60, 15 * 60     # ผิด 5 ครั้งใน 15 นาที → ล็อก 15 นาที
CONTACT_LIMITS = [(3, 10 * 60), (10, 24 * 3600)]               # ไม่เกิน 3 ข้อความ/10 นาที และ 10 ข้อความ/วัน ต่อเครื่อง
LOGIN_FAILS: dict[str, list[float]] = {}
CONTACT_LOG: dict[str, list[float]] = {}
GUARD_LOCK = threading.Lock()


def recent(log: dict, key: str, window: float) -> list[float]:
    now = time.time()
    log[key] = [t for t in log.get(key, []) if now - t < window]
    return log[key]


# ---------------------------------------------------------------- แจ้งเตือนข้อความใหม่ (อีเมล / LINE)
NOTIFY_DEFAULTS = {
    "site_url": "http://localhost:8000",
    "email_on": False, "smtp_host": "smtp.gmail.com", "smtp_port": 587,
    "smtp_user": "", "smtp_pass": "", "email_to": "",
    "line_on": False, "line_token": "", "line_to": "",
}
SECRET_KEYS = ("smtp_pass", "line_token")
NOTIFY_LOCK = threading.Lock()


def load_notify() -> dict:
    cfg = dict(NOTIFY_DEFAULTS)
    try:
        cfg.update(json.loads(NOTIFY_FILE.read_text(encoding="utf-8")))
    except (OSError, ValueError):
        pass
    return cfg


def notify_for_admin() -> dict:
    """ค่าที่ส่งให้หน้าแอดมิน: ไม่ส่งรหัส/โทเคนกลับไป บอกแค่ว่าตั้งไว้แล้วหรือยัง"""
    cfg = load_notify()
    out = {k: v for k, v in cfg.items() if k not in SECRET_KEYS}
    out.update({f"has_{k}": bool(cfg[k]) for k in SECRET_KEYS})
    return out


def save_notify(d: dict) -> dict:
    with NOTIFY_LOCK:
        cfg = load_notify()
        for k, default in NOTIFY_DEFAULTS.items():
            if k not in d:
                continue
            v = d[k]
            if k in SECRET_KEYS:
                if str(v).strip():               # ช่องรหัสว่าง = ใช้ค่าเดิม
                    cfg[k] = str(v).strip()
            elif isinstance(default, bool):
                cfg[k] = bool(v) and v not in ("0", "false")
            elif isinstance(default, int):
                cfg[k] = int(v) if str(v).isdigit() else default
            else:
                cfg[k] = str(v).strip()
        for k in SECRET_KEYS:                    # ล้างค่าที่บันทึกไว้
            if d.get(f"clear_{k}"):
                cfg[k] = ""
        NOTIFY_FILE.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    return notify_for_admin()


def send_email(cfg, subject, text, reply_to=""):
    if not (cfg["smtp_host"] and cfg["smtp_user"] and cfg["smtp_pass"] and cfg["email_to"]):
        raise RuntimeError("ตั้งค่าอีเมลยังไม่ครบ (เซิร์ฟเวอร์, บัญชี, รหัสผ่านแอป, อีเมลผู้รับ)")
    msg = EmailMessage()
    msg["Subject"], msg["From"] = subject, cfg["smtp_user"]
    msg["To"] = ", ".join(a.strip() for a in re.split(r"[,;\s]+", cfg["email_to"]) if a.strip())
    if reply_to and re.fullmatch(r"[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+", reply_to):
        msg["Reply-To"] = reply_to
    msg.set_content(text)
    ctx = ssl.create_default_context()
    port = int(cfg["smtp_port"])
    if port == 465:
        with smtplib.SMTP_SSL(cfg["smtp_host"], port, timeout=20, context=ctx) as s:
            s.login(cfg["smtp_user"], cfg["smtp_pass"]); s.send_message(msg)
    else:
        with smtplib.SMTP(cfg["smtp_host"], port, timeout=20) as s:
            s.starttls(context=ctx); s.login(cfg["smtp_user"], cfg["smtp_pass"]); s.send_message(msg)


def send_line(cfg, text):
    if not (cfg["line_token"] and cfg["line_to"]):
        raise RuntimeError("ตั้งค่า LINE ยังไม่ครบ (Channel access token และ User ID/Group ID)")
    body = json.dumps({"to": cfg["line_to"], "messages": [{"type": "text", "text": text[:4900]}]}).encode()
    req = urllib.request.Request("https://api.line.me/v2/bot/message/push", data=body, method="POST",
                                 headers={"Content-Type": "application/json",
                                          "Authorization": "Bearer " + cfg["line_token"]})
    try:
        with urllib.request.urlopen(req, timeout=20):
            pass
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:200]
        raise RuntimeError(f"LINE ตอบกลับ {e.code}: {detail}")


def message_text(m: dict, cfg) -> str:
    return (f"มีข้อความใหม่จากเว็บสวนสมุนไพร\n\n"
            f"ชื่อ: {m['name']}\nโทร: {m['phone']}\n" + (f"อีเมล: {m['email']}\n" if m.get("email") else "") +
            f"หัวข้อ: {m.get('topic') or '-'}\n\n{m.get('detail') or '(ไม่มีรายละเอียด)'}\n\n"
            f"ดู/ตอบที่หน้าแอดมิน: {cfg['site_url'].rstrip('/')}/admin.html")


def notify_new_message(m: dict):
    """ส่งแจ้งเตือนเบื้องหลัง — ส่งไม่สำเร็จจะไม่กระทบการบันทึกข้อความ (ข้อความยังอยู่ในหน้าแอดมิน)"""
    cfg = load_notify()
    text = message_text(m, cfg)
    if cfg["email_on"]:
        try:
            send_email(cfg, f"ข้อความใหม่: {m.get('topic') or 'ติดต่อเรา'} — {m['name']}", text, m.get("email", ""))
        except Exception as e:  # noqa: BLE001
            LOG.warning("ส่งแจ้งเตือนทางอีเมลไม่สำเร็จ: %r", e)
    if cfg["line_on"]:
        try:
            send_line(cfg, text)
        except Exception as e:  # noqa: BLE001
            LOG.warning("ส่งแจ้งเตือนทาง LINE ไม่สำเร็จ: %r", e)


def test_notify(channel: str) -> dict:
    cfg = load_notify()
    sample = {"name": "ทดสอบระบบ", "phone": "000-000-0000", "email": "", "topic": "ทดสอบการแจ้งเตือน",
              "detail": "ถ้าเห็นข้อความนี้ แปลว่าการแจ้งเตือนทำงานแล้ว"}
    try:
        if channel == "email":
            send_email(cfg, "ทดสอบการแจ้งเตือน — เว็บสวนสมุนไพร", message_text(sample, cfg))
        elif channel == "line":
            send_line(cfg, message_text(sample, cfg))
        else:
            raise RuntimeError("ไม่รู้จักช่องทางนี้")
        return {"ok": True}
    except smtplib.SMTPAuthenticationError:
        return {"ok": False, "error": "เข้าสู่ระบบอีเมลไม่ได้ — ตรวจชื่อบัญชีและรหัสผ่านแอป (Gmail ต้องใช้ App Password ไม่ใช่รหัสปกติ)"}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e) or repr(e)}


# ---------------------------------------------------------------- ลิงก์จริงของแต่ละหน้า + ข้อมูลสำหรับแชร์ (Facebook/LINE/Google)
SITE_NAME = "สวนสมุนไพรสมเด็จพระเทพฯ"
SITE_FULL = "สวนสมุนไพรสมเด็จพระเทพรัตนราชสุดาฯ สยามบรมราชกุมารี"
SITE_DESC = "มิติการเรียนรู้ด้านสมุนไพรไทย แหล่งรวบรวมพันธุ์สมุนไพรมากกว่า 509 ชนิด บนเนื้อที่ 60 ไร่"
DEFAULT_IMG = "images/og-default.jpg"   # การ์ดสำหรับแชร์ลิงก์ (1200x630) — ใช้เมื่อหน้านั้นไม่มีรูป
STATIC_PAGES = {   # path → (ชื่อหน้า, คำอธิบาย)
    "/herb/search": ("ค้นหาสมุนไพร", "ค้นหาข้อมูลสมุนไพรในสวน ตามชื่อ สรรพคุณ กลุ่มสมุนไพร และพันธุ์ไม้มงคลประจำจังหวัด"),
    "/herb/articles": ("บทความสมุนไพร", "บทความความรู้เรื่องสมุนไพรไทย"),
    "/herb/map": ("แผนผังสวนสมุนไพร", "แผนผังและจุดต่าง ๆ ภายในสวนสมุนไพร"),
    "/news": ("ข่าวประชาสัมพันธ์", "ข่าวสารและกิจกรรมล่าสุดของสวนสมุนไพร"),
    "/brochure": ("โบรชัวร์", "ดาวน์โหลดโบรชัวร์และแผ่นพับของสวนสมุนไพร"),
    "/activities": ("โครงการและกิจกรรม", "โครงการและกิจกรรมของสวนสมุนไพร เช่น Wellness, Sport Complex, ตลาดนัดชุมชน, อพ.สธ. และ Workshop"),
    "/calendar": ("ปฏิทินกิจกรรม", "ปฏิทินกิจกรรม ตลาดนัด และวันปิดทำการของสวนสมุนไพร"),
    "/contact": ("ติดต่อเรา", "ที่อยู่ เบอร์โทร เวลาทำการ และแบบฟอร์มติดต่อสวนสมุนไพร"),
}
DETAIL_ROUTES = [   # (รูปแบบลิงก์, ตาราง, คอลัมน์ชื่อ, คอลัมน์คำอธิบาย, หมวด)
    (re.compile(r"/news/(\d+)"), "news", "title", "detail", "ข่าวประชาสัมพันธ์"),
    (re.compile(r"/herb/article/(\d+)"), "articles", "title", "excerpt||' '||body", "บทความสมุนไพร"),
    (re.compile(r"/activity/(\d+)"), "activities", "title", "excerpt||' '||body", "โครงการและกิจกรรม"),
    (re.compile(r"/herb/plant/(\d+)"), "herbs", "th", "en||' '||sci||' — '||uses||' '||detail", "ค้นหาสมุนไพร"),
]


def plain(s: str, n: int = 160) -> str:
    """ตัด HTML/เครื่องหมายจัดรูปแบบออก เหลือข้อความสั้น ๆ สำหรับคำอธิบาย"""
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = re.sub(r"(^|\n)\s*(##|-)\s+", " ", s)
    s = re.sub(r"\s+", " ", s).strip(" —")
    return s if len(s) <= n else s[:n - 1].rstrip() + "…"


def page_meta(path: str):
    """ข้อมูลของหน้า (ชื่อ, คำอธิบาย, รูป) หรือ None ถ้าไม่มีหน้านี้"""
    if path == "/":
        return {"title": SITE_FULL, "desc": SITE_DESC, "img": DEFAULT_IMG, "home": True}
    if path in STATIC_PAGES:
        t, d = STATIC_PAGES[path]
        return {"title": t, "desc": d, "img": DEFAULT_IMG}
    pg = rows("SELECT title, body, img FROM pages WHERE key=?", (path,))
    if pg:
        return {"title": pg[0]["title"], "desc": plain(pg[0]["body"]) or SITE_DESC, "img": pg[0]["img"] or DEFAULT_IMG}
    for rx, table, tcol, dcol, _ in DETAIL_ROUTES:
        m = rx.fullmatch(path)
        if m:
            r = rows(f"SELECT {tcol} AS t, {dcol} AS d, img FROM {table} WHERE id=? AND {LIVE}", (m.group(1),))
            if not r:
                return None
            return {"title": r[0]["t"].replace("\n", " "), "desc": plain(r[0]["d"]) or SITE_DESC,
                    "img": r[0]["img"] or DEFAULT_IMG}
    return None


def sitemap_paths() -> list[str]:
    paths = ["/", *STATIC_PAGES, *(r["key"] for r in rows("SELECT key FROM pages"))]
    for rx, table, *_ in DETAIL_ROUTES:
        prefix = rx.pattern.split("(")[0]
        paths += [f"{prefix}{r['id']}" for r in rows(f"SELECT id FROM {table} WHERE {LIVE} ORDER BY id")]
    return paths


# ---------------------------------------------------------------- ตรวจความพร้อมของเว็บ
IMG_RE = re.compile(r"images/[\w\-./ก-๙]+\.(?:jpg|jpeg|png|webp|gif|svg)", re.I)
SAMPLE_WORDS = ("เนื้อหาตัวอย่าง", "(ตัวอย่าง)", "บทความตัวอย่าง", "ข้อมูลจำลอง", "พืชจำลอง")


def file_ok(p: str) -> bool:
    return not p or p.startswith(("http://", "https://", "data:")) or (ROOT / p).is_file()


def readiness():
    sections = []

    # 1) รูปภาพ: รูปประจำหน้าเว็บ (อยู่ในโค้ด) + รูปของแต่ละรายการในฐานข้อมูล
    code_imgs = set()
    for f in [ROOT / "index.html", *sorted((ROOT / "js").glob("*.js"))]:
        if f.name in ("admin.js", "api.js"):
            continue
        if f.name == "data.js":   # ข้อมูลสำรอง (ของจริงอยู่ในฐานข้อมูล)
            continue
        txt = f.read_text(encoding="utf-8")
        txt = re.sub(r"const ACTIVITIES = \[.*?\n\];", "", txt, flags=re.S)   # ข้อมูลสำรองของกิจกรรม
        code_imgs |= set(IMG_RE.findall(txt))
    missing = [{"text": f"รูปประจำหน้าเว็บ → วางไฟล์ชื่อ {p}", "file": p} for p in sorted(code_imgs) if not file_ok(p)]
    for t, col, tab in (("news", "title", "news"), ("articles", "title", "articles"),
                        ("workshops", "name", "workshops"), ("activities", "title", "activities"),
                        ("services", "title", "services"), ("pages", "title", "pages")):
        where = "" if t == "pages" else f"WHERE {LIVE}"
        for r in rows(f"SELECT {col} AS n, img FROM {t} {where}"):
            n = r["n"].replace("\n", " ")
            if r["img"] and not file_ok(r["img"]):
                missing.append({"text": f"{n} → ไม่พบไฟล์ {r['img']}", "file": r["img"], "tab": tab})
            elif not r["img"] and t != "pages":
                missing.append({"text": f"{n} → ยังไม่ได้ใส่รูป", "tab": tab})
    sections.append({"title": "รูปภาพที่ยังไม่มี", "level": "red", "items": missing,
                     "hint": "วางไฟล์ตามชื่อที่ระบุในโฟลเดอร์ images/ ของเว็บ หรือกดแก้ไขรายการแล้วอัปโหลดรูปใหม่"})

    # 2) ข้อความตัวอย่างที่ยังไม่ได้แก้
    sample = [{"text": f"หน้า \"{p['title']}\" ยังเป็นข้อความตัวอย่าง", "tab": "pages"}
              for p in rows("SELECT title FROM pages WHERE is_sample=1")]
    like = " OR ".join(["{c} LIKE ?"] * len(SAMPLE_WORDS))
    args = tuple(f"%{w}%" for w in SAMPLE_WORDS)
    for t, cols, label, tab in (("news", ("title", "detail"), "ข่าว", "news"),
                                ("articles", ("title", "excerpt", "body"), "บทความ", "articles"),
                                ("workshops", ("name", "detail"), "Workshop", "workshops"),
                                ("activities", ("title", "excerpt", "body"), "กิจกรรม", "activities")):
        cond = " OR ".join("(" + like.format(c=c) + ")" for c in cols)
        for r in rows(f"SELECT {cols[0]} AS n FROM {t} WHERE {LIVE} AND ({cond})", args * len(cols)):
            sample.append({"text": f"{label} \"{r['n']}\" มีข้อความตัวอย่าง", "tab": tab})
    fake = rows(f"SELECT COUNT(*) AS n FROM herbs WHERE {LIVE} AND ({like.format(c='th')} OR {like.format(c='detail')})",
                args * 2)[0]["n"]
    if fake:
        sample.append({"text": f"สมุนไพร {fake} ชนิดเป็นข้อมูลจำลอง/ตัวอย่าง — นำเข้าข้อมูลจริงด้วยโหมด \"แทนที่ทั้งหมด\"", "tab": "herbs"})
    try:   # แผนผังสวน: กลุ่มที่ยังไม่มีข้อมูล (แก้ในไฟล์ js/garden-map.js)
        gm = (ROOT / "js" / "garden-map.js").read_text(encoding="utf-8")
        pending = re.findall(r"\{ n:(\d+)[^}]*\}", gm.split("].map")[0].split("รอใส่ข้อมูล) ---- */")[-1])
        pending = [n for n in pending if not re.search(rf"n:{n},[^}}]*\bt:", gm)]
        if "รอใส่ชื่อกลุ่ม" in gm and pending:
            sample.append({"text": f"แผนผังสวน: กลุ่มที่ {pending[0]}–{pending[-1]} ยังไม่มีชื่อกลุ่มและรายชื่อพืช "
                                   f"(ต้องใช้ข้อมูลจากสวน แก้ในไฟล์ js/garden-map.js)"})
    except OSError:
        pass
    sections.append({"title": "ข้อความตัวอย่างที่ยังไม่ได้แก้", "level": "red", "items": sample})

    # 3) ข้อมูลที่ยังไม่ครบ
    incomplete = []
    total = rows(f"SELECT COUNT(*) AS n FROM herbs WHERE {LIVE}")[0]["n"]
    for col, label in (("img", "ยังไม่มีรูป"), ("uses", "ยังไม่มีสรรพคุณ"), ("detail", "ยังไม่มีลักษณะทั่วไป"),
                       ("sci", "ยังไม่มีชื่อวิทยาศาสตร์")):
        n = rows(f"SELECT COUNT(*) AS n FROM herbs WHERE {LIVE} AND {col}=''")[0]["n"]
        if n:
            incomplete.append({"text": f"สมุนไพร {n} จาก {total} ชนิด{label}", "tab": "herbs"})
    for r in rows(f"SELECT title FROM brochures WHERE {LIVE} AND file=''"):
        incomplete.append({"text": f"โบรชัวร์ \"{r['title']}\" ยังไม่มีไฟล์ PDF", "tab": "brochures"})
    for r in rows(f"SELECT title, file FROM brochures WHERE {LIVE} AND file!=''"):
        if not file_ok(r["file"]):
            incomplete.append({"text": f"โบรชัวร์ \"{r['title']}\" → ไม่พบไฟล์ {r['file']}", "tab": "brochures"})
    ncfg = load_notify()
    if not (ncfg["email_on"] or ncfg["line_on"]):
        incomplete.append({"text": "ยังไม่ได้ตั้งค่าแจ้งเตือนเมื่อมีคนส่งข้อความ (อีเมล/LINE)", "tab": "notify"})
    sections.append({"title": "ข้อมูลที่ยังไม่ครบ", "level": "amber", "items": incomplete})

    # 4) ความปลอดภัย
    sec = []
    if password_source() == "default":
        sec.append({"text": "ยังใช้รหัสแอดมินเริ่มต้น admin1234 — เปลี่ยนได้ที่แท็บ ⚙️ ตั้งค่าเว็บไซต์", "tab": "settings"})
    for f in ROOT.iterdir():
        if f.is_file() and f.suffix.lower() in (".txt", ".xlsx", ".csv", ".docx") :
            sec.append({"text": f"มีไฟล์ \"{f.name}\" ในโฟลเดอร์เว็บ — ระบบไม่เปิดให้ดาวน์โหลดแล้ว แต่ควรย้ายไปเก็บที่อื่นก่อนนำเว็บขึ้นโฮสต์"})
    if DEMO_MODE:
        sec.append({"text": "เปิดโหมดเว็บไซต์ทดลองอยู่ (แถบ \"เว็บไซต์ทดลอง\" + ห้าม Google เก็บเว็บ) — "
                            "ถ้าจะใช้เป็นเว็บจริง ให้เปิดเซิร์ฟเวอร์ด้วย DEMO_MODE=0"})
    sections.append({"title": "ความปลอดภัย", "level": "amber", "items": sec})

    # 5) ความเสถียรของระบบ
    stab = []
    if HEALTH["integrity"] not in ("ok", "ยังไม่ได้ตรวจ"):
        stab.append({"text": f"ไฟล์ฐานข้อมูลมีปัญหา ({HEALTH['integrity'][:80]}) — ควรกู้คืนจากไฟล์สำรองล่าสุด", "tab": "backups"})
    autos = [b for b in list_backups() if b["reason"] == "auto"]
    if not autos:
        stab.append({"text": "ยังไม่มีไฟล์สำรองอัตโนมัติ", "tab": "backups"})
    else:
        age = (datetime.now() - datetime.fromisoformat(autos[0]["created"])).total_seconds() / 3600
        if age > 48:
            stab.append({"text": f"ไม่ได้สำรองข้อมูลอัตโนมัติมา {int(age // 24)} วัน — เซิร์ฟเวอร์อาจไม่ได้เปิดค้างไว้", "tab": "backups"})
    recent_err = sum(1 for t in ERRORS if time.time() - t < 86400)
    if recent_err:
        stab.append({"text": f"เซิร์ฟเวอร์เกิดข้อผิดพลาด {recent_err} ครั้งใน 24 ชั่วโมง — ดูรายละเอียดในไฟล์ server/logs/server.log"})
    sections.append({"title": "ความเสถียรของระบบ", "level": "amber", "items": stab})
    return sections


# ตารางที่แอดมินแก้ได้ และฟิลด์ที่อนุญาต
RESOURCES = {
    "news": {"fields": ["title", "type", "detail", "img", "title_en", "detail_en"], "required": ["title"]},
    "articles": {"fields": ["date", "title", "excerpt", "img", "body", "title_en", "excerpt_en", "body_en"],
                 "required": ["title"]},
    "workshops": {"fields": ["name", "detail", "img"], "required": ["name"]},
    "brochures": {"fields": ["title", "type", "file"], "required": ["title"]},
    "herbs": {"fields": ["th", "en", "sci", "detail", "uses", "groups", "province", "img", "status", "img_credit",
                         "other_names", "verse", "verse_src", "detail_en", "uses_en"],
              "required": ["th"]},
    "activities": {"fields": ["type", "date", "title", "excerpt", "img", "contain", "body"], "required": ["title", "date"]},
    "services": {"fields": ["title", "img", "link", "sort"], "required": ["title"]},
    "events": {"fields": ["kind", "date", "end_date", "title", "detail", "link"], "required": ["title", "date"]},
    "map_spots": {"fields": ["kind", "num", "icon", "title", "detail", "x", "y"], "required": ["title"]},
}
DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")
ORDER = {"activities": "date DESC, id DESC", "services": "sort, id", "events": "date DESC, id DESC",
         "map_spots": "kind, num, id"}


def norm_map_spot(vals: dict) -> dict:
    """ตรวจข้อมูลจุดบนแผนผังสวน — ตำแหน่ง x, y ต้องเป็นตัวเลข 0–100 (หรือเว้นว่างทั้งคู่ = ไม่มีหมุด)"""
    if vals["kind"] not in MAP_KINDS:
        raise ApiError(400, "ประเภทไม่ถูกต้อง")
    vals["num"] = int(vals["num"]) if vals["num"].isdigit() else 0
    if vals["kind"] == "group":
        vals["icon"] = ""
        if vals["num"] < 1:
            raise ApiError(400, "กรุณาใส่เลขกลุ่ม")
    elif vals["icon"] not in MAP_ICONS and not re.fullmatch(r"[A-Za-z0-9ก-๙]", vals["icon"]):
        raise ApiError(400, "ไอคอนไม่ถูกต้อง — เลือกจากรายการ หรือใส่ตัวอักษร/ตัวเลข 1 ตัว")
    for k in ("x", "y"):
        if vals[k]:
            try:
                v = float(vals[k])
            except ValueError:
                raise ApiError(400, f"ตำแหน่ง {k} ต้องเป็นตัวเลข")
            if not 0 <= v <= 100:
                raise ApiError(400, f"ตำแหน่ง {k} ต้องอยู่ระหว่าง 0–100")
            vals[k] = f"{v:g}"
    if bool(vals["x"]) != bool(vals["y"]):
        raise ApiError(400, "ใส่ตำแหน่ง x และ y ให้ครบทั้งคู่ (หรือเว้นว่างทั้งคู่ถ้าไม่ต้องการหมุด)")
    return vals


def get_settings():
    s = dict(DEFAULT_SETTINGS)
    s.update({r["key"]: r["value"] for r in rows("SELECT key, value FROM settings")})
    s["demo"] = "1" if DEMO_MODE else "0"   # มาจากการตั้งค่าเซิร์ฟเวอร์ ไม่ได้เก็บในฐานข้อมูล
    return s

# สถานะการอนุรักษ์ (ต้องตรงกับ CONSERVATION ใน js/data.js) — ค่าว่าง = ปกติ
CONSERVATION = ["หายาก", "ใกล้สูญพันธุ์", "ใกล้สูญพันธุ์อย่างยิ่ง"]


def norm_status(s: str) -> str:
    s = re.sub(r"\s+", "", s or "")
    return "" if s in ("", "ปกติ", "-") else s


# ---------------------------------------------------------------- provinces (อ่านจาก js/data.js ที่เดียว)
def load_provinces():
    try:
        txt = (ROOT / "js" / "data.js").read_text(encoding="utf-8")
        m = re.search(r"const\s+PROVINCES\s*=\s*(\{.*?\});", txt, re.S)
        return json.loads(m.group(1)) if m else {}
    except (OSError, ValueError):
        return {}


PROVINCE_REGION = {p: r for r, ps in load_provinces().items() for p in ps}


def norm_groups(s: str) -> str:
    return ", ".join(g for g in (x.strip() for x in re.split(r"[,;|\n]", s or "")) if g)


# ---------------------------------------------------------------- herb import (Excel .xlsx / CSV)
HERB_COLUMNS = {   # ชื่อหัวคอลัมน์ที่ยอมรับ (เทียบแบบไม่สนช่องว่าง/วงเล็บ/ตัวพิมพ์)
    "th": ["ชื่อภาษาไทย", "ชื่อไทย", "ชื่อสมุนไพร", "th"],
    "en": ["ชื่อภาษาอังกฤษ", "ชื่ออังกฤษ", "en"],
    "sci": ["ชื่อวิทยาศาสตร์", "sci"],
    "detail": ["ลักษณะทั่วไป", "ลักษณะ", "detail"],
    "uses": ["สรรพคุณ", "uses"],
    "groups": ["กลุ่มสมุนไพร", "กลุ่ม", "groups"],
    "province": ["จังหวัด", "พันธุ์ไม้มงคลประจำจังหวัด", "province"],
    "img": ["รูปภาพ", "รูป", "img", "image"],
    "status": ["สถานะการอนุรักษ์", "สถานะ", "status"],
    "img_credit": ["เครดิตรูป", "เครดิตภาพ", "ที่มาของรูป", "img_credit"],
    "other_names": ["ชื่ออื่น", "ชื่อเรียกอื่น", "other_names"],
    "verse": ["กลอน", "บทกลอน", "กลอนบนป้าย", "verse"],
    "verse_src": ["ที่มาของกลอน", "ที่มากลอน", "verse_src"],
    "detail_en": ["ลักษณะทั่วไป ภาษาอังกฤษ", "ลักษณะทั่วไป อังกฤษ", "detail_en"],
    "uses_en": ["สรรพคุณ ภาษาอังกฤษ", "สรรพคุณ อังกฤษ", "uses_en"],
}


def _norm_header(h: str) -> str:
    return re.sub(r"\(.*?\)|\s|\*", "", str(h or "")).lower()


HEADER_LOOKUP = {_norm_header(a): k for k, al in HERB_COLUMNS.items() for a in al}


def parse_xlsx(raw: bytes) -> list[list[str]]:
    ns = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    rns = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        if sum(i.file_size for i in z.infolist()) > 100 * 1024 * 1024:
            raise ApiError(400, "ไฟล์ Excel ใหญ่เกินไป")
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(f"{ns}si"):
                shared.append("".join(t.text or "" for t in si.findall(f"{ns}t") + si.findall(f"{ns}r/{ns}t")))
        # หา sheet แรกของไฟล์
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        rid = wb.find(f"{ns}sheets/{ns}sheet").get(f"{rns}id")
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        target = next(r.get("Target") for r in rels if r.get("Id") == rid)
        path = target.lstrip("/") if target.startswith("/") else "xl/" + target
        sheet = ET.fromstring(z.read(path))
    out = []
    for row in sheet.iter(f"{ns}row"):
        cells = {}
        for c in row.findall(f"{ns}c"):
            col = 0
            for ch in re.match(r"[A-Z]+", c.get("r", "A")).group(0):
                col = col * 26 + ord(ch) - 64
            t, v = c.get("t"), c.find(f"{ns}v")
            if t == "s" and v is not None:
                val = shared[int(v.text)]
            elif t == "inlineStr":
                val = "".join(x.text or "" for x in c.iter(f"{ns}t"))
            else:
                val = v.text if v is not None and v.text else ""
                if re.fullmatch(r"-?\d+\.0", val):
                    val = val[:-2]
            cells[col - 1] = val
        if cells:
            out.append([cells.get(i, "") for i in range(max(cells) + 1)])
    return out


def parse_table(raw: bytes) -> list[list[str]]:
    if raw[:2] == b"PK":
        try:
            return parse_xlsx(raw)
        except ApiError:
            raise
        except Exception:
            raise ApiError(400, "อ่านไฟล์ Excel ไม่ได้ — ลองบันทึกเป็น .xlsx หรือ CSV UTF-8 ใหม่")
    if raw[:4] == b"\xd0\xcf\x11\xe0":
        raise ApiError(400, "ไฟล์ .xls แบบเก่ายังไม่รองรับ — ใน Excel กด Save As แล้วเลือก .xlsx")
    for enc in ("utf-8-sig", "cp874"):          # Excel ไทยมักบันทึก CSV เป็น cp874
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ApiError(400, "อ่านภาษาไทยในไฟล์ไม่ได้ — ใน Excel ให้บันทึกเป็น CSV UTF-8")
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    return list(csv.reader(io.StringIO(text), dialect))


# เดาคอลัมน์จากคำในหัวตาราง (ใช้เมื่อชื่อไม่ตรงแม่แบบ) — เรียงลำดับสำคัญ: เช็ก sci ก่อน th
FUZZY_HEADERS = [
    ("sci", ["วิทยาศาสตร์", "scientific"]),
    ("en", ["อังกฤษ", "english"]),
    ("uses", ["สรรพคุณ", "ประโยชน์", "การใช้"]),
    ("detail", ["ลักษณะ", "รายละเอียด", "description"]),
    ("province", ["จังหวัด", "province"]),
    ("img_credit", ["เครดิต", "credit", "ที่มาของรูป"]),
    ("verse_src", ["ที่มาของกลอน", "ที่มากลอน"]),
    ("verse", ["กลอน", "verse", "poem"]),
    ("other_names", ["ชื่ออื่น", "ชื่อเรียกอื่น"]),
    ("img", ["รูป", "image", "photo"]),
    ("status", ["อนุรักษ์", "สถานะ", "สูญพันธุ์", "หายาก", "status"]),
    ("groups", ["กลุ่ม", "หมวด", "ประเภท", "group", "category"]),
    ("th", ["ชื่อไทย", "ชื่อภาษาไทย", "ชื่อพืช", "ชื่อสมุนไพร", "ชื่อท้องถิ่น", "ชื่อสามัญ", "ชื่อ", "name"]),
]


def auto_map(header):
    colmap = {}
    for i, h in enumerate(header):            # 1) ชื่อตรงแม่แบบ
        key = HEADER_LOOKUP.get(_norm_header(h))
        if key and key not in colmap:
            colmap[key] = i
    for i, h in enumerate(header):            # 2) เดาจากคำที่มีในหัวตาราง
        n = _norm_header(h)
        if not n or i in colmap.values():
            continue
        for key, words in FUZZY_HEADERS:
            if key not in colmap and any(w in n for w in words):
                colmap[key] = i
                break
    return colmap


def find_header(table):
    """หาแถวหัวตาราง: แถวที่จับคู่คอลัมน์ได้มากที่สุดใน 20 แถวแรก (ข้ามแถวชื่อเรื่องด้านบน)"""
    best, best_score = 0, -1
    for i, r in enumerate(table[:20]):
        filled = sum(1 for c in r if str(c).strip())
        if filled < 2:
            continue
        score = len(auto_map(r)) * 10 + filled
        if score > best_score:
            best, best_score = i, score
    return best


def build_herb_rows(table, mapping=None, extra=False):
    table = [r for r in table if any(str(c).strip() for c in r)]
    if not table:
        raise ApiError(400, "ไฟล์ว่างเปล่า")
    hi = find_header(table)
    header = [str(h).strip() for h in table[hi]]
    if mapping is not None:                   # แอดมินเลือกเอง: {field: index หรือ -1}
        colmap = {k: int(v) for k, v in mapping.items()
                  if k in HERB_COLUMNS and str(v).lstrip("-").isdigit() and 0 <= int(v) < len(header)}
    else:
        colmap = auto_map(header)
    # คอลัมน์ "มีในสวน" (จากแบบฟอร์มที่ส่งให้สวนตรวจ): แถวที่ตอบ "ไม่มี" จะถูกข้าม ไม่นำเข้า
    have_col = next((i for i, h in enumerate(header) if "มีในสวน" in _norm_header(h)), None)
    used = set(colmap.values()) | ({have_col} if have_col is not None else set())
    extra_cols = [i for i, h in enumerate(header) if h and i not in used and "หมายเหตุ" not in h]
    meta = {"headers": header, "header_row": hi + 1, "mapping": colmap,
            "unknown_columns": [header[i] for i in extra_cols]}
    data_rows = table[hi + 1:]
    if len(data_rows) > 5000:
        raise ApiError(400, "นำเข้าได้ครั้งละไม่เกิน 5,000 แถว")
    if "th" not in colmap:                    # ยังไม่รู้ว่าคอลัมน์ไหนคือชื่อ → ให้แอดมินเลือก
        return [], sorted(colmap), meta
    items, seen = [], {}
    for n, r in enumerate(data_rows, start=hi + 2):
        cell = lambda i: str(r[i]).strip() if i < len(r) else ""
        d = {k: cell(i) for k, i in colmap.items()}
        d = {k: d.get(k, "") for k in HERB_COLUMNS}
        if extra:                             # คอลัมน์อื่น → ต่อท้ายลักษณะทั่วไป
            more = " · ".join(f"{header[i]}: {cell(i)}" for i in extra_cols if cell(i))
            d["detail"] = (d["detail"] + (" · " if d["detail"] and more else "") + more).strip()
        d["groups"] = norm_groups(d["groups"])
        d["status"] = norm_status(d["status"])
        errs = []
        if have_col is not None and cell(have_col).replace(" ", "").startswith("ไม่"):
            errs.append("สวนแจ้งว่าไม่มีในสวน — ไม่นำเข้า")
        if d["status"] and d["status"] not in CONSERVATION:
            errs.append(f"สถานะ \"{d['status']}\" ไม่ถูกต้อง (ใช้: ปกติ/เว้นว่าง, {', '.join(CONSERVATION)})")
        if not d["th"]:
            errs.append("ไม่มีชื่อภาษาไทย")
        if d["province"] and PROVINCE_REGION and d["province"] not in PROVINCE_REGION:
            errs.append(f"ไม่รู้จักจังหวัด \"{d['province']}\"")
        if d["th"] in seen:
            errs.append(f"ชื่อซ้ำกับแถวที่ {seen[d['th']]}")
        elif d["th"]:
            seen[d["th"]] = n
        items.append({"row": n, "data": d, "errors": errs})
    columns = sorted(set(colmap) | ({"detail"} if extra and extra_cols else set()))
    return items, columns, meta


class ApiError(Exception):
    def __init__(self, status, msg):
        super().__init__(msg)
        self.status, self.msg = status, msg


# ---------------------------------------------------------------- handler
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    # ----- helpers
    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BODY:
            raise ApiError(413, "ข้อมูลใหญ่เกินไป")
        try:
            data = json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            raise ApiError(400, "รูปแบบข้อมูลไม่ถูกต้อง")
        if not isinstance(data, dict):
            raise ApiError(400, "รูปแบบข้อมูลไม่ถูกต้อง")
        return data

    def bearer(self) -> str:
        auth = self.headers.get("Authorization", "")
        return auth[7:] if auth.startswith("Bearer ") else ""

    def require_admin(self):
        if not check_session(self.bearer()):
            raise ApiError(401, "หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่")

    def log_message(self, fmt, *args):  # log คำขอแบบสั้น (เฉพาะหน้าจอ ไม่ลงไฟล์ — ลดขนาด log)
        print(f"[{self.log_date_time_string()}] {self.command} {self.path} -> {args[1] if len(args) > 1 else ''}")

    # ----- static files: กันไม่ให้เปิดไฟล์ฐานข้อมูล/โค้ดฝั่งเซิร์ฟเวอร์
    def translate_path(self, path):
        parts = [p for p in unquote(urlparse(path).path).split("/") if p]
        if parts and (parts[0] in BLOCKED_DIRS or parts[0].startswith(".")):
            return str(ROOT / "__blocked__")
        full = super().translate_path(path)
        if not os.path.isdir(full) and Path(full).suffix.lower() not in PUBLIC_EXT:
            return str(ROOT / "__blocked__")
        return full

    def client_ip(self) -> str:
        """IP ของผู้ใช้ — ถ้าอยู่หลัง Caddy/Cloudflare (TRUST_PROXY=1) อ่านจาก header ที่ proxy ใส่ให้"""
        if TRUST_PROXY:
            ip = self.headers.get("CF-Connecting-IP") or (self.headers.get("X-Forwarded-For") or "").split(",")[0]
            if ip.strip():
                return ip.strip()
        return self.client_address[0]

    def end_headers(self):
        # ไฟล์หน้าเว็บ: ให้เบราว์เซอร์เช็กไฟล์ใหม่ทุกครั้ง (แก้โค้ดแล้วเห็นผลทันที ไม่ติด cache เก่า)
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        # header ความปลอดภัยพื้นฐาน
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        if DEMO_MODE:
            self.send_header("X-Robots-Tag", "noindex, nofollow")
        super().end_headers()

    def list_directory(self, path):  # ไม่แสดงรายชื่อไฟล์ในโฟลเดอร์
        self.send_error(404, "File not found")
        return None

    # ----- routing
    def do_GET(self):
        if self.path.startswith("/api/"):
            return self.api("GET")
        path = unquote(urlparse(self.path).path)
        if path == "/robots.txt":
            if DEMO_MODE:   # เว็บทดลอง: ห้ามเครื่องมือค้นหาเก็บทุกหน้า
                return self.send_text("# เว็บไซต์ทดลอง — ไม่ให้เครื่องมือค้นหาเก็บข้อมูล\nUser-agent: *\nDisallow: /\n", "text/plain")
            return self.send_text("User-agent: *\nDisallow: /admin.html\nDisallow: /api/\n"
                                  f"Sitemap: {self.base_url()}/sitemap.xml\n", "text/plain")
        if path == "/sitemap.xml":
            base = self.base_url()
            urls = "".join(f"<url><loc>{html_escape(base + quote(p))}</loc></url>" for p in sitemap_paths())
            return self.send_text('<?xml version="1.0" encoding="UTF-8"?>'
                                  f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>',
                                  "application/xml")
        # ลิงก์สั้นจาก QR ป้ายต้นไม้ (เช่น /P/514) → หน้าพืช /herb/plant/514
        mq = re.fullmatch(r"/[pP]/(\d+)/?", path)
        if mq:
            self.send_response(301)
            self.send_header("Location", f"/herb/plant/{mq.group(1)}")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        # หน้าเว็บ (ลิงก์ที่ไม่ใช่ไฟล์ เช่น /news/3) → ส่ง index.html พร้อมชื่อหน้า/รูปสำหรับแชร์
        first = path.strip("/").split("/")[0]
        if path in ("/", "/index.html") or (not Path(path).suffix and first not in BLOCKED_DIRS
                                             and not first.startswith(".")):
            return self.serve_app("/" if path == "/index.html" else (path.rstrip("/") or "/"))
        return super().do_GET()

    def base_url(self) -> str:
        host = (self.headers.get("X-Forwarded-Host") if TRUST_PROXY else None) or self.headers.get("Host") or "localhost"
        if not re.fullmatch(r"[\w.\-]+(:\d+)?", host):
            host = "localhost"
        proto = (self.headers.get("X-Forwarded-Proto") if TRUST_PROXY else None) or "http"
        return f"{'https' if proto == 'https' else 'http'}://{host}"

    def send_text(self, text: str, ctype: str, status: int = 200):
        body = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", f"{ctype}; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_app(self, path: str):
        meta = page_meta(path)
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        base = self.base_url()
        if meta:
            title = meta["title"] if meta.get("home") else f"{meta['title']} | {SITE_NAME}"
            desc, img = meta["desc"], meta["img"]
        else:
            title, desc, img = f"ไม่พบหน้านี้ | {SITE_NAME}", SITE_DESC, DEFAULT_IMG
        # รูปที่ตั้งไว้แต่ไม่มีไฟล์อยู่จริง → ใช้การ์ดแชร์แทน (ไม่ให้ LINE/Facebook ขึ้นรูปเสีย)
        if not img.startswith(("http://", "https://")) and not (ROOT / img.lstrip("/")).is_file():
            img = DEFAULT_IMG
        img_url = img if img.startswith(("http://", "https://")) else f"{base}/{quote(img.lstrip('/'))}"
        e = lambda s: html_escape(str(s), quote=True)
        og_size = ('<meta property="og:image:width" content="1200">\n'
                   '<meta property="og:image:height" content="630">\n') if img == DEFAULT_IMG else ''
        head = (f'<base href="/">\n<link rel="canonical" href="{e(base + quote(path))}">\n'
                f'<meta property="og:type" content="{"website" if meta and meta.get("home") else "article"}">\n'
                f'<meta property="og:site_name" content="{e(SITE_FULL)}">\n'
                f'<meta property="og:title" content="{e(meta["title"] if meta else title)}">\n'
                f'<meta property="og:description" content="{e(desc)}">\n'
                f'<meta property="og:url" content="{e(base + quote(path))}">\n'
                f'<meta property="og:image" content="{e(img_url)}">\n'
                + og_size +
                f'<meta property="og:image:alt" content="{e(meta["title"] if meta else SITE_NAME)}">\n'
                f'<meta property="og:locale" content="th_TH">\n'
                f'<meta name="twitter:card" content="summary_large_image">\n'
                + ('<meta name="robots" content="noindex, nofollow">\n' if DEMO_MODE or not meta else ''))
        html = re.sub(r"<title>.*?</title>", lambda _: f"<title>{e(title)}</title>", html, count=1, flags=re.S)
        html = re.sub(r'<meta name="description" content="[^"]*">',
                      lambda _: f'<meta name="description" content="{e(desc)}">', html, count=1)
        html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n' + head, 1)
        self.send_text(html, "text/html", 200 if meta else 404)

    def do_POST(self):
        self.api("POST")

    def do_PUT(self):
        self.api("PUT")

    def do_DELETE(self):
        self.api("DELETE")

    def api(self, method):
        path = urlparse(self.path).path.rstrip("/")
        try:
            result = self.route(method, path)
            if isinstance(result, FileResult):    # ดาวน์โหลดไฟล์สำรอง
                body = result.path.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "application/octet-stream")
                self.send_header("Content-Disposition", f'attachment; filename="{result.path.name}"')
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            self.send_json(result, 201 if method == "POST" else 200)
        except ApiError as e:
            self.send_json({"error": e.msg}, e.status)
        except Exception:  # noqa: BLE001
            log_error(f"{method} {path} ผิดพลาด")   # บันทึกรายละเอียด (traceback) ลง server/logs/server.log
            try:
                self.send_json({"error": "เกิดข้อผิดพลาดในเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง"}, 500)
            except OSError:
                pass

    def route(self, method, path):
        # --- ตรวจสุขภาพระบบ (สำหรับระบบเฝ้าดูเว็บ เช่น UptimeRobot) — 503 ถ้าฐานข้อมูลมีปัญหา
        if path == "/api/health" and method == "GET":
            try:
                rows("SELECT 1")
                db_ok = HEALTH["integrity"] in ("ok", "ยังไม่ได้ตรวจ")
            except sqlite3.Error:
                db_ok = False
            if not db_ok:
                raise ApiError(503, "database problem")
            return {"status": "ok", "version": APP_VERSION, "uptime_s": int(time.time() - STARTED)}
        # --- สาธารณะ
        if path == "/api/public" and method == "GET":
            return {
                "news": rows(f"SELECT * FROM news WHERE {LIVE} ORDER BY id DESC"),
                "articles": rows(f"SELECT * FROM articles WHERE {LIVE} ORDER BY id DESC"),
                "workshops": rows(f"SELECT * FROM workshops WHERE {LIVE} ORDER BY id DESC"),
                "brochures": rows(f"SELECT * FROM brochures WHERE {LIVE} ORDER BY id DESC"),
                "herbs": [{**h, "region": PROVINCE_REGION.get(h["province"], "")}
                          for h in rows(f"SELECT * FROM herbs WHERE {LIVE} ORDER BY id")],
                "pages": rows("SELECT key, title, body, img, title_en, body_en FROM pages"),
                "activities": rows(f"SELECT * FROM activities WHERE {LIVE} ORDER BY {ORDER['activities']}"),
                "services": rows(f"SELECT * FROM services WHERE {LIVE} ORDER BY {ORDER['services']}"),
                "events": rows(f"SELECT * FROM events WHERE {LIVE} ORDER BY date"),
                "map_spots": rows(f"SELECT id, kind, num, icon, title, detail, x, y FROM map_spots "
                                  f"WHERE {LIVE} ORDER BY {ORDER['map_spots']}"),
                "settings": get_settings(),
            }
        if path == "/api/login" and method == "POST":
            ip = self.client_ip()
            with GUARD_LOCK:
                fails = recent(LOGIN_FAILS, ip, LOGIN_WINDOW)
                if len(fails) >= LOGIN_MAX:
                    wait = math.ceil((LOGIN_LOCK - (time.time() - fails[-1])) / 60)
                    raise ApiError(429, f"ใส่รหัสผิดหลายครั้งเกินไป กรุณารอ {wait} นาทีแล้วลองใหม่")
            body = self.read_json()
            pw = str(body.get("password", ""))
            if not check_password(pw):
                time.sleep(0.5)
                with GUARD_LOCK:
                    fails = recent(LOGIN_FAILS, ip, LOGIN_WINDOW)
                    fails.append(time.time())
                    left = LOGIN_MAX - len(fails)
                LOG.warning("เข้าสู่ระบบแอดมินไม่สำเร็จ จาก %s (ลองได้อีก %d ครั้ง)", ip, max(left, 0))
                if left <= 0:
                    raise ApiError(429, f"ใส่รหัสผิด {LOGIN_MAX} ครั้ง ระบบล็อกการเข้าสู่ระบบไว้ {LOGIN_LOCK // 60} นาที")
                raise ApiError(401, f"รหัสผ่านไม่ถูกต้อง (ลองได้อีก {left} ครั้ง)")
            with GUARD_LOCK:
                LOGIN_FAILS.pop(ip, None)
            remember = bool(body.get("remember"))
            return {"token": create_session(remember), "remember": remember}
        if path == "/api/contact" and method == "POST":
            return self.contact(self.read_json())

        m = re.fullmatch(r"/api/(news|articles|workshops|brochures|herbs|activities|services|events|map_spots)(?:/(\d+))?", path)
        if m and method == "GET":
            name, rid = m.group(1), m.group(2)
            if rid:
                r = rows(f"SELECT * FROM {name} WHERE id=? AND {LIVE}", (rid,))
                if not r:
                    raise ApiError(404, "ไม่พบข้อมูล")
                return r[0]
            return rows(f"SELECT * FROM {name} WHERE {LIVE} ORDER BY {ORDER.get(name, 'id DESC')}")

        # --- ต้องล็อกอิน
        self.require_admin()
        if m:
            return self.crud(method, m.group(1), m.group(2))
        if path == "/api/herbs/import" and method == "POST":
            return self.import_herbs(self.read_json())
        if path == "/api/messages" and method == "GET":
            return rows(f"SELECT * FROM messages WHERE {LIVE} ORDER BY id DESC")
        mm = re.fullmatch(r"/api/messages/(\d+)", path)
        if mm and method == "PUT":
            with db() as con:
                con.execute(f"UPDATE messages SET is_read=? WHERE id=? AND {LIVE}",
                            (1 if self.read_json().get("is_read") else 0, mm.group(1)))
            return {"ok": True}
        if mm and method == "DELETE":
            ts = now_ts()
            with db() as con:
                con.execute(f"UPDATE messages SET deleted_at=? WHERE id=? AND {LIVE}", (ts, mm.group(1)))
            return {"ok": True, "type": "messages", "deleted_at": ts}

        # --- ถังขยะ
        if path == "/api/trash" and method == "GET":
            return trash_groups()
        if path in ("/api/trash/restore", "/api/trash/purge") and method == "POST":
            d = self.read_json()
            t, when = d.get("type"), str(d.get("deleted_at", ""))
            if t not in SOFT_TABLES or not when:
                raise ApiError(400, "ข้อมูลไม่ถูกต้อง")
            with db() as con:
                if path.endswith("restore"):
                    dup = 0
                    if t == "herbs":   # ชื่อซ้ำกับที่ใช้งานอยู่ตอนนี้ (เช่น นำเข้าใหม่ไปแล้ว)
                        dup = con.execute(f"SELECT COUNT(*) FROM herbs h WHERE deleted_at=? AND EXISTS "
                                          f"(SELECT 1 FROM herbs x WHERE x.th=h.th AND x.{LIVE})", (when,)).fetchone()[0]
                    n = con.execute(f"UPDATE {t} SET deleted_at=NULL WHERE deleted_at=?", (when,)).rowcount
                    return {"restored": n, "duplicates": dup}
                n = con.execute(f"DELETE FROM {t} WHERE deleted_at=?", (when,)).rowcount
                return {"purged": n}

        # --- สำรองข้อมูล
        if path == "/api/backups" and method == "GET":
            return list_backups()
        if path == "/api/backups" and method == "POST":
            return backup_info(BACKUP_DIR / make_backup("manual"))
        if path == "/api/backups/restore" and method == "POST":
            return {"ok": True, "safety_backup": restore_backup(str(self.read_json().get("name", "")))}
        mb = re.fullmatch(r"/api/backups/download/([\w.-]+)", path)
        if mb and method == "GET":
            return FileResult(backup_path(mb.group(1)))
        if path == "/api/upload" and method == "POST":
            return self.upload(self.read_json())

        # --- หน้าเนื้อหา (แก้ได้อย่างเดียว ไม่มีเพิ่ม/ลบ)
        if path == "/api/pages" and method == "GET":
            return rows("SELECT * FROM pages ORDER BY id")
        mp = re.fullmatch(r"/api/pages/(\d+)", path)
        if mp and method == "PUT":
            d = self.read_json()
            title = str(d.get("title", "")).strip()
            if not title:
                raise ApiError(400, "กรุณากรอกชื่อหน้า")
            with db() as con:
                cur = con.execute("UPDATE pages SET title=?, body=?, img=?, title_en=?, body_en=?, is_sample=0, "
                                  "updated_at=datetime('now','localtime') WHERE id=?",
                                  (title, str(d.get("body", "")), str(d.get("img", "")).strip(),
                                   str(d.get("title_en", "")).strip(), str(d.get("body_en", "")), mp.group(1)))
                if cur.rowcount == 0:
                    raise ApiError(404, "ไม่พบหน้านี้")
            return rows("SELECT * FROM pages WHERE id=?", (mp.group(1),))[0]

        if path == "/api/readiness" and method == "GET":
            return readiness()
        if path == "/api/notify" and method == "GET":
            return notify_for_admin()
        if path == "/api/notify" and method == "PUT":
            return save_notify(self.read_json())
        if path == "/api/notify/test" and method == "POST":
            return test_notify(str(self.read_json().get("channel", "")))
        if path == "/api/settings" and method == "GET":
            return {**get_settings(), "password_source": password_source()}
        if path == "/api/settings" and method == "PUT":
            d = self.read_json()
            vals = {k: str(d[k]).strip() for k in DEFAULT_SETTINGS if k in d}
            for k, v in vals.items():
                if len(v) > 1000:
                    raise ApiError(400, "ข้อความยาวเกินไป")
                if k in SITE_URL_KEYS and v and not re.fullmatch(r"https://\S+", v):
                    raise ApiError(400, "ลิงก์ Facebook / YouTube / LINE ต้องขึ้นต้นด้วย https://")
                if k == "site_email" and v and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", v):
                    raise ApiError(400, "รูปแบบอีเมลไม่ถูกต้อง")
            with db() as con:
                for k, v in vals.items():
                    con.execute("INSERT INTO settings(key,value) VALUES(?,?) "
                                "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (k, v))
            return get_settings()
        if path == "/api/password" and method == "POST":
            return self.change_password(self.read_json())
        if path == "/api/logout" and method == "POST":
            end_session(self.bearer())
            return {"ok": True}
        raise ApiError(404, "ไม่พบ API นี้")

    def change_password(self, d):
        """เปลี่ยนรหัสแอดมินจากหน้าแอดมิน — ต้องใส่รหัสเดิมให้ถูก · เปลี่ยนแล้วทุกคนถูกออกจากระบบ"""
        if password_source() == "env":
            raise ApiError(400, "รหัสถูกตั้งไว้ด้วยค่า ADMIN_PASSWORD ของเซิร์ฟเวอร์ — เปลี่ยนจากหน้านี้ไม่ได้")
        ip = self.client_ip()
        with GUARD_LOCK:   # ใช้ตัวนับเดียวกับหน้าล็อกอิน กันการเดารหัสเดิมผ่านช่องทางนี้
            if len(recent(LOGIN_FAILS, ip, LOGIN_WINDOW)) >= LOGIN_MAX:
                raise ApiError(429, "ใส่รหัสผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่")
        current, new = str(d.get("current", "")), str(d.get("new", ""))
        if not check_password(current):
            time.sleep(0.5)
            with GUARD_LOCK:
                recent(LOGIN_FAILS, ip, LOGIN_WINDOW).append(time.time())
            raise ApiError(400, "รหัสเดิมไม่ถูกต้อง")
        if len(new) < 8:
            raise ApiError(400, "รหัสใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร")
        if new == current:
            raise ApiError(400, "รหัสใหม่ต้องไม่ซ้ำกับรหัสเดิม")
        set_password(new)
        end_all_sessions()   # ทุกคน (รวมถึงคนที่อาจรู้รหัสเก่า) ต้องล็อกอินใหม่
        LOG.warning("เปลี่ยนรหัสแอดมินจากหน้าแอดมิน (จาก %s)", ip)
        return {"ok": True}

    def crud(self, method, name, rid):
        spec = RESOURCES[name]
        if method in ("POST", "PUT"):
            data = self.read_json()
            vals = {f: str(data.get(f, "")).strip() for f in spec["fields"]}
            for f in spec["required"]:
                if not vals[f]:
                    raise ApiError(400, f"กรุณากรอก {f}")
            if name == "herbs":
                vals["groups"] = norm_groups(vals["groups"])
                vals["status"] = norm_status(vals["status"])
                if vals["status"] and vals["status"] not in CONSERVATION:
                    raise ApiError(400, "สถานะการอนุรักษ์ไม่ถูกต้อง")
                if vals["province"] and PROVINCE_REGION and vals["province"] not in PROVINCE_REGION:
                    raise ApiError(400, f"ไม่รู้จักจังหวัด \"{vals['province']}\"")
            if name in ("activities", "events") and not DATE_RE.fullmatch(vals["date"]):
                raise ApiError(400, "กรุณาเลือกวันที่")
            if name == "activities":
                vals["contain"] = 1 if vals["contain"] in ("1", "true", "on") else 0
            if name == "services":
                vals["sort"] = int(vals["sort"]) if vals["sort"].lstrip("-").isdigit() else 0
            if name == "map_spots":
                norm_map_spot(vals)
            if name == "events":
                if vals["kind"] not in EVENT_KINDS:
                    raise ApiError(400, "ประเภทไม่ถูกต้อง")
                if vals["end_date"] and (not DATE_RE.fullmatch(vals["end_date"]) or vals["end_date"] < vals["date"]):
                    raise ApiError(400, "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม")
            with db() as con:
                if method == "POST" and not rid:
                    cols = ",".join(vals)
                    cur = con.execute(f"INSERT INTO {name}({cols}) VALUES({','.join('?' * len(vals))})",
                                      tuple(vals.values()))
                    rid = cur.lastrowid
                elif method == "PUT" and rid:
                    sets = ",".join(f"{k}=?" for k in vals)
                    cur = con.execute(f"UPDATE {name} SET {sets} WHERE id=? AND {LIVE}", (*vals.values(), rid))
                    if cur.rowcount == 0:
                        raise ApiError(404, "ไม่พบข้อมูล")
                else:
                    raise ApiError(405, "ไม่รองรับ")
            return rows(f"SELECT * FROM {name} WHERE id=?", (rid,))[0]
        if method == "DELETE" and rid:   # ย้ายไปถังขยะ (ยังไม่ลบจริง)
            ts = now_ts()
            with db() as con:
                con.execute(f"UPDATE {name} SET deleted_at=? WHERE id=? AND {LIVE}", (ts, rid))
            return {"ok": True, "type": name, "deleted_at": ts}
        raise ApiError(405, "ไม่รองรับ")

    def import_herbs(self, data):
        """dry_run=true: อ่านไฟล์แล้วบอกผลล่วงหน้า ยังไม่บันทึก / dry_run=false: บันทึกจริง (ข้ามแถวที่มีปัญหา)"""
        mode = data.get("mode", "merge")
        if mode not in ("merge", "replace"):
            raise ApiError(400, "โหมดไม่ถูกต้อง")
        m = re.fullmatch(r"data:[^;,]*(?:;[^,]*)?,(.+)", str(data.get("data", "")), re.S)
        if not m:
            raise ApiError(400, "ไม่พบไฟล์")
        try:
            raw = base64.b64decode(m.group(1))
        except ValueError:
            raise ApiError(400, "ไฟล์เสียหาย")
        mapping = data.get("mapping")
        items, columns, meta = build_herb_rows(parse_table(raw), mapping if isinstance(mapping, dict) else None,
                                               bool(data.get("extra")))
        valid = [i for i in items if not i["errors"]]
        with db() as con:
            existing = {r[0]: r[1] for r in con.execute(f"SELECT th, id FROM herbs WHERE {LIVE}")}
            # ชนิดที่ชื่อตรงกับของเดิม → อัปเดตแถวเดิม (คงเลขประจำพืช = ลิงก์และป้าย QR ที่ติดไว้ยังใช้ได้)
            # ทั้งโหมดเพิ่ม/อัปเดต และโหมดแทนที่ทั้งหมด
            for i in items:
                i["action"] = "skip" if i["errors"] else ("update" if i["data"]["th"] in existing else "insert")
            upd = sum(1 for i in valid if i["action"] == "update")
            drop = []
            if mode == "replace":   # ชนิดที่ไม่อยู่ในไฟล์ (หรือสวนแจ้งว่าไม่มี) → ย้ายไปถังขยะ
                keep = {i["data"]["th"] for i in items if not any("ไม่มีในสวน" in e for e in i["errors"])}
                drop = [hid for th, hid in existing.items() if th not in keep]
            summary = {"insert": len(valid) - upd, "update": upd, "delete": len(drop), "skip": len(items) - len(valid)}
            if not data.get("dry_run", True):
                if not items:
                    raise ApiError(400, "กรุณาเลือกคอลัมน์ที่เป็นชื่อภาษาไทยก่อน")
                summary["backup"] = make_backup("before-import")   # สำรองก่อนนำเข้าทุกครั้ง
                fields = RESOURCES["herbs"]["fields"]
                if drop:   # ย้ายไปถังขยะพร้อมกัน (กู้คืนได้ทั้งชุดในครั้งเดียว)
                    ts = now_ts()
                    con.executemany("UPDATE herbs SET deleted_at=? WHERE id=?", [(ts, hid) for hid in drop])
                for i in valid:
                    d = i["data"]
                    if i["action"] == "update":   # แก้เฉพาะคอลัมน์ที่มีในไฟล์ คอลัมน์อื่นคงค่าเดิม
                        cols = [f for f in fields if f in columns]
                        con.execute(f"UPDATE herbs SET {','.join(f + '=?' for f in cols)} WHERE id=?",
                                    (*(d[f] for f in cols), existing[d["th"]]))
                    else:
                        con.execute(f"INSERT INTO herbs({','.join(fields)}) VALUES({','.join('?' * len(fields))})",
                                    tuple(d[f] for f in fields))
        return {"summary": summary, "items": items, "columns": columns, **meta,
                "committed": not data.get("dry_run", True)}

    def contact(self, data):
        limits = {"name": 120, "phone": 30, "email": 120, "topic": 120, "detail": 3000}
        vals = {k: str(data.get(k, "")).strip()[:n] for k, n in limits.items()}
        if not vals["name"] or not vals["phone"]:
            raise ApiError(400, "กรุณากรอกชื่อและเบอร์โทรศัพท์")
        if not re.fullmatch(r"[0-9+\-\s()]{6,30}", vals["phone"]):
            raise ApiError(400, "เบอร์โทรศัพท์ไม่ถูกต้อง")
        # กับดักบอต: ช่องซ่อน "website" ต้องว่าง และต้องใช้เวลากรอกฟอร์มอย่างน้อย 3 วินาที
        # (ตอบเหมือนส่งสำเร็จ เพื่อไม่ให้บอตรู้ตัว แต่ไม่บันทึก)
        try:
            elapsed = float(data.get("t", 0))
        except (TypeError, ValueError):
            elapsed = 0
        if str(data.get("website", "")).strip() or elapsed < 3000:
            LOG.info("ฟอร์มติดต่อ: กันข้อความที่น่าจะเป็นบอต จาก %s", self.client_ip())
            return {"ok": True}
        if len(re.findall(r"https?://|www\.", vals["detail"], re.I)) > 2:
            raise ApiError(400, "ไม่อนุญาตให้ใส่ลิงก์หลายลิงก์ในข้อความ")
        dup = rows(f"SELECT 1 FROM messages WHERE phone=? AND detail=? AND {LIVE} "
                   "AND created_at > datetime('now','localtime','-1 day')", (vals["phone"], vals["detail"]))
        if dup:   # กดส่งซ้ำ: แจ้งว่าได้รับแล้ว (ไม่นับโควตา)
            raise ApiError(409, "ได้รับข้อความนี้แล้ว เจ้าหน้าที่จะติดต่อกลับโดยเร็ว")
        ip = self.client_ip()
        with GUARD_LOCK:
            for limit, window in CONTACT_LIMITS:
                if len(recent(CONTACT_LOG, f"{ip}:{window}", window)) >= limit:
                    phone = get_settings()["site_phones"].split(",")[0].strip()   # เบอร์จากแท็บ ⚙️ ตั้งค่าเว็บไซต์
                    raise ApiError(429, "ส่งข้อความบ่อยเกินไป กรุณาลองใหม่ภายหลัง" + (f" หรือโทร {phone}" if phone else ""))
            for _, window in CONTACT_LIMITS:
                CONTACT_LOG[f"{ip}:{window}"].append(time.time())
        with db() as con:
            con.execute("INSERT INTO messages(name,phone,email,topic,detail) VALUES(?,?,?,?,?)",
                        tuple(vals.values()))
        threading.Thread(target=notify_new_message, args=(vals,), daemon=True).start()   # แจ้งเตือนเจ้าหน้าที่
        return {"ok": True}

    def upload(self, data):
        allowed = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
                   "application/pdf": ".pdf"}
        m = re.fullmatch(r"data:([\w/+.-]+);base64,(.+)", str(data.get("data", "")), re.S)
        if not m or m.group(1) not in allowed:
            raise ApiError(400, "รองรับเฉพาะไฟล์ JPG, PNG, WEBP, GIF, PDF")
        raw = base64.b64decode(m.group(2))
        if len(raw) > 5 * 1024 * 1024:
            raise ApiError(400, "ไฟล์ต้องไม่เกิน 5MB")
        if m.group(1) == "application/pdf" and not raw.startswith(b"%PDF"):
            raise ApiError(400, "ไฟล์ PDF ไม่ถูกต้อง")
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        fname = time.strftime("%Y%m%d-%H%M%S-") + secrets.token_hex(4) + allowed[m.group(1)]
        (UPLOAD_DIR / fname).write_bytes(raw)
        return {"path": f"images/uploads/{fname}"}


if __name__ == "__main__":
    # เปลี่ยนรหัสแอดมิน:  python server/server.py --set-password   (พิมพ์รหัสใหม่เอง)
    #                    python server/server.py --set-password --generate   (สุ่มให้)
    if "--set-password" in sys.argv:
        if "--generate" in sys.argv:
            new_pw = "-".join(secrets.token_hex(2) for _ in range(3)).upper()
            new_pw = "Herb-" + new_pw
        else:
            new_pw = getpass.getpass("รหัสแอดมินใหม่ (อย่างน้อย 8 ตัว): ")
            if len(new_pw) < 8 or new_pw != getpass.getpass("พิมพ์ซ้ำอีกครั้ง: "):
                sys.exit("รหัสสั้นเกินไปหรือพิมพ์ไม่ตรงกัน — ยังไม่ได้เปลี่ยน")
        set_password(new_pw)
        init_db()
        end_all_sessions()   # ทุกคน (รวมถึงคนที่อาจรู้รหัสเก่า) ต้องล็อกอินใหม่ด้วยรหัสใหม่
        print("ตั้งรหัสแอดมินใหม่แล้ว" + (f": {new_pw}" if "--generate" in sys.argv else ""))
        print("ทุกคนที่ล็อกอินอยู่ถูกออกจากระบบแล้ว ต้องเข้าสู่ระบบใหม่ด้วยรหัสใหม่")
        sys.exit(0)

    mimetypes.add_type("text/javascript", ".js")
    mimetypes.add_type("application/manifest+json", ".webmanifest")   # PWA (ติดตั้งเว็บเป็นแอปบนมือถือ)
    setup_logging()
    init_db()
    LOG.info("เริ่มเซิร์ฟเวอร์ v%s ที่ %s:%s · ตรวจฐานข้อมูล: %s%s", APP_VERSION, HOST, PORT, check_integrity(),
             " · โหมดเว็บไซต์ทดลอง" if DEMO_MODE else "")
    threading.Thread(target=maintenance_loop, daemon=True).start()   # สำรองอัตโนมัติ + ตรวจฐานข้อมูล + ล้างถังขยะ
    print(f"เว็บสวนสมุนไพร:   http://localhost:{PORT}" + (f"  (เปิดรับที่ {HOST})" if HOST != "127.0.0.1" else ""))
    print(f"หน้าแอดมิน:       http://localhost:{PORT}/admin.html")
    if password_source() == "default":
        print("ยังใช้รหัสแอดมินเริ่มต้น admin1234 — เปลี่ยนด้วย: python server/server.py --set-password")
    print("กด Ctrl+C เพื่อหยุด")
    try:
        ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        LOG.info("หยุดเซิร์ฟเวอร์ (Ctrl+C)")
    except OSError as e:
        LOG.error("เปิดเซิร์ฟเวอร์ไม่ได้: %s — พอร์ต %s อาจถูกใช้อยู่ (เปิดเซิร์ฟเวอร์ซ้อนกันหรือไม่?)", e, PORT)
        sys.exit(1)
