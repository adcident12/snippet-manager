# Personal Snippet Manager

จัดเก็บและค้นหาโค้ด snippet ส่วนตัว พร้อมระบบค้นหาแบบ realtime กรองด้วย tag และแชร์ลิงก์ public

## ข้อกำหนดของระบบ

- PHP 8.0+ (ต้องมี extension `pdo_mysql`)
- MySQL / MariaDB 5.7+

## การติดตั้ง

### 1. นำ schema เข้า MySQL

```bash
mysql -u root -p < schema.sql
```

หรือเปิด phpMyAdmin แล้ว import ไฟล์ `schema.sql`

### 2. ตั้งค่าฐานข้อมูล

แก้ไขไฟล์ `config/database.php` หรือกำหนด environment variables:
- `DB_USER` — ชื่อผู้ใช้ MySQL (default: root)
- `DB_PASS` — รหัสผ่าน MySQL (default: ว่างเปล่า)

ฐานข้อมูล `snippet_manager` จะถูกสร้างอัตโนมัติโดย schema.sql

### 3. เริ่มเซิร์ฟเวอร์

```bash
php -S localhost:8080
```

เปิดเบราว์เซอร์ที่ `http://localhost:8080`

## โครงสร้างไฟล์

```
snippet-manager/
├── config/
│   └── database.php         ← การเชื่อมต่อฐานข้อมูล (PDO + env vars)
├── api/
│   ├── _headers.php         ← CORS + JSON headers
│   ├── _csrf.php            ← CSRF token generator + validator
│   ├── snippets.php         ← CRUD + share/unshare + CSRF token endpoint
│   ├── tags.php             ← Tags API (create/list)
│   └── share.php            ← Public share view (อ่าน snippet จาก token)
├── css/
│   ├── style.css            ← Layout + modal animations
│   └── markdown-preview.css ← Markdown preview light-mode styles
├── js/
│   └── app.js               ← jQuery: CRUD, search, highlight, CSRF handling
├── index.html               ← Main UI (Tailwind + highlight.js)
├── schema.sql               ← Database schema + sample tags
├── DEPLOYMENT.md            ← Deploy แบบ production
└── .htaccess                ← Apache config
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `api/snippets.php?_csrf=1` | ได้ CSRF token |
| GET | `api/snippets.php` | รายการ snippets (support `?q=`, `?tag=`, `?limit=`, `?offset=`) |
| GET | `api/snippets.php?id={id}` | snippet เดียว |
| POST | `api/snippets.php` | สร้าง snippet ใหม่ (ต้องส่ง CSRF token) |
| PUT | `api/snippets.php?id={id}` | แก้ไข snippet (ต้องส่ง CSRF token) |
| DELETE | `api/snippets.php` | ลบ snippet — ID ใน body JSON (ต้องส่ง CSRF token) |
| PUT | `api/snippets.php?action=share&id={id}` | แชร์ snippet สร้าง public link |
| PUT | `api/snippets.php?action=unshare&id={id}` | ยกเลิกการแชร์ |
| GET | `api/tags.php` | รายการ tags พร้อมจำนวน snippet |
| POST | `api/tags.php` | สร้าง tag ใหม่ (ต้องส่ง CSRF token) |
| GET | `api/share.php?share_token={token}` | ดู public snippet จาก token |

## คุณสมบัติ

- CRUD เต็มรูปแบบ (สร้าง, อ่าน, แก้ไข, ลบ) พร้อม CSRF protection
- ค้นหาแบบ realtime ด้วย jQuery AJAX + debounce 300ms
- กรองด้วย tags — คลิก tag บนหน้าเพื่อกรอง, คลิกซ้ำเพื่อล้าง
- Syntax highlighting ด้วย Highlight.js (PHP, JS, Python, CSS, SQL, JSON, Bash, ฯลฯ มากกว่า 15 ภาษา)
- Markdown preview toggle (Raw / Preview)
- Dark theme ธีมมืดแบบ GitHub Dark
- Responsive — ใช้ได้ทั้ง desktop และ mobile
- แชร์ snippet ผ่าน public link token
- ดาวน์โหลด snippet เป็นไฟล์ตามประเภทภาษา
- คัดลอกโค้ด 1 คลิก

## เทคนิคความปลอดภัย

- CSRF token สร้างอัตโนมัติ ตรวจสอบทุก write operation (POST/PUT/DELETE)
- PDO prepared statements ทุกคำสั่ง SELECT ที่รับ external input
- จำกัดขนาด input: title ≤ 255 chars, code ≤ 1MB, description ≤ 2048 chars
- ตรวจสอบ language ผ่าน whitelist ก่อนบันทึก
- tag names ถูก normalize เป็น lowercase อัตโนมัติ