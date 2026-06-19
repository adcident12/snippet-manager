# Personal Snippet Manager — Production Deployment Guide

## ข้อกำหนดของ Server

| ซอฟต์แวร์ | เวอร์ชัน | หมายเหตุ |
|-----------|---------|----------|
| PHP | 8.0+ | ต้องมี extension: `pdo_mysql`, `session`, `json` |
| PHP-FPM | 8.x | สำหรับ Nginx (ถ้าใช้ Apache ไม่จำเป็น) |
| MySQL / MariaDB | 5.7+ | InnoDB engine, FULLTEXT index support |
| Nginx หรือ Apache | - | รองรับทั้งสอง (มี config ให้ทั้งคู่) |

## 1. Database Setup

### 1.1 Import Schema

```bash
mysql -u root -p < schema.sql
```

Schema จะสร้าง:
- ฐานข้อมูล `snippet_manager` (charset: utf8mb4, collation: utf8mb4_unicode_ci)
- ตาราง `snippets` — เก็บ snippet พร้อม FULLTEXT index บน (title, code, description)
- ตาราง `tags` — ชื่อ tag (unique)
- ตาราง `snippet_tags` — ความสัมพันธ์ many-to-many พร้อม foreign key cascade
- Sample tags: php, javascript, css, python, general
- Performance index: `idx_snippet_id` บน snippet_tags

### 1.2 ปรับ Full-Text Search (แนะนำ)

MySQL มี minimum token size = 3 ตัวอักษร (default) หากต้องการค้นหาคำสั้น เช่น "go", "js":

```ini
# ใน my.ini (Windows) หรือ my.cnf (Linux)
[mysqld]
innodb_ft_min_token_size = 1
```

Restart MySQL แล้ว rebuild FULLTEXT index:

```sql
USE snippet_manager;
ALTER TABLE snippets DROP INDEX idx_search;
ALTER TABLE snippets ADD FULLTEXT INDEX idx_search (title, code, description);
```

## 2. File Upload

Upload ไฟล์ทั้งหมด (ยกเว้น `node_modules/`, `.git/`, `.clinerules/`, `.remember/`) ไปยัง web server:

```
yourdomain.com/snippet-manager/
├── index.html
├── favicon.svg
├── .htaccess                 ← Apache security config
├── nginx.conf                ← Nginx config (reference)
├── api/
│   ├── _headers.php          ← Security headers
│   ├── _csrf.php             ← CSRF protection
│   ├── snippets.php          ← CRUD + share/unshare API
│   ├── search.php            ← Full-text search API
│   ├── tags.php              ← Tags API
│   └── share.php             ← Public share endpoint
├── config/
│   └── database.php          ← Database connection (PDO)
├── css/
│   ├── style.css             ← Compiled Tailwind CSS (ต้อง build ก่อน upload)
│   ├── light-theme.css       ← Light theme + skeleton shimmer
│   ├── markdown-preview.css  ← Markdown preview styles
│   └── slimselect.min.css    ← SlimSelect dropdown styles
├── js/
│   ├── app.js                ← Main application
│   └── slimselect.min.js     ← SlimSelect library
└── schema.sql                ← Database schema (สำหรับ reference เท่านั้น)
```

**ไม่ต้อง upload:** `node_modules/`, `package.json`, `package-lock.json`, `postcss.config.js`, `tailwind.config.js`, `css/tailwind.css`

## 3. Database Credentials

### Option A: Environment Variables (แนะนำ)

ตั้ง environment variables ใน PHP-FPM pool config:

```bash
# /etc/php/8.x/fpm/pool.d/www.conf
env[DB_USER] = your_db_user
env[DB_PASS] = your_strong_password
```

```bash
systemctl restart php8.x-fpm
```

### Option B: แก้ไข database.php โดยตรง

แก้ไข `config/database.php` — เปลี่ยน default ใน `getDbUser()` และ `getDbPass()`:

```php
private static function getDbUser(): string {
    return getenv('DB_USER') ?: 'your_db_user';
}

private static function getDbPass(): string {
    return getenv('DB_PASS') ?: 'your_strong_password';
}
```

**Connection settings ใน database.php:**
- Host: `localhost`
- Port: `3306`
- Database: `snippet_manager`
- Charset: `utf8mb4`
- PDO Options: `ERRMODE_EXCEPTION`, `FETCH_ASSOC`, `EMULATE_PREPARES = false`

## 4. Web Server Configuration

### 4.1 Nginx

เพิ่ม location block ใน `server {}` block (ดูตัวอย่างจาก `nginx.conf` ที่มาพร้อมโปรเจค):

```nginx
location /snippet-manager {
    alias /var/www/html/snippet-manager;
    index index.html index.php;
    try_files $uri $uri/ =404;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Block dotfiles (.htaccess, .git, .env)
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # PHP-FPM for API endpoints
    location ~ ^/snippet-manager/api/.*\.php$ {
        alias /var/www/html/snippet-manager/api/;
        fastcgi_pass 127.0.0.1:9000;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $request_filename;
        fastcgi_param HTTPS on;
        include fastcgi_params;
    }

    # Block direct access to config PHP files
    location ~ ^/snippet-manager/(config|api) {
        location ~ \.php$ { deny all; }
    }
}
```

Test และ reload:

```bash
nginx -t && systemctl reload nginx
```

### 4.2 Apache

`.htaccess` มาพร้อมโปรเจค ครอบคลุม:
- ปิด directory listing (`Options -Indexes`)
- บล็อก dotfiles
- Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, CSP)
- ปิด error display ใน production (`display_errors Off`)
- HTTPS redirect (uncomment เมื่อพร้อม)

CSP policy ที่ตั้งไว้ใน .htaccess:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' cdnjs.cloudflare.com ajax.googleapis.com;
style-src 'self' 'unsafe-inline' fonts.googleapis.com;
font-src 'self' fonts.gstatic.com;
img-src 'self' data:;
```

## 5. File Permissions (Linux)

```bash
# ไฟล์ทั่วไป (อ่านได้)
chmod 644 index.html favicon.svg .htaccess nginx.conf schema.sql
chmod 644 api/*.php css/*.css js/*.js

# โฟลเดอร์ (เข้าถึงได้)
chmod 755 api/ config/ css/ js/

# Database credentials (จำกัดสิทธิ์)
chmod 600 config/database.php
```

## 6. CDN Dependencies

แอปโหลดทรัพยากรจาก CDN ดังนี้ (ต้องมี internet access):

| ทรัพยากร | CDN | เวอร์ชัน |
|----------|-----|---------|
| jQuery | code.jquery.com | 3.7.1 |
| Highlight.js (core) | cdnjs.cloudflare.com | 11.9.0 |
| Highlight.js (14 language modules) | cdnjs.cloudflare.com | 11.9.0 |
| Highlight.js theme (github-dark) | cdnjs.cloudflare.com | 11.9.0 |
| Marked.js | cdn.jsdelivr.net | latest |
| Parsedown CSS | cdn.jsdelivr.net | 1.0.0 |
| Google Fonts (Inter, Noto Sans Thai, JetBrains Mono) | fonts.googleapis.com | - |

**Language modules ที่โหลด:** PHP, JavaScript, Python, CSS, Markdown, XML (HTML), SQL, JSON, Bash, Java, C++, C#, Go, Rust

**Local dependencies (bundled):** SlimSelect (js/slimselect.min.js + css/slimselect.min.css)

## 7. API Architecture

### Request Flow

```
Client (jQuery AJAX)
  │
  ├── GET api/snippets.php?_csrf=1     → รับ CSRF token (session start)
  │
  ├── GET api/snippets.php              → List/Search/Filter snippets
  │   ├── ?id={id}                      → Single snippet
  │   ├── ?q={keyword}                  → FULLTEXT search + LIKE fallback
  │   ├── ?tag={name}                   → Tag filter (EXISTS subquery)
  │   └── ?limit={n}&offset={n}         → Pagination
  │
  ├── POST api/snippets.php             → Create snippet (CSRF required)
  ├── PUT  api/snippets.php?id={id}     → Update snippet (CSRF required)
  ├── DELETE api/snippets.php           → Delete snippet (ID in body, CSRF required)
  │
  ├── PUT api/snippets.php?action=share&id={id}    → Generate share token
  ├── PUT api/snippets.php?action=unshare&id={id}  → Revoke share token
  │
  ├── GET api/tags.php                  → List tags with counts
  ├── POST api/tags.php                 → Create tags (CSRF required)
  │
  ├── GET api/share.php?share_token={token}  → Public snippet view (no session)
  │
  └── GET api/search.php?q=&tag=        → Standalone search endpoint
```

### CSRF Flow

1. Frontend โหลด token ตอน init: `GET api/snippets.php?_csrf=1`
2. Token เก็บใน `#csrfTokenInput` (hidden input) + `<meta name="csrf-token">`
3. ส่งผ่าน header `X-CSRF-Token` ทุก write request
4. Server validate ด้วย `hash_equals()` (timing-safe)

### Share Token Flow

1. User กด "แชร์" ใน view modal
2. Frontend เรียก `PUT ?action=share&id={id}` → server สร้าง token (32 hex chars จาก `random_bytes(16)`)
3. Share modal แสดง URL + token + ปุ่มคัดลอก
4. ผู้รับเปิด `?share_token={token}` → frontend เรียก `GET api/share.php` → แสดง public view (ซ่อนปุ่ม edit/download/copy)
5. ยกเลิกแชร์: `PUT ?action=unshare&id={id}` → ลบ token + ปิด is_public

### Delete + Orphan Cleanup Flow

1. ลบ snippet → เก็บ tag IDs ที่เชื่อมอยู่
2. ลบ record จาก `snippets` + `snippet_tags`
3. ลบ orphaned tags (tags ที่ไม่มี snippet ใดเชื่อมอยู่)
4. ทั้งหมดอยู่ใน transaction

## 8. Security Checklist

### ป้องกันแล้ว

- [x] **SQL Injection** — PDO prepared statements + parameter binding ทุก query
- [x] **CSRF** — Session-based token, timing-safe validation, ทุก write operation
- [x] **XSS** — `escapeAttr()` สำหรับ HTML attribute values; Markdown preview sanitize (ลบ script, iframe, object, embed, form, input, event handlers, javascript: URLs)
- [x] **Input Validation** — title ≤ 255, code ≤ 1MB, description ≤ 2048, tag ≤ 100 chars
- [x] **Language Whitelist** — 17 ค่าที่ valid, fallback เป็น plaintext
- [x] **Code Sanitization** — ลบ null bytes + control chars ก่อนบันทึก
- [x] **Security Headers** — X-Frame-Options DENY, X-Content-Type-Options nosniff, X-XSS-Protection, Referrer-Policy, Permissions-Policy (ทั้งใน PHP `_headers.php` + web server config)
- [x] **Directory Protection** — ปิด directory listing, บล็อก dotfiles
- [x] **PDO Config** — `EMULATE_PREPARES = false` (ใช้ native prepared statements จริง)
- [x] **Error Handling** — Production ปิด `display_errors`, log ไปไฟล์

### ยังไม่มี (แนะนำเพิ่ม)

- [ ] **Authentication** — ยังไม่มีระบบ login (single-user mode) แนะนำเพิ่มก่อน public access
- [ ] **Rate Limiting** — ยังไม่มีการจำกัด request rate
- [ ] **HTTPS** — แนะนำบังคับ HTTPS (uncomment redirect ใน .htaccess หรือเพิ่มใน nginx)

## 9. Testing Checklist

### CRUD Operations
- [ ] สร้าง snippet ใหม่ — title, code, language, tags, description ครบถ้วน
- [ ] แก้ไข snippet — ข้อมูลอัปเดตถูกต้อง, tags เปลี่ยนได้
- [ ] ลบ snippet — ลบสำเร็จ, orphaned tags ถูกลบอัตโนมัติ
- [ ] Delete confirmation modal — แสดงก่อนลบจริง

### Search & Filter
- [ ] ค้นหาด้วยคำภาษาอังกฤษ — full-text search ทำงาน
- [ ] ค้นหาด้วย title (LIKE fallback) — กรณี full-text ไม่ตรง
- [ ] กรองด้วย tag — คลิก tag ที่ header bar
- [ ] กรองด้วย tag pill — คลิก tag บน snippet card
- [ ] ค้นหา + กรอง tag พร้อมกัน — combined filter
- [ ] Debounce 300ms — พิมพ์เร็วไม่ส่ง request ซ้ำซ้อน

### Pagination
- [ ] Load More — โหลดเพิ่ม 10 รายการต่อครั้ง
- [ ] ปุ่ม "โหลดทั้งหมด" — reset search/tag/pagination
- [ ] แสดงจำนวน "X จาก Y snippets" ถูกต้อง

### Share
- [ ] สร้าง share token — `PUT ?action=share` สำเร็จ
- [ ] เปิด public link `?share_token={token}` — แสดง snippet ถูกต้อง
- [ ] Public view ซ่อนปุ่ม edit/download/copy
- [ ] ยกเลิกการแชร์ — token ถูกลบ, link ใช้งานไม่ได้
- [ ] คัดลอกลิงก์ — clipboard ทำงาน

### UI
- [ ] Dark theme (default) — สีถูกต้อง
- [ ] Light theme — สลับด้วยปุ่ม, สีถูกต้อง, บันทึกใน localStorage
- [ ] Responsive — mobile (1 col), tablet (2 col), desktop (3 col)
- [ ] Skeleton loading — แสดงระหว่างรอข้อมูล
- [ ] Toast notifications — success/error/info แสดงและหายอัตโนมัติ

### Syntax Highlighting & Markdown
- [ ] Highlight.js — ทุกภาษาที่รองรับแสดงสีถูกต้อง
- [ ] Markdown preview — Marked.js render ถูกต้อง
- [ ] Toggle Raw/Preview — สลับได้ไม่มี artifacts
- [ ] Language dropdown (SlimSelect) — ค้นหาและเลือกภาษาได้

### Download & Copy
- [ ] ดาวน์โหลด snippet — นามสกุลไฟล์ตรงกับภาษา (.php, .js, .py, ...)
- [ ] คัดลอกโค้ด — navigator.clipboard API + fallback ทำงาน

### วันที่
- [ ] Thai locale — วันที่แสดงในรูปแบบ "19 มิ.ย. 2569 15:30"

### CSRF
- [ ] CSRF token โหลดตอน init
- [ ] Create/Update/Delete ส่ง token ผ่าน X-CSRF-Token header
- [ ] Request ที่ไม่มี token ถูก reject (HTTP 403)
