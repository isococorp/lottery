# BUILD PROMPT — ระบบสมาชิก (Membership) + Admin + Login + Full Audit Logging
### สำหรับ Claude Code · ระบบภายใน (Internal System)

> **สมมติฐานที่ใช้ (ปรับได้ถ้าไม่ตรง):** ระบบนี้ต่อยอดจาก stack เดิม (Next.js + Prisma + PostgreSQL) ใช้เป็นชั้น Auth/Admin ของโปรเจกต์ที่มีอยู่ (เช่น Tianming Lottery Analyzer) หรือแยกเป็นระบบอิสระก็ได้โดยใช้โครงเดียวกัน — เป็นระบบ**ภายใน**เท่านั้น ไม่เปิด public signup

---

## 0. เป้าหมายและหลักการ

1. Admin เพิ่ม/แก้ไข/ปิดการใช้งานสมาชิกได้ — **ไม่มีการสมัครสมาชิกเองจากหน้าเว็บ** (เพราะเป็นระบบภายใน)
2. มีหน้าจอ Login ที่ปลอดภัยตามมาตรฐาน (ไม่ใช่แค่เช็ค username/password ธรรมดา)
3. **เก็บ Log ให้ครบทุกอย่างที่เก็บได้** — เพราะเป็นระบบภายใน ความสำคัญอยู่ที่ตรวจสอบย้อนหลังได้ (audit trail) มากกว่าประสิทธิภาพสูงสุด
4. ทุก action ที่มีผลต่อข้อมูลต้องผูกกับ "ใครทำ เมื่อไหร่ จากที่ไหน" เสมอ — ห้ามมี action ที่ไม่มีเจ้าของ

---

## 1. บทบาทผู้ใช้ (Roles)

| Role | สิทธิ์ |
|---|---|
| `SUPER_ADMIN` | ทำได้ทุกอย่าง รวมถึงเพิ่ม/ลบ Admin คนอื่น, ดู Log ทั้งหมด, แก้ system settings |
| `ADMIN` | เพิ่ม/แก้ไข/ปิดใช้งานสมาชิก, ดู Log ของสมาชิกทั่วไป, จัดการข้อมูลระบบหลัก |
| `MEMBER` | เข้าใช้งานฟีเจอร์หลักของระบบตามสิทธิ์ที่ได้รับ, ไม่เข้าหน้า Admin |

> เก็บ Role เป็น enum ใน DB ไม่ hardcode ในโค้ด — ต้องขยาย role เพิ่มได้ในอนาคตโดยไม่แก้ schema

---

## 2. โครงสร้างข้อมูล (Data Model — Prisma Schema)

### 2.1 ตาราง User

```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  username      String    @unique
  passwordHash  String                          // argon2id — ห้าม plaintext หรือ MD5/SHA1 เด็ดขาด
  displayName   String
  role          Role      @default(MEMBER)
  status        UserStatus @default(ACTIVE)
  createdById   String?                         // admin คนที่สร้าง user นี้ (null เฉพาะ seed account แรกสุด)
  createdBy     User?     @relation("CreatedUsers", fields: [createdById], references: [id])
  createdUsers  User[]    @relation("CreatedUsers")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  lastLoginAt   DateTime?
  lastLoginIp   String?
  failedLoginCount Int    @default(0)
  lockedUntil   DateTime?                       // ล็อกชั่วคราวเมื่อ failed login เกินกำหนด
  mustChangePassword Boolean @default(true)     // บังคับเปลี่ยนรหัสรอบแรกที่ admin สร้างให้
  sessions      Session[]
  auditLogs     AuditLog[]
}

enum Role { SUPER_ADMIN ADMIN MEMBER }
enum UserStatus { ACTIVE SUSPENDED DISABLED }
```

### 2.2 ตาราง Session

```prisma
model Session {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  tokenHash   String   @unique                  // เก็บ hash ของ session token ไม่เก็บ token ดิบ
  ipAddress   String
  userAgent   String
  createdAt   DateTime @default(now())
  expiresAt   DateTime
  revokedAt   DateTime?                         // admin บังคับ logout ได้ (เขียนค่าตรงนี้)
}
```

### 2.3 ตาราง AuditLog — หัวใจของ requirement "เก็บ log ทั้งหมด"

```prisma
model AuditLog {
  id          BigInt   @id @default(autoincrement())
  timestamp   DateTime @default(now())
  userId      String?                           // null ได้ถ้าเป็น system event หรือ pre-auth event (เช่น login พลาด)
  user        User?    @relation(fields: [userId], references: [id])
  actorEmail  String?                           // เก็บซ้ำไว้เผื่อ user ถูกลบในอนาคต log ยังอ่านได้
  action      String                            // เช่น "LOGIN_SUCCESS", "LOGIN_FAILED", "USER_CREATE", "USER_UPDATE", "ROLE_CHANGE"
  targetType  String?                           // เช่น "User", "PredictionRecord", "BacktestJob"
  targetId    String?
  ipAddress   String
  userAgent   String
  method      String?                           // HTTP method
  path        String?                           // route/endpoint ที่เรียก
  statusCode  Int?
  beforeState Json?                             // ค่าก่อนแก้ (สำหรับ UPDATE/DELETE)
  afterState  Json?                             // ค่าหลังแก้
  metadata    Json?                             // เก็บอะไรก็ตามที่ไม่เข้าฟิลด์ข้างบน
  severity    LogSeverity @default(INFO)

  @@index([userId])
  @@index([action])
  @@index([timestamp])
}

enum LogSeverity { DEBUG INFO WARNING ERROR CRITICAL }
```

> **ห้าม** เก็บ `passwordHash`, session token ดิบ, หรือข้อมูลอ่อนไหวอื่นใน `beforeState`/`afterState`/`metadata` — ต้อง redact ก่อนเขียน log เสมอ (ดู §5.4)

---

## 3. หน้าจอ Login

### 3.1 ฟีเจอร์บังคับ
- ฟอร์ม email/username + password เท่านั้น (ไม่มีปุ่ม "สมัครสมาชิก")
- แสดง error message แบบไม่ระบุว่า "email ไม่มีในระบบ" หรือ "password ผิด" แยกกัน — ใช้ข้อความรวม **"อีเมลหรือรหัสผ่านไม่ถูกต้อง"** เสมอ (ป้องกัน user enumeration)
- Rate limiting: ล็อกอินผิด 5 ครั้งติดต่อกัน → ล็อกบัญชีชั่วคราว 15 นาที (`lockedUntil`) + เขียน `AuditLog` severity `WARNING`
- บังคับเปลี่ยนรหัสผ่านรอบแรกถ้า `mustChangePassword = true` (กรณี admin สร้าง user ใหม่ให้)
- Session timeout: หมดอายุอัตโนมัติหลังไม่มีการใช้งาน (ตั้งค่าได้ เริ่มต้น 8 ชั่วโมง เพราะเป็นระบบภายใน)

### 3.2 Flow

```
กรอก email/password → validate format
  → เช็ค user.status == ACTIVE (ไม่งั้น "บัญชีถูกระงับ ติดต่อผู้ดูแลระบบ" + log WARNING)
  → เช็ค lockedUntil (ไม่งั้น "บัญชีถูกล็อกชั่วคราว ลองใหม่ในอีก X นาที")
  → verify password ด้วย argon2id
     → ผิด: failedLoginCount += 1, log LOGIN_FAILED, ถ้าครบ 5 ครั้ง → set lockedUntil
     → ถูก: failedLoginCount = 0, สร้าง Session, log LOGIN_SUCCESS, redirect ตาม role
        (ADMIN/SUPER_ADMIN → /admin, MEMBER → /dashboard)
```

### 3.3 UI (ธีม Midnight Executive ตามมาตรฐานเอกสารบริษัท — Navy `#0A1F44` / Gold `#C9A24B` / Tahoma)

หน้า Login เรียบง่าย: โลโก้/ชื่อระบบ, ฟอร์ม 2 ช่อง, ปุ่ม "เข้าสู่ระบบ" สี Gold บนพื้น Navy, ลิงก์ "ลืมรหัสผ่าน" (เชื่อม flow reset ผ่าน admin เท่านั้น ไม่ใช่ email self-service เพราะระบบภายใน)

---

## 4. หน้าจอ Admin

### 4.1 จัดการสมาชิก (`/admin/users`)
- ตารางรายชื่อสมาชิกทั้งหมด: username, email, role, status, last login, สร้างโดยใคร
- ปุ่ม "เพิ่มสมาชิก" → ฟอร์ม email/username/displayName/role → ระบบ generate รหัสผ่านชั่วคราวแบบสุ่ม (ไม่ใช่ admin ตั้งเอง) แสดงครั้งเดียวให้ admin คัดลอกไปส่งให้สมาชิก + ตั้ง `mustChangePassword = true`
- แก้ไข role / status (ACTIVE ↔ SUSPENDED ↔ DISABLED)
- ปุ่ม "บังคับ Logout" (revoke sessions ทั้งหมดของ user นั้น)
- ปุ่ม "Reset รหัสผ่าน" (generate ใหม่ + บังคับเปลี่ยนรอบถัดไป)
- **SUPER_ADMIN เท่านั้น** ที่แก้ role เป็น `ADMIN`/`SUPER_ADMIN` ได้ หรือลบ user ถาวรได้

### 4.2 หน้า Audit Log Viewer (`/admin/logs`) — สำคัญที่สุดตาม requirement
- ตารางค้นหา/กรอง Log ได้ตาม: ช่วงเวลา, user, action, severity, target type
- แสดงรายละเอียด before/after state เมื่อคลิกดูแต่ละแถว (diff view)
- Export เป็น CSV/Excel ได้ (สำหรับตรวจสอบย้อนหลังหรือส่งผู้บริหาร)
- Pagination + index ครบตาม schema §2.3 (ห้าม query แบบสแกนทั้งตารางเมื่อข้อมูลเยอะ)
- **SUPER_ADMIN และ ADMIN เห็น log ได้** แต่ ADMIN ไม่เห็น log การกระทำของ SUPER_ADMIN ต่อบัญชี ADMIN คนอื่น (privacy ภายในทีม)

---

## 5. Logging Requirements — "เก็บทั้งหมดที่เก็บได้"

### 5.1 สองชั้นของ log (ต้องมีทั้งคู่ ไม่ใช่เลือกอย่างใดอย่างหนึ่ง)

| ชั้น | ที่เก็บ | วัตถุประสงค์ |
|---|---|---|
| **Database (`AuditLog` table)** | PostgreSQL | ใช้ query/filter/export ผ่าน UI §4.2 — โครงสร้างชัดเจน |
| **File log (rotating)** | `/var/log/app/` หรือ volume ที่ mount ไว้ | สำรองกรณี DB ล่ม/ถูกแก้ไข, ใช้ debug production, immutable กว่า DB record |

### 5.2 Events ที่ต้อง log (ครบทุกหมวดที่ระบบมี)

- **Auth events:** LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, SESSION_EXPIRED, ACCOUNT_LOCKED, PASSWORD_CHANGED, PASSWORD_RESET_BY_ADMIN
- **User management:** USER_CREATE, USER_UPDATE, USER_STATUS_CHANGE, ROLE_CHANGE, USER_DELETE, FORCE_LOGOUT
- **Data mutation ทั่วทั้งระบบ:** ทุก CREATE/UPDATE/DELETE บนตารางข้อมูลหลัก (เช่น PredictionRecord, BacktestJob ถ้าเชื่อมกับ Tianming Lottery Analyzer) — บันทึก beforeState/afterState เสมอ
- **API access:** ทุก request ไปยัง endpoint ที่ require auth (method, path, statusCode, response time)
- **System/Error events:** unhandled exception, failed DB connection, failed external API call — severity `ERROR`/`CRITICAL`
- **Admin actions พิเศษ:** export data, view audit log, change system settings

### 5.3 รูปแบบ File Log (structured JSON — สำคัญมากสำหรับการ grep/parse ย้อนหลัง)

```json
{"timestamp":"2026-08-20T10:15:32.123Z","level":"INFO","action":"LOGIN_SUCCESS","userId":"uuid","actorEmail":"user@internal","ip":"192.168.1.10","path":"/api/auth/login","statusCode":200}
```

- Rotation: รายวัน (`app-2026-08-20.log`) เก็บย้อนหลังอย่างน้อย 90 วัน (ปรับได้ตามพื้นที่ดิสก์จริง — ระบุ retention policy ชัดใน `.env`)
- ใช้ไลบรารีมาตรฐาน (Node: `pino`/`winston`, Python: `structlog`) — ห้ามเขียน custom logger เอง

### 5.4 Redaction Rules (บังคับ — ป้องกัน log รั่วข้อมูลอ่อนไหว)

ห้าม log ค่าต่อไปนี้แบบ raw เด็ดขาด ไม่ว่าจะอยู่ใน DB log หรือ file log:
- `passwordHash`, plaintext password ทุกกรณี
- Session token ดิบ (log ได้เฉพาะ hash หรือ token ID บางส่วน เช่น `tok_****last4`)
- ข้อมูลบัตรเครดิต/API key/secret ใด ๆ ที่หลุดเข้ามาใน request body

เขียน middleware กลาง `redactSensitiveFields()` ครอบทุกจุดที่เขียน log ไม่ใช่เขียนแยกทีละจุด (ป้องกันลืม)

### 5.5 ใครดู Log ได้บ้าง

- SUPER_ADMIN: ดูได้ทั้งหมด รวมถึง log การกระทำของ Admin คนอื่น
- ADMIN: ดู log ของ MEMBER และของตัวเองเท่านั้น
- MEMBER: ไม่มีสิทธิ์เข้าหน้า log เลย (แต่ระบบยัง log พฤติกรรมของ MEMBER ไว้ครบ)

---

## 6. ความปลอดภัย (บังคับ — ไม่ใช่ optional)

| หัวข้อ | ข้อกำหนด |
|---|---|
| Password hashing | **argon2id** เท่านั้น (ห้าม bcrypt cost ต่ำ, ห้าม MD5/SHA แบบ plain) |
| Password policy | ขั้นต่ำ 10 ตัวอักษร ผสมตัวเลข/ตัวอักษรใหญ่-เล็ก — บังคับตอนตั้งรหัสผ่านใหม่ |
| Session | เก็บ token แบบ httpOnly + secure + sameSite cookie เท่านั้น ห้ามเก็บใน localStorage |
| CSRF | ใช้ CSRF token กับทุก form ที่มีผลต่อข้อมูล (Next.js: ใช้ built-in หรือ `csrf` middleware) |
| Rate limiting | ทั้งระดับ login (§3.1) และระดับ API ทั่วไป (ป้องกัน brute force/scan) |
| Transport | บังคับ HTTPS ทุก environment แม้ internal — ไม่มีข้อยกเว้น |
| Least privilege | Route ฝั่ง admin ต้องเช็ค role ที่ **server-side middleware** เสมอ ห้ามเช็คแค่ฝั่ง UI (ซ่อนปุ่มไม่ใช่การป้องกัน) |

---

## 7. Guardrails สำหรับ Claude Code

1. **ห้าม hardcode รหัสผ่าน/role ใด ๆ ในโค้ด** — seed account แรก (SUPER_ADMIN) สร้างผ่าน migration script ที่อ่านค่าจาก `.env` (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` — สุ่ม temp password ถ้าไม่ระบุ แล้วบังคับเปลี่ยนรอบแรก)
2. **ทุก endpoint ที่แก้ไขข้อมูลต้องเขียน AuditLog ก่อน commit transaction เสร็จ** — ใช้ DB transaction ครอบทั้งคู่ (data change + log write) ป้องกันกรณี log เขียนไม่ทันแล้วข้อมูลเปลี่ยนไปแล้ว
3. **ห้าม log ข้อมูลอ่อนไหวแบบ raw** ตาม §5.4 — เขียน unit test เฉพาะเพื่อตรวจว่า log output ไม่มี `password`, `token` โผล่ออกมา
4. **Role check ต้องอยู่ server-side เสมอ** (middleware/route guard) — ทดสอบด้วยการยิง API ตรงข้าม role ที่ไม่มีสิทธิ์ ต้องได้ 403 เสมอ
5. เขียน test ครอบ: login สำเร็จ/ผิด/ล็อกบัญชี, admin สร้าง/แก้/ปิดสมาชิก, audit log ถูกสร้างครบทุก action ที่กำหนดใน §5.2
6. Log rotation + retention ต้องตั้งค่าได้ผ่าน `.env` ไม่ hardcode จำนวนวัน

---

## 8. Definition of Done

- [ ] Login ทำงานครบตาม flow §3.2 พร้อม rate limit + account lockout
- [ ] Admin เพิ่ม/แก้ไข/ปิดใช้งานสมาชิกได้ครบ, generate temp password อัตโนมัติ
- [ ] SUPER_ADMIN เท่านั้นแก้ role เป็น ADMIN/SUPER_ADMIN ได้
- [ ] AuditLog บันทึกครบทุก event ใน §5.2 ทั้ง DB และ file log (สอง format ตรงกัน)
- [ ] Redaction ทำงานถูกต้อง (unit test ผ่าน — ไม่มี password/token หลุดใน log)
- [ ] หน้า Audit Log Viewer กรอง/ค้นหา/export ได้ตาม §4.2
- [ ] Role-based access control ป้องกันที่ server-side ทุก route ผ่านการทดสอบยิง API ตรง
- [ ] Session timeout และ force-logout ทำงานถูกต้อง
- [ ] ธีม UI ตรงมาตรฐาน Midnight Executive (Navy/Gold/Tahoma)
