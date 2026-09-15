# Deploy — Docker บน Hostinger VPS + nginx reverse proxy

nginx (host) เป็น reverse proxy ด้านหน้า → `lottery-web` ที่ bind **127.0.0.1:3001** เท่านั้น.
`lottery-engine` ไม่ publish port เลย — web เรียกภายในผ่าน `http://lottery-engine:8000`.

**ไม่มี service postgres ใน compose** — ใช้คอนเทนเนอร์ `bazi-db` ที่รันอยู่แล้ว ผ่าน external
network `bazi_baznet`.

## 1. เตรียมเครื่อง

```bash
git clone <repo> tianming-lottery && cd tianming-lottery
cp .env.example .env      # ใส่ DATABASE_URL, AUTH_SECRET, LINE_*, FACEBOOK_* (ถ้ามี)
```

`DATABASE_URL` ต้องชี้ไป `bazi-db` ผ่าน network ภายใน (ไม่ใช่ localhost):

```
DATABASE_URL=postgresql://tianming:<password>@bazi-db:5432/tianming?schema=public
```

compose ใช้ `${DATABASE_URL:?}` / `${AUTH_SECRET:?}` — ถ้าลืมตั้งจะ fail ทันที ไม่ยกขึ้นครึ่ง ๆ กลาง ๆ

ตรวจว่า network มีจริงและ `bazi-db` ต่ออยู่:

```bash
docker network inspect bazi_baznet --format '{{range .Containers}}{{.Name}} {{end}}'
# ถ้ายังไม่มี bazi-db ในรายการ:
docker network connect bazi_baznet bazi-db
```

## 2. ยก stack

```bash
docker compose up -d --build
docker compose ps                                    # lottery-web, lottery-engine ต้อง healthy
curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/; echo   # คาดหวัง 307 -> /login
make import                                          # Excel -> Postgres (ครั้งแรก)
```

> ⚠️ `make import` รัน `prisma migrate dev` ซึ่งบน database ที่มีตารางอยู่แล้วแต่ไม่มี migration
> history จะ **reset database ทิ้ง**. `bazi-db` มีข้อมูลของแอปอื่นอยู่ — ให้ใช้ database/schema
> แยกสำหรับ tianming และ backup ก่อนเสมอ.

## 3. nginx (host)

```nginx
server {
  listen 443 ssl http2;
  server_name maoshan8.com www.maoshan8.com;
  ssl_certificate     /etc/letsencrypt/live/maoshan8.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/maoshan8.com/privkey.pem;

  location / {
    # ต้องเป็น 3001 — ตรงกับ ports: ของ lottery-web ใน compose.
    # ถ้า vhost นี้ถูกก๊อปมาจากโดเมนอื่นบนเครื่องเดียวกัน ให้เช็ค port ตรงนี้ก่อน:
    # ชี้ผิด = โดเมนนี้จะเสิร์ฟเนื้อหาของแอปอีกตัวทั้งที่ใบเซอร์ถูกต้อง
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;   # rate-limit ใช้ค่านี้
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
# engine (8000) ไม่ต้องมี server block — ไม่ได้ publish port ออกจาก docker เลย
```

ตรวจหลัง reload ว่าโดเมนนี้เสิร์ฟแอปตัวเอง ไม่ใช่ของโดเมนอื่นที่อยู่เครื่องเดียวกัน:

```bash
nginx -t && systemctl reload nginx
curl -s https://www.maoshan8.com/login | grep -o '<title>[^<]*</title>'
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
docker compose restart engine    # engine โหลดใหม่จาก data/
make import                      # sync เข้า Postgres
```
Import จะหยุดและรายงานถ้าเกรดคุณภาพเป็น D (guardrail #8 — ไม่วิเคราะห์ต่อบนข้อมูลเสีย).
