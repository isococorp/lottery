# Deploy — Docker บน Hostinger VPS + nginx reverse proxy

โครงเดียวกับ `srv1587663`: nginx เป็น reverse proxy ด้านหน้า, `web` (Next.js) และ `engine` (FastAPI)
วิ่งใน Docker network เดียวกัน — **ไม่ต้อง expose `engine` ออกสู่อินเทอร์เน็ต** (web เรียกภายในผ่าน `http://engine:8000`).

## 1. เตรียมเครื่อง

```bash
git clone <repo> tianming-lottery && cd tianming-lottery
cp .env.example .env      # ใส่ AUTH_SECRET, LINE_*, FACEBOOK_* (ถ้ามี)
```

## 2. ยก stack

```bash
docker compose up -d --build
docker compose exec web sh -c "cd /app && node -v"   # sanity
make import                                          # Excel -> Postgres (ครั้งแรก)
```

## 3. nginx (host)

```nginx
server {
  listen 443 ssl http2;
  server_name lottery.example.com;
  ssl_certificate     /etc/letsencrypt/live/lottery.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/lottery.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;   # rate-limit ใช้ค่านี้
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
# engine (8000) ไม่ต้องมี server block — เข้าถึงได้เฉพาะภายใน docker network
```

## 4. ความปลอดภัย (Phase 6)

- **Rate limiting:** `apps/web/middleware.ts` จำกัด 60 req/นาที/ไอพี บน `/api/*` (ใช้ `X-Forwarded-For` จาก nginx). Production หลายอินสแตนซ์ให้ย้ายไป Redis.
- **Security headers:** `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` ตั้งใน middleware.
- **Auth:** NextAuth v5 (`apps/web/auth.ts`) — provider เปิดเมื่อมี secret เท่านั้น (LINE/Facebook).
- **Excel export:** ชื่อไฟล์ ASCII อย่างเดียว + watermark ในทุกชีท (§7.4).
- **DB:** เปลี่ยนรหัส Postgres ใน `.env`/compose ก่อนขึ้น production.

## 5. อัปเดตข้อมูลใหม่

วางไฟล์ Excel ใหม่ที่ `data/thai.xlsx` แล้ว:
```bash
docker compose restart engine   # engine โหลดใหม่จาก data/
make import                      # sync เข้า Postgres
```
Import จะหยุดและรายงานถ้าเกรดคุณภาพเป็น D (guardrail #8 — ไม่วิเคราะห์ต่อบนข้อมูลเสีย).
