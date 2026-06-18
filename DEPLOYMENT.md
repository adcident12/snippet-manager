# Personal Snippet Manager — Production Deployment Guide

## 🚀 Deploy to web server (Nginx)

### 1. Database Setup
```sql
-- Upload and execute schema.sql in your MySQL/phpMyAdmin
source /path/to/schema.sql;
```

⚠️ **Critical: MySQL full-text search requires `innodb_ft_min_token_size >= 3`**
- If you want to search single/multi-char words (like "php"), change MySQL config:
  ```ini
  # In my.ini or my.cnf
  innodb_ft_min_token_size = 1
  ```
  Then restart MySQL and rebuild full-text index:
  ```sql
  ALTER TABLE snippets DROP INDEX idx_search;
  ALTER TABLE snippets ADD FULLTEXT INDEX idx_search (title, code, description);
  ```

### 2. File Upload
Upload all files in `snippet-manager/` to the subfolder on your server:
```
yourdomain.com/snippet-manager/
├── index.html
├── nginx.conf              ← Nginx location block config (see below)
├── api/
│   ├── snippets.php
│   ├── search.php
│   ├── tags.php
│   └── _headers.php       ← Security headers for PHP endpoints
├── config/
│   └── database.php
├── css/
├── js/
└── schema.sql
```

### 3. Nginx Configuration
Add this inside your `server {}` block in nginx config (e.g., `/etc/nginx/sites-available/default`):

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

    # Block dotfiles
    location ~ /\. { deny all; access_log off; log_not_found off; }

    # PHP-FPM for API
    location ~ ^/snippet-manager/api/.*\.php$ {
        alias /var/www/html/snippet-manager/api/;
        fastcgi_pass 127.0.0.1:9000;
        fastcgi_param SCRIPT_FILENAME $request_filename;
        fastcgi_param HTTPS on;
        include fastcgi_params;
    }

    # Block other PHP files (config, schema) from direct access
    location ~ ^/snippet-manager/(config|api) {
        location ~ \.php$ { deny all; }
    }
}
```

Test and reload:
```bash
nginx -t && systemctl reload nginx
```

### 4. Configure `config/database.php` for Production

**Option A: Environment Variables (recommended)**
Set environment variables for your web server:
```bash
# In PHP-FPM pool config (/etc/php/8.x/fpm/pool.d/www.conf)
env[DB_USER] = your_db_user
env[DB_PASS] = your_strong_password
systemctl restart php-fpm
```

**Option B: Direct values (fallback)**
Edit `config/database.php` and replace the defaults with production credentials.

### 5. Set Permissions (Linux)
```bash
chmod 644 api/*.php config/*.php schema.sql nginx.conf
chmod 755 api/ config/
chmod 600 config/database.php   # Database credential file
```

### 6. Testing Checklist
- [ ] Create snippet (POST /api/snippets.php) — works with all languages
- [ ] Edit snippet (PUT /api/snippets.php?id=X) — title/code/language/tags update correctly
- [ ] View single snippet (GET /api/snippets.php?id=X) — returns JSON with tags array
- [ ] List snippets (GET /api/snippets.php?limit=50&offset=0) — paginated
- [ ] Search by text (GET /api/snippets.php?q=test) — full-text search works
- [ ] Filter by tag (GET /api/snippets.php?tag=php) — returns filtered results
- [ ] Real-time jQuery search — debounce 300ms works
- [ ] Delete snippet (DELETE /api/snippets.php?id=X) — cascading deletes work
- [ ] Orphaned tag cleanup — tags without snippets get removed
- [ ] Download snippet as file — correct extension
- [ ] Copy code to clipboard — navigator.clipboard or execCommand fallback
- [ ] Syntax highlighting — hljs highlights all 15 languages
- [ ] Thai date formatting — formatDateTime() renders correctly

### 7. Security Notes
- ✅ SQL injection: Protected by PDO prepared statements
- ✅ XSS: Frontend escapes attribute values with `escapeAttr()`
- ✅ CSRF: Not implemented (assume single-user)
- ✅ Security headers: Applied via `_headers.php` + nginx config
- ⚠️ No authentication yet — **recommended to add login before public access**
- ✅ Directory listing blocked via nginx deny rules
- ✅ Error display disabled in production PHP settings

### 8. Recommended Next Steps
1. Add user authentication (login session)
2. Add rate limiting on API endpoints
3. Set `innodb_ft_min_token_size = 1` for single-char search
4. Run schema.sql with the new index
5. Set up HTTPS redirect in nginx