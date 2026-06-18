# Personal Snippet Manager

จัดเก็บและค้นหาโค้ด snippet ส่วนตัว พร้อมระบบค้นหาและกรองด้วย tag

## ข้อกำหนดของระบบ

- PHP 8.0+ (ต้องมี extension `pdo_mysql`)
- MySQL / MariaDB

## การติดตั้ง

### 1. สร้างฐานข้อมูล

```bash
mysql -u root -e "source schema.sql"
```

หรือเปิด MySQL แล้วรันคำสั่งในไฟล์ `schema.sql`

### 2. ติดตั้ง Tailwind CSS (optional — ถ้าต้องการ build CSS เอง)

```bash
npm install
npm run build:css
```

หรือใช้ `npm run watch:css` เพื่อ compile อัตโนมัติเมื่อแก้ไขไฟล์

### 3. เริ่มเซิร์ฟเวอร์

```bash
php -S localhost:8080
```

เปิดเบราว์เซอร์ที่ `http://localhost:8080`

## โครงสร้างไฟล์

```
snippet-manager/
├── config/database.php      ← การเชื่อมต่อฐานข้อมูล
├── api/
│   ├── snippets.php         ← CRUD endpoints (GET, POST, PUT, DELETE)
│   ├── tags.php             ← Tags API
│   └── search.php           ← Full-text search API
├── css/tailwind.css          ← Tailwind CSS source
├── js/app.js                ← jQuery application logic
├── schema.sql               ← Database schema
└── index.html               ← Main UI
```

## API Endpoints

| Method | Endpoint         | Description           |
|--------|------------------|-----------------------|
| GET    | /api/snippets.php| รายการ snippets        |
| GET    | /api/snippets.php?id={id} | snippet เดียว |
| POST   | /api/snippets.php | สร้างใหม่             |
| PUT    | /api/snippets.php?id={id} | แก้ไข            |
| DELETE | /api/snippets.php?id={id} | ลบ               |
| GET    | /api/tags.php    | รายการ tags           |
| POST   | /api/tags.php    | สร้าง tag ใหม่        |
| GET    | /api/search.php?q={query}&tag={tag} | ค้นหา     |

## คุณสมบัติ

- CRUD เต็มรูปแบบ (สร้าง, อ่าน, แก้ไข, ลบ)
- ค้นหาแบบ realtime ด้วย jQuery + AJAX
- กรองด้วย tags
- Syntax highlighting ด้วย Highlight.js
- Dark theme ธีมมืดแบบ GitHub Dark
- Responsive — ใช้ได้ทั้ง desktop และ mobile