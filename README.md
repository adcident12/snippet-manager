# Personal Snippet Manager

จัดเก็บและค้นหาโค้ด snippet ส่วนตัว พร้อมระบบค้นหาแบบ realtime กรองด้วย tag แชร์ลิงก์ public และสลับธีม Light/Dark

## ข้อกำหนดของระบบ

- PHP 8.0+ (ต้องมี extension `pdo_mysql`, `session`)
- MySQL / MariaDB 5.7+ (InnoDB + FULLTEXT)
- Node.js (สำหรับ build Tailwind CSS เท่านั้น ไม่จำเป็นตอน runtime)

## การติดตั้ง

### 1. นำ schema เข้า MySQL

```bash
mysql -u root -p < schema.sql
```

หรือเปิด phpMyAdmin แล้ว import ไฟล์ `schema.sql`

Schema จะสร้างฐานข้อมูล `snippet_manager` พร้อมตาราง 3 ตาราง:

| ตาราง | หน้าที่ |
|-------|---------|
| `snippets` | เก็บ snippet (title, code, language, description, share_token, is_public) พร้อม FULLTEXT index บน title/code/description |
| `tags` | เก็บชื่อ tag (unique, lowercase) |
| `snippet_tags` | ตารางเชื่อม many-to-many ระหว่าง snippets กับ tags พร้อม foreign key cascade |

### 2. ตั้งค่าฐานข้อมูล

แก้ไขไฟล์ `config/database.php` หรือกำหนด environment variables:

| ตัวแปร | คำอธิบาย | ค่า default |
|--------|----------|-------------|
| `DB_USER` | ชื่อผู้ใช้ MySQL | `root` |
| `DB_PASS` | รหัสผ่าน MySQL | (ว่างเปล่า) |

Database class ใช้ PDO เชื่อมต่อ `localhost:3306` ด้วย charset `utf8mb4` และตั้ง `ERRMODE_EXCEPTION` + `EMULATE_PREPARES = false`

### 3. Build Tailwind CSS (ครั้งแรก)

```bash
npm install
npm run build:css
```

คำสั่ง `build:css` จะ compile `css/tailwind.css` → `css/style.css` ผ่าน Tailwind CSS v4 + PostCSS

สำหรับ development ใช้ watch mode:

```bash
npm run watch:css
```

### 4. เริ่มเซิร์ฟเวอร์

```bash
npm run dev
# หรือ
php -S localhost:8080
```

เปิดเบราว์เซอร์ที่ `http://localhost:8080`

## โครงสร้างไฟล์

```
snippet-manager/
├── config/
│   └── database.php            ← PDO connection class (env vars สำหรับ credentials)
├── api/
│   ├── _headers.php            ← Security headers (X-Frame-Options, nosniff, XSS-Protection, Referrer-Policy, Permissions-Policy)
│   ├── _csrf.php               ← CSRF token generator + validator (session-based, timing-safe comparison)
│   ├── snippets.php            ← CRUD + share/unshare + CSRF token endpoint
│   ├── search.php              ← Full-text search + tag filter (standalone endpoint)
│   ├── tags.php                ← Tags API (list with count, create)
│   └── share.php               ← Public share endpoint (อ่าน snippet จาก token โดยไม่ต้องมี session)
├── css/
│   ├── tailwind.css            ← Tailwind CSS v4 source (input)
│   ├── style.css               ← Compiled Tailwind output (generated)
│   ├── light-theme.css         ← Light theme overrides + skeleton shimmer animations
│   ├── markdown-preview.css    ← Markdown preview styling
│   └── slimselect.min.css      ← SlimSelect dropdown styling
├── js/
│   ├── app.js                  ← jQuery application: CRUD, search, highlight, CSRF, theme toggle, share, markdown preview
│   └── slimselect.min.js       ← SlimSelect library (searchable dropdown)
├── index.html                  ← Main SPA (Tailwind + inline styles, responsive grid layout)
├── favicon.svg                 ← SVG favicon
├── schema.sql                  ← Database schema + sample tags + performance indexes
├── .htaccess                   ← Apache security config (headers, directory listing block, CSP)
├── nginx.conf                  ← Nginx location block config
├── package.json                ← Node.js dependencies (Tailwind CSS v4 + PostCSS)
├── postcss.config.js           ← PostCSS config (@tailwindcss/postcss plugin)
├── tailwind.config.js          ← Tailwind config (content paths, custom colors, font families)
├── DEPLOYMENT.md               ← Production deployment guide
└── .gitignore                  ← Ignore rules
```

## Tech Stack

| เทคโนโลยี | เวอร์ชัน | หน้าที่ |
|------------|---------|---------|
| PHP | 8.0+ | Backend API (PDO MySQL) |
| MySQL/MariaDB | 5.7+ | Database (InnoDB, FULLTEXT search) |
| jQuery | 3.7.1 | Frontend AJAX + DOM manipulation |
| Tailwind CSS | 4.0 | Utility-first CSS framework (build-time) |
| Highlight.js | 11.9.0 | Syntax highlighting (17 ภาษา) |
| Marked.js | latest | Markdown → HTML rendering |
| SlimSelect | latest | Searchable dropdown สำหรับเลือกภาษา |
| Google Fonts | - | Inter, Noto Sans Thai, JetBrains Mono |

## API Endpoints

### Snippets (`api/snippets.php`)

| Method | Endpoint | Description | CSRF |
|--------|----------|-------------|------|
| GET | `?_csrf=1` | รับ CSRF token สำหรับ session | - |
| GET | (ไม่มี params) | รายการ snippets ทั้งหมด | - |
| GET | `?id={id}` | snippet เดียวพร้อม tags, share_token, is_public | - |
| GET | `?q={keyword}` | ค้นหาด้วย FULLTEXT + LIKE fallback | - |
| GET | `?tag={name}` | กรองตาม tag | - |
| GET | `?limit={n}&offset={n}` | Pagination (limit max 200, default 50) | - |
| POST | (body: JSON) | สร้าง snippet ใหม่ | ต้องส่ง |
| PUT | `?id={id}` (body: JSON) | แก้ไข snippet | ต้องส่ง |
| DELETE | (body: JSON `{id}`) | ลบ snippet + ลบ orphaned tags อัตโนมัติ | ต้องส่ง |
| PUT | `?action=share&id={id}` | สร้าง public share token (32 hex chars) | ต้องส่ง |
| PUT | `?action=unshare&id={id}` | ยกเลิกการแชร์ (ลบ token, ปิด is_public) | ต้องส่ง |

### Search (`api/search.php`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `?q={keyword}` | Full-text search (NATURAL LANGUAGE MODE) |
| GET | `?tag={name}` | กรองตาม tag |
| GET | `?q={keyword}&tag={name}` | ค้นหา + กรอง combined |

### Tags (`api/tags.php`)

| Method | Endpoint | Description | CSRF |
|--------|----------|-------------|------|
| GET | (ไม่มี params) | รายการ tags ทั้งหมด พร้อมจำนวน snippet (`count`) | - |
| POST | (body: JSON `{tags: [...]}`) | สร้าง tag ใหม่ (INSERT IGNORE, lowercase) | ต้องส่ง |

### Share (`api/share.php`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `?share_token={token}` | ดู public snippet จาก token (ไม่ต้องมี session) |

## CSRF Protection

- Token สร้างจาก `random_bytes(32)` เก็บใน PHP session
- Frontend ขอ token ผ่าน `GET ?_csrf=1` แล้วเก็บไว้ใน hidden input + meta tag
- ส่ง token ผ่าน header `X-CSRF-Token` ทุก write operation (POST/PUT/DELETE)
- Validation ใช้ `hash_equals()` (timing-safe comparison)
- ตรวจสอบ 3 แหล่ง: POST param → X-CSRF-Token header → GET param

## ภาษาที่รองรับ (17 ภาษา)

PHP, JavaScript, TypeScript, Python, CSS, HTML, SQL, JSON, Bash, Shell, Java, C++, C#, Go, Rust, Markdown, Plain Text

- Language เลือกผ่าน SlimSelect dropdown พร้อม searchable
- ค่าถูก validate ผ่าน whitelist ทั้ง client-side และ server-side
- ภาษาที่ไม่อยู่ใน whitelist จะ fallback เป็น `plaintext`

## คุณสมบัติ

### CRUD
- สร้าง, อ่าน, แก้ไข, ลบ snippet พร้อม CSRF protection ทุก write operation
- Modal dialog สำหรับ add/edit พร้อม validation (title required, code max 1MB, description max 2048 chars)
- ลบ snippet จะลบ orphaned tags อัตโนมัติ (tags ที่ไม่มี snippet เชื่อมอยู่)
- Delete confirmation modal ก่อนลบจริง

### การค้นหาและกรอง
- ค้นหาแบบ realtime ด้วย jQuery AJAX + debounce 300ms
- Full-text search (MySQL NATURAL LANGUAGE MODE) บน title, code, description
- LIKE fallback สำหรับ title (กรณี full-text ไม่ตรง)
- กรองด้วย tags — คลิก tag บน header เพื่อกรอง, คลิกซ้ำเพื่อล้าง
- คลิก tag pill บน snippet card เพื่อกรองได้โดยตรง
- Pagination แบบ "Load More" (default 10 ต่อหน้า, max 200)
- ปุ่ม "โหลดทั้งหมด" สำหรับ reset filter ทั้งหมด

### UI/UX
- Responsive grid layout (1 col mobile, 2 col tablet, 3 col desktop)
- Snippet card แสดง title, language badge, description (line-clamp 5), tags (color-coded 6 สี) และวันที่
- Skeleton loading animation ระหว่างรอข้อมูล
- Card enter animation (fade + slide up) แบบ staggered
- Toast notification (success/error/info) พร้อม auto-dismiss 3 วินาที
- Modal slide-up animation
- Load More button พร้อม shimmer effect + loading spinner

### Theme System (Dark/Light)
- Dark theme (default) — สไตล์ GitHub Dark
- Light theme — สไตล์ GitHub Light
- สลับด้วยปุ่ม toggle ที่ header (icon sun/moon)
- บันทึก preference ใน localStorage
- Light theme ใช้ `[data-theme="light"]` CSS overrides
- SlimSelect dropdown + skeleton shimmer + markdown preview ปรับตามธีม
- Code block ใน view modal คงเป็น dark background ทั้งสองธีม

### Syntax Highlighting
- Highlight.js 11.9.0 พร้อม GitHub Dark theme
- รองรับ 17 ภาษา (โหลดเฉพาะ language module ที่ใช้)
- Auto-highlight เมื่อเปิด view modal

### Markdown Preview
- Markdown snippet แสดง preview อัตโนมัติเมื่อเปิดดู
- Toggle ระหว่าง Raw code กับ Preview ด้วยปุ่ม pill toggle
- Render ด้วย Marked.js พร้อม sanitization (ลบ script/iframe/event handlers/javascript: URLs)
- Preview แสดงด้วย light-mode styling (parsedown.css + custom overrides)

### การแชร์
- สร้าง public share link ด้วย token (32 hex chars จาก `random_bytes(16)`)
- ดู snippet ที่แชร์ผ่าน URL `?share_token={token}` หรือ `#share_token={token}`
- Share modal แสดง URL + token พร้อมปุ่มคัดลอก
- ยกเลิกการแชร์ได้ (ลบ token + ปิด is_public)
- Public view mode ซ่อนปุ่ม edit/download/copy

### ดาวน์โหลดและคัดลอก
- ดาวน์โหลด snippet เป็นไฟล์ตามประเภทภาษา (เช่น .php, .js, .py, .md)
- คัดลอกโค้ด 1 คลิก (navigator.clipboard API + execCommand fallback)
- ดาวน์โหลด/คัดลอกได้ทั้งจาก card action buttons และ view modal

### การแสดงผลวันที่
- แสดงวันที่แบบ Thai locale (เช่น "19 มิ.ย. 2569 15:30")
- ใช้ `toLocaleDateString('th-TH')` + `toLocaleTimeString('th-TH')`

## ความปลอดภัย

| ด้าน | การป้องกัน |
|------|-----------|
| SQL Injection | PDO prepared statements ทุก query ที่รับ external input |
| CSRF | Session-based token + timing-safe validation ทุก write operation |
| XSS | HTML escaping ผ่าน `escapeAttr()` สำหรับ attribute values; Markdown preview sanitize ลบ script/iframe/event handlers |
| Input Validation | title ≤ 255 chars, code ≤ 1MB, description ≤ 2048 chars, tag ≤ 100 chars |
| Language Whitelist | ตรวจสอบ language ผ่าน whitelist (17 ค่า) ก่อนบันทึก |
| Tag Normalization | tag names ถูก normalize เป็น lowercase + trim อัตโนมัติ |
| Code Sanitization | ลบ null bytes + control characters จาก code ก่อนบันทึก |
| Security Headers | X-Content-Type-Options: nosniff, X-Frame-Options: DENY, X-XSS-Protection, Referrer-Policy, Permissions-Policy |
| Directory Protection | .htaccess + nginx.conf บล็อก directory listing และ dotfiles |
| CSP | Content-Security-Policy ผ่าน .htaccess (Apache) |
| Credential Safety | Database credentials ผ่าน environment variables (ไม่ hardcode) |

## npm Scripts

| คำสั่ง | หน้าที่ |
|--------|---------|
| `npm run build:css` | Compile Tailwind CSS → `css/style.css` |
| `npm run watch:css` | Watch mode สำหรับ development |
| `npm run dev` | เริ่ม PHP built-in server ที่ `localhost:8080` |
