# คู่มือนำเว็บสวนสมุนไพรขึ้นออนไลน์

ตอนนี้เว็บเปิดได้เฉพาะในเครื่องนี้ (`http://localhost:8000`) ถ้าจะให้คนทั่วไปเข้าได้ มี 2 ทางเลือก:

| | **A. เช่าเซิร์ฟเวอร์ (VPS)** — แนะนำสำหรับใช้งานจริง | **B. เปิดจากเครื่องนี้ผ่าน Cloudflare Tunnel** |
|---|---|---|
| ค่าใช้จ่าย | ค่าเซิร์ฟเวอร์ ~150–400 บาท/เดือน + โดเมน ~400–1,000 บาท/ปี | ฟรี (จ่ายแค่ค่าโดเมน) |
| เว็บล่มเมื่อ | ผู้ให้บริการมีปัญหา (นาน ๆ ครั้ง) | **ปิดเครื่อง / ไฟดับ / เน็ตหลุด / Windows อัปเดตแล้วรีสตาร์ต** |
| ความยาก | ปานกลาง (พิมพ์คำสั่งตามคู่มือ) | ง่าย |
| เหมาะกับ | เปิดให้ประชาชนใช้จริงตลอด 24 ชม. | ทดลอง / ช่วงสั้น ๆ / เครื่องที่เปิดทิ้งไว้ตลอด |

> ⚠️ **ทั้งสองทางเลือก** ต้องมี **โดเมน** (ชื่อเว็บ เช่น `herbgarden.example.com`) — ถ้าเป็นเว็บขององค์กร ควรขอให้ฝ่าย IT ขององค์กรสร้างโดเมนย่อยให้ เช่น `herbgarden.<โดเมนองค์กร>` แทนการซื้อเอง

---

## ก่อนเริ่ม (ทำทั้ง A และ B)

1. เปิดหน้าแอดมิน → แท็บ **✅ ความพร้อมของเว็บ** → แก้ให้เหลือน้อยที่สุด (อย่างน้อยหัวข้อสีแดง)
2. แท็บ **💾 สำรองข้อมูล** → กด **สำรองข้อมูลตอนนี้** → กด **ดาวน์โหลด** เก็บไว้
3. ไฟล์ที่ต้องนำขึ้นเซิร์ฟเวอร์:
   - `index.html`, `admin.html`, โฟลเดอร์ `css/`, `js/`, `images/` (รวม `images/uploads/`)
   - โฟลเดอร์ `server/` — มี `server.py` และ **ข้อมูลทั้งหมด** `herbgarden.db`
   - **ไม่ต้อง**นำขึ้น: `.claude/`, `deploy/`, `tests/`, `ขอข้อมูลจากสวน/`, `start-server.bat`, `DEPLOY.md`, `README.md`
   - `server/admin.json` (รหัสแอดมิน) และ `server/notify.json` (รหัสอีเมล/LINE) มีข้อมูลลับ — ถ้าไม่สะดวกส่งไฟล์อย่างปลอดภัย ให้ **ตั้งใหม่บนเซิร์ฟเวอร์** แทน (ขั้นที่ A5)

---

## ทางเลือก A: เช่าเซิร์ฟเวอร์ (VPS) + Caddy

ใช้ได้กับผู้ให้บริการ VPS ทั่วไป (เช่น DigitalOcean, Vultr, Linode หรือผู้ให้บริการในไทย) เลือก **Ubuntu 24.04**, แรม 1 GB ก็พอ

### A1. เตรียมเซิร์ฟเวอร์
ล็อกอินเข้าเซิร์ฟเวอร์ (ผู้ให้บริการจะให้ IP และรหัส) แล้วพิมพ์:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 caddy
sudo useradd --system --home /opt/herbgarden --shell /usr/sbin/nologin herbgarden
sudo mkdir -p /opt/herbgarden
```

### A2. อัปโหลดไฟล์เว็บ
จากเครื่อง Windows (เปิด PowerShell ในโฟลเดอร์เว็บ) — เปลี่ยน `1.2.3.4` เป็น IP ของเซิร์ฟเวอร์:
```powershell
scp -r index.html admin.html css js images server root@1.2.3.4:/opt/herbgarden/
scp deploy/Caddyfile deploy/herbgarden.service root@1.2.3.4:/tmp/
```
แล้วบนเซิร์ฟเวอร์:
```bash
sudo chown -R herbgarden:herbgarden /opt/herbgarden
```

### A3. ชี้โดเมนมาที่เซิร์ฟเวอร์
ในหน้าจัดการโดเมน (หรือขอฝ่าย IT) เพิ่มระเบียน DNS:
- ชนิด **A** · ชื่อ `www` (หรือชื่อโดเมนย่อย) · ค่า = **IP ของเซิร์ฟเวอร์**

รอ 5–30 นาทีให้มีผล

### A4. เปิดเว็บและ HTTPS
```bash
# แก้ www.example.com ในไฟล์เป็นโดเมนจริงก่อน
sudo nano /tmp/Caddyfile
sudo cp /tmp/Caddyfile /etc/caddy/Caddyfile
sudo cp /tmp/herbgarden.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now herbgarden
sudo systemctl reload caddy
```
Caddy ขอใบรับรอง HTTPS ให้อัตโนมัติ — เปิด `https://โดเมนของคุณ` ได้เลย

### A5. ตั้งรหัสแอดมินบนเซิร์ฟเวอร์ (ถ้าไม่ได้อัปโหลด admin.json)
```bash
cd /opt/herbgarden
sudo -u herbgarden python3 server/server.py --set-password
sudo systemctl restart herbgarden
```

### A6. หลังขึ้นออนไลน์
- หน้าแอดมิน → **🔔 แจ้งเตือน** → เปลี่ยน "ที่อยู่เว็บ" เป็น `https://โดเมนของคุณ` แล้วกดทดสอบส่ง
- เปิดไฟร์วอลล์เฉพาะพอร์ตที่จำเป็น:
  ```bash
  sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
  ```

### อัปเดตเว็บภายหลัง
อัปโหลดเฉพาะไฟล์ที่แก้ (เช่น `js/`, `css/`) ด้วย `scp` แล้ว `sudo systemctl restart herbgarden`
**ห้ามอัปโหลด `server/herbgarden.db` ทับ** — ข้อมูลที่แอดมินแก้บนเว็บจริงจะหาย

---

## ทางเลือก B: เปิดจากเครื่องนี้ผ่าน Cloudflare Tunnel

ไม่ต้องเช่าเซิร์ฟเวอร์ ไม่ต้องตั้งค่าเราเตอร์ — แต่**เครื่องนี้ต้องเปิดทิ้งไว้ตลอด**

### B1. เตรียมบัญชี
1. สมัคร Cloudflare (ฟรี) ที่ dash.cloudflare.com
2. เพิ่มโดเมนของคุณเข้า Cloudflare และเปลี่ยน Nameserver ตามที่ Cloudflare บอก (ทำที่ผู้ให้บริการโดเมน)

### B2. ติดตั้งและสร้าง tunnel (PowerShell)
```powershell
winget install --id Cloudflare.cloudflared
cloudflared tunnel login                       # เปิดเบราว์เซอร์ให้เลือกโดเมน
cloudflared tunnel create herbgarden
cloudflared tunnel route dns herbgarden www.example.com    # เปลี่ยนเป็นโดเมนจริง
```
สร้างไฟล์ `%USERPROFILE%\.cloudflared\config.yml`:
```yaml
tunnel: herbgarden
credentials-file: C:\Users\<ชื่อผู้ใช้>\.cloudflared\<รหัส-tunnel>.json
ingress:
  - hostname: www.example.com
    service: http://localhost:8000
  - service: http_status:404
```

### B3. เปิดเว็บ
ดับเบิลคลิก `deploy\start-with-tunnel.bat` — จะเปิดทั้งเว็บและ tunnel แล้วเข้า `https://www.example.com` ได้เลย

> ถ้าแค่อยาก **ทดลองให้คนอื่นดูชั่วคราว** (ไม่ต้องมีโดเมน): เปิดเว็บตามปกติ แล้วรัน
> `cloudflared tunnel --url http://localhost:8000` จะได้ลิงก์ `https://xxxx.trycloudflare.com` แบบสุ่ม — ใช้ได้จนกว่าจะปิดหน้าต่าง **ไม่เหมาะกับใช้งานจริง**

---

## ข้อควรระวังหลังเปิดใช้จริง
- **ห้ามแชร์รหัสแอดมิน** ในแชทกลุ่ม/อีเมล — ถ้าหลุด ให้ตั้งใหม่ด้วย `--set-password` ทันที
- **ดาวน์โหลดไฟล์สำรองเก็บนอกเซิร์ฟเวอร์** อย่างน้อยเดือนละครั้ง (แท็บ 💾 สำรองข้อมูล) และก๊อปโฟลเดอร์ `images/uploads/` ด้วย
- ถ้าเว็บเข้าไม่ได้ (ทางเลือก A): `sudo systemctl status herbgarden` และ `sudo journalctl -u herbgarden -n 50` เพื่อดูสาเหตุ
- ระบบนี้เหมาะกับเว็บขนาดเล็ก–กลาง (ผู้เข้าชมหลักพันคน/วัน) ถ้าคนเข้าเยอะกว่านี้มาก ควรปรึกษาผู้ดูแลระบบ
