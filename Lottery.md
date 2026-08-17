# MASTER BUILD PROMPT — Tianming Lottery Analyzer
### สำหรับ Claude Code · ใช้คู่กับไฟล์ `System_Spec_Tianming_Lottery_Analyzer_v3_1.md` (Requirements) เสมอ

> **วิธีใช้:** วางไฟล์นี้ + ไฟล์ spec v3_1 + ไฟล์ข้อมูล Excel ไว้ที่ root ของ repo แล้วสั่ง Claude Code เริ่มจาก PHASE 0 ทีละเฟส ห้ามข้ามเฟส — ทุกเฟสมี Definition of Done (DoD) ที่ต้องรัน test ผ่านก่อนไปเฟสถัดไป

---

## A. MISSION

สร้างระบบ **Tianming Lottery Analyzer** ตาม spec v3_1 ทั้งฉบับ โดยมีสาระสำคัญ:

1. เครื่องคำนวณตัวเลข 7 ค่า (3 ตัวบน, 2 ตัวบน, 2 ตัวล่าง, 3 ตัวล่าง ชุด 1–4) จาก 5 ศาสตร์ (§4.1–4.5) โดยกรอกวันที่+เวลา
2. ระบบ Backtest แบบ walk-forward สองโหมด (ตรงเป๊ะ / สลับตำแหน่ง) พร้อม p-value, Bootstrap CI, export Excel
3. วินัย V5 (§4.21) บังคับใช้กับทุกเอาต์พุตสถิติ
4. **จุดยืนของระบบ (ห้ามละเมิด):** ระบบนี้พิสูจน์แล้วด้วยข้อมูลจริง 708 งวดว่าไม่มีศาสตร์ใดพยากรณ์ผลได้เกินระดับสุ่ม — ทุกหน้าจอที่แสดงตัวเลขต้องมีคำเตือนตาม spec §0 และผล backtest ประกบเสมอ ห้ามสร้าง UI ที่สื่อว่า "ระบบใบ้เลขแม่น"

### Tech Stack (ตาม spec §7)

| Layer | เทคโนโลยี | หมายเหตุ |
|---|---|---|
| Frontend/BFF | Next.js 14+ (App Router, TypeScript, Tailwind) | เจ้าของ DB connection ผ่าน Prisma |
| Engine | Python 3.11+ FastAPI | สูตรทั้งหมดอยู่ที่นี่เท่านั้น (anti-copy §7.4) ห้ามมีสูตรใน frontend |
| DB | PostgreSQL 16 + Prisma ORM | Excel เป็น import source เท่านั้น |
| ปฏิทินจีน | **ไลบรารี `sxtwl` (pip)** | บังคับใช้ใน engine — ห้ามเขียนสูตร solar term เอง (สูตร JDN ประมาณการใช้ได้เฉพาะ fallback ฝั่ง JS พร้อม caveat) |
| Excel | `openpyxl` | ธีม Navy `#0A1F44` / Gold `#C9A24B` / Tahoma |
| สถิติ | `scipy`, `numpy`, `pandas` | binomtest, bootstrap |

### โครงสร้าง Repo (monorepo)

```
tianming-lottery/
├── apps/web/                  # Next.js (UI + Prisma + API routes เรียก engine)
├── services/engine/           # FastAPI (สูตรทั้งหมด + backtest + export)
│   ├── app/schools/           # school_bazi.py, school_thai.py, school_numerology.py,
│   │                          # school_stats_wf.py, school_other.py
│   ├── app/core/              # pillars.py (sxtwl wrapper), power.py, hetu.py
│   ├── app/backtest/          # walkforward.py, baselines.py, metrics.py, audit.py
│   ├── app/protocol/          # v5_gate.py (Self-Check 18 ข้อ, Failure States, Confidence)
│   └── tests/                 # golden tests (ดู §C) — เขียนก่อนโค้ดเสมอ (TDD)
├── packages/db/               # Prisma schema + import script (Excel → Postgres)
├── data/                      # ไฟล์ Excel ต้นฉบับ (audit trail อ่านอย่างเดียว)
└── docker-compose.yml         # postgres + engine + web
```

---

## B. EXECUTION PLAN — 6 PHASES

### PHASE 0 — Scaffold & Golden Tests (ทำก่อนทุกอย่าง)
- ตั้ง monorepo ตามโครงข้างบน, docker-compose (postgres), CI script `make test`
- **เขียน golden tests จาก §C.9 ลง `services/engine/tests/test_golden.py` ก่อนเขียนสูตรใด ๆ** — นี่คือ TDD บังคับตาม spec §3.1
- **DoD:** `pytest` รันได้ (ทุก test fail อย่างถูกต้องเพราะยังไม่มี implementation), docker-compose up ได้

### PHASE 1 — Data Layer
- Prisma schema ตาม spec §2.1–2.2 (ทุกเลขเป็น `String`/char — **Leading Zero กฎเหล็ก §4.21.4**)
- Import script: อ่าน Excel (sheet `ผลออกรางวัลย้อนหลัง`, ข้าม header 4 แถวแรก, คอลัมน์: วันที่, เลข6หลัก, 3ตัวบน, 2ตัวล่าง, หน้า3ตัว×2, ท้าย3ตัว×2, เวลา) → validate ตาม §4.21.5 → upsert Postgres → พิมพ์ Data Quality Report + เกรด A–D
- **ข้อมูลจริงมีลักษณะ:** ~708 งวด (16 ม.ค. 1996 – ปัจจุบัน), งวดก่อนปี 2015 คอลัมน์ `f3b` (หน้า3ตัว ชุด2) เป็นค่าว่างตามกติกายุคนั้น (~446 งวด) — ต้อง nullable และไม่นับในสถิติของชุดนั้น
- **DoD:** import แล้ว row count ตรงกับไฟล์, ไม่มีเลขเสีย leading zero (spot check `01`, `007`), Quality Report แสดงถูกต้อง

### PHASE 2 — Chinese Calendar Core + BaZi Power (หัวใจของระบบ)
- `core/pillars.py`: wrapper รอบ sxtwl คืนสี่เสา (ปี/เดือน/วัน/ชั่วโมง) — hour stem คำนวณเองตามสูตร §C.3 (sxtwl ให้ day GZ แม่น ใช้เป็นฐาน)
- `core/power.py`: พลังวันตาม Matrix §C.4 — แถว A/B ตาม §C.5
- **DoD: golden tests §C.9 ผ่านครบทุกตัว** โดยเฉพาะ `2026-08-16 16:00 → 壬戌, A=-4, B=+1, รวม=-3` และ `2026-08-01 16:00 → 丁未, A=+1, B=-5, รวม=-4` — ถ้าไม่ผ่าน ห้ามไปต่อเด็ดขาด

### PHASE 3 — 5 Schools Number Generation
- implement 5 ศาสตร์ตามสูตร deterministic ใน §C.6–C.8 เป๊ะ ๆ (อย่าออกแบบใหม่ — สูตรเหล่านี้ผ่านการ backtest แล้ว การเปลี่ยนสูตรจะทำให้ผลไม่ reproducible)
- ทุกศาสตร์คืน 7 ค่า + `factors_json` (ปัจจัยประกอบตาม spec §3)
- FastAPI endpoint: `POST /predict {date, time}` → ผลครบ 5 ศาสตร์ + สี่เสา + พลังวัน
- **DoD:** เรียกซ้ำวันเดิมได้ผลเหมือนเดิม 100% (determinism test), factors ครบตาม spec §3

### PHASE 4 — Backtest Engine
- `backtest/walkforward.py`: สองโหมดตาม spec §6.2 — exact และ permutation (digit multiset)
- เส้นฐานสุ่มตาม spec §6.3 (สูตรอยู่ที่ §C.10 — **บั๊กที่เคยเกิดจริง:** ลืมยกกำลัง k จำนวนชุดผลจริง ทำให้ p-value เป็น 0 ทั้งแถว — มี regression test กันไว้)
- Binomial p-value + **Bootstrap 95% CI (resample 2,000 รอบ)** + เกณฑ์ "ชนะการสุ่ม" = CI-low > baseline (spec §6.3.1)
- ชุดสถิติ walk-forward: เรียนรู้จากข้อมูลก่อนงวดประเมินเท่านั้น (warm-up 100 งวดแรก)
- Baselines 5 ชุด (§4.21.6), metrics ครบ (§4.21.10)
- Export Excel 3 ชีท ธีม Navy/Gold/Tahoma: สรุปผล (พร้อม CI + สถานะชนะสุ่ม) / รายละเอียดรายงวด (ไฮไลต์เขียว ✓) / วิธีการและข้อสรุป
- **DoD:** รัน backtest เต็ม 708 งวดแล้วผลตรงกับค่าอ้างอิง §C.11 (±ปัดเศษ), export Excel เปิดได้ ชื่อไฟล์ ASCII เท่านั้น (เคยมีปัญหา encoding ชื่อไฟล์ไทย)

### PHASE 5 — V5 Protocol Layer + Web UI
- `protocol/v5_gate.py`: Self-Check 18 ข้อ, Failure States 6 สถานะ, Confidence Tiers, Banned Phrases filter, Model Status READY/PARTIAL/NOT RUN (spec §4.21)
- Next.js UI: หน้า Calculator (กรอกวันเวลา → ตาราง 5 ศาสตร์ × 7 ค่า + ปัจจัย + คำเตือน), หน้า Backtest (เลือกช่วงวันที่ + โหมด toggle + ปุ่ม Export), หน้า Audit ("ตรวจระบบ" §4.21.18)
- ทุกหน้าที่มีตัวเลขต้องมี: คำเตือนบังคับ (spec §0), ผล backtest ล่าสุดประกบ, ป้ายแยกชั้น 2/ชั้น 3 (Layered Framework)
- **DoD:** ผ่าน checklist spec §8 ครบทุกข้อ

### PHASE 6 — Hardening
- Rate limiting, auth (NextAuth v5 — โครงการนี้มี LINE/Facebook OAuth อยู่แล้วใน Tianming Ge ใช้ pattern เดียวกัน), watermark ใน Excel export (§7.4)
- README + วิธี deploy (Docker บน Hostinger VPS — nginx reverse proxy pattern เดียวกับ srv1587663)

---

## C. VERIFIED ALGORITHM APPENDIX (สูตรที่ตรวจสอบแล้ว — ห้ามแก้โดยไม่รัน golden tests)

> ทุกสูตรในหมวดนี้ผ่านการตรวจสอบกับปฏิทินจีนมาตรฐาน (sxtwl) และค่าอ้างอิงจากโปรแกรม bazi ต้นทางแล้ว Claude Code ต้อง implement ตามนี้ตรง ๆ

### C.1 ค่าคงที่พื้นฐาน

```python
Gan   = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"]
Zhi   = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"]
GanTH = ["กะ","อิก","เปี้ย","เต็ง","โบ่ว","กี้","แก","ซิง","ยิ่ม","กุ่ย"]   # แต้จิ๋ว
ZhiTH = ["ชวด","ฉลู","ขาล","เถาะ","มะโรง","มะเส็ง","มะเมีย","มะแม","วอก","ระกา","จอ","กุน"]
SE = ["ไม้","ไม้","ไฟ","ไฟ","ดิน","ดิน","ทอง","ทอง","น้ำ","น้ำ"]        # ธาตุกิ่งฟ้า (stem→element)
BE = ["น้ำ","ดิน","ไม้","ไม้","ดิน","ไฟ","ไฟ","ดิน","ทอง","ทอง","ดิน","น้ำ"] # ธาตุกิ่งดิน (branch→element)
HETU = {"น้ำ":(1,6), "ไฟ":(2,7), "ไม้":(3,8), "ทอง":(4,9), "ดิน":(5,0)}    # เลขเหอถู 河圖 (10→0)
# หยาง (stem index คู่) ใช้เลขตัวแรก, หยิน (คี่) ใช้เลขตัวหลัง
KAMLANG = {"อาทิตย์":6,"จันทร์":15,"อังคาร":8,"พุธ":17,"พฤหัสบดี":19,"ศุกร์":21,"เสาร์":10}
DAONUM  = {"อาทิตย์":1,"จันทร์":2,"อังคาร":3,"พุธ":4,"พฤหัสบดี":5,"ศุกร์":6,"เสาร์":7}
```

### C.2 กานจือรายวัน (Day Pillar) — ใช้ sxtwl ใน production / สูตร JDN เป็น fallback JS

```python
# Production (engine): day = sxtwl.fromSolar(y,m,d); dg = day.getDayGZ()  → dg.tg (stem), dg.dz (branch)
# Fallback/JS (ตรวจสอบตรงกับ sxtwl แล้วทุกวันที่ทดสอบ):
def jdn(y,m,d):
    a=(14-m)//12; yy=y+4800-a; mm=m+12*a-3
    return d + (153*mm+2)//5 + 365*yy + yy//4 - yy//100 + yy//400 - 32045
day_stem   = (jdn(y,m,d) + 9) % 10
day_branch = (jdn(y,m,d) + 1) % 12
```

### C.3 เสาปี/เดือน/ชั่วโมง

```python
# ปี: เปลี่ยนที่ลี่ชุน — production ใช้ sxtwl.getYearGZ(); JS fallback: ตัดที่ 4 ก.พ.
solar_year = y-1 if (m<2 or (m==2 and d<4)) else y
year_stem, year_branch = (solar_year-4)%10, (solar_year-4)%12

# เดือน: เปลี่ยนที่ jie (節) — production ใช้ sxtwl.getMonthGZ()
# JS fallback (jieDOM = วันโดยประมาณของ jie แต่ละเดือน — คลาดได้ ±1 วันใกล้รอยต่อ ต้อง caveat ใน UI):
jieDOM = [6,4,6,5,6,6,7,8,8,8,7,7]
sm = m if d >= jieDOM[m-1] else m-1;  sm = 12 if sm==0 else sm
month_branch = sm % 12                        # ★ ระวัง: ไม่ใช่ (sm+1)%12 — เคยเป็นบั๊กจริง
first_month_stem = {0:2,5:2, 1:4,6:4, 2:6,7:6, 3:8,8:8, 4:0,9:0}[year_stem]  # 甲己→丙寅 ...
month_stem = (first_month_stem + (month_branch-2)%12) % 10

# ชั่วโมง: hb จากเวลา, hour stem จาก day stem (五鼠遁)
hour_branch = ((hh+1)%24)//2                  # 16:00 → 申 (index 8) เสมอสำหรับหวยไทย
hs0 = {0:0,5:0, 1:2,6:2, 2:4,7:4, 3:6,8:6, 4:8,9:8}[day_stem]   # 甲己→甲子 ...
hour_stem = (hs0 + hour_branch) % 10
```

### C.4 BaZi Power Scoring Matrix (จากโปรแกรม bazi ต้นทาง — ค่าอ้างอิงยืนยันแล้ว)

```python
MX = {  # MX[ธาตุเจ้าชะตา][ธาตุเป้าหมาย] = คะแนน
 "ไฟ":  {"ไม้":+2,"ไฟ":+1,"ดิน":-2,"ทอง":-2,"น้ำ":-2},
 "ดิน": {"ไฟ":+2,"ดิน":+1,"ไม้":-1,"ทอง":-2,"น้ำ":-2},
 "ทอง": {"ดิน":+2,"ทอง":+1,"ไฟ":-1,"ไม้":-2,"น้ำ":-2},
 "น้ำ": {"ทอง":+2,"น้ำ":+1,"ดิน":-2,"ไม้":-2,"ไฟ":-1},
 "ไม้": {"น้ำ":+2,"ไม้":+1,"ไฟ":-2,"ดิน":-2,"ทอง":-2},
}
```

### C.5 สูตรพลังวัน (Day Power)

```python
dm = SE[day_stem]                                   # ธาตุเจ้าชะตา
A = MX[dm][SE[hour_stem]] + MX[dm][SE[month_stem]] + MX[dm][SE[year_stem]]   # กิ่งฟ้า: ชม+เดือน+ปี (ไม่รวมวัน)
B = MX[dm][BE[hour_branch]] + MX[dm][BE[day_branch]] + MX[dm][BE[month_branch]] + MX[dm][BE[year_branch]]  # กิ่งดินทั้ง 4 เสา
power = A + B
# แสดงผลรูปแบบ: "{ธาตุ}{GanTH[day_stem]} {power:+d}"  เช่น "น้ำยิ่ม -3"
```

### C.6 ศาสตร์ 4.1 ดวงจีน — สูตรสร้างเลข

```python
def hetu(elem, is_yang): return HETU[elem][0] if is_yang else HETU[elem][1]
dmD   = hetu(SE[day_stem],  day_stem%2==0)
seatD = hetu(BE[day_branch], day_branch%2==0)
pwD   = power % 10                                   # Python modulo (ผลลบ→บวกอัตโนมัติ)
top3    = f"{dmD}{seatD}{pwD}"
bottom2 = f"{dmD}{(power+10)%10}"
top2    = f"{seatD}{pwD}"                            # ส่วนขยาย: เลข 2 ตัวบนใช้คู่ seat+power
set3 = [ f"{hetu(SE[hour_stem],hour_stem%2==0)}{hetu(BE[hour_branch],hour_branch%2==0)}{dmD}",
         f"{hetu(SE[month_stem],month_stem%2==0)}{hetu(BE[month_branch],month_branch%2==0)}{dmD}",
         f"{hetu(SE[year_stem],year_stem%2==0)}{hetu(BE[year_branch],year_branch%2==0)}{seatD}",
         f"{pwD}{(A+10)%10}{(B+10)%10}" ]
```

### C.7 ศาสตร์ 4.2 ดวงไทย · 4.3 เลขศาสตร์ · 4.5 ศาสตร์อื่น

```python
# 4.2 ดวงไทย: dao=DAONUM[วัน], kl=KAMLANG[วัน], yam=(hour_branch+1)%10
top3=f"{dao}{kl:02d}"; bottom2=f"{dao}{kl%10}"; top2=f"{dao}{yam}"
set3=[f"{(dao*100+kl)%1000:03d}", f"{(kl*10+dao)%1000:03d}", f"{dao}{yam}{kl%10}", f"{(dao+kl+yam)%1000:03d}"]

# 4.3 เลขศาสตร์วัน-เวลา: be=ปีพ.ศ., yy2=be%100, r=digit_root(d+m+be), mi=นาที
top3=f"{(d*m*r)%1000:03d}"; bottom2=f"{(d+m+yy2+hh)%100:02d}"; top2=f"{(d+m+r)%100:02d}"
set3=[f"{(d*100+m*10+r)%1000:03d}", f"{(yy2*10+r)%1000:03d}", f"{(d*m+hh*mi)%1000:03d}", f"{((d+m)*(hh+1))%1000:03d}"]

# 4.5 ศาสตร์อื่น: J=jdn(y,m,d); lo=J%9+1 (โหลวซู); ma=round((J-2451550.1)%29.53)%30 (อายุจันทร์); lp=digit_root(d+m+y ค.ศ.)
top3=f"{lo}{ma%100:02d}"; bottom2=f"{(lo*10+lp)%100:02d}"; top2=f"{(lo+ma)%100:02d}"
set3=[f"{(lo*100+ma)%1000:03d}", f"{(lp*100+lo*10+ma%10)%1000:03d}", f"{(ma*10+lp)%1000:03d}", f"{(lo+lp+ma)%1000:03d}"]
```

### C.8 ศาสตร์ 4.4 สถิติ Walk-forward

ทายแต่ละงวดด้วยข้อมูลก่อนหน้าเท่านั้น (แยก state ตามวันในสัปดาห์): bottom2 = ค่าที่ออกบ่อยสุด, top3 = หลักที่บ่อยสุดรายตำแหน่ง, set3 = 4 อันดับแรกของเลข 3 ตัวรวมทุกคอลัมน์ — warm-up: เริ่มประเมินหลังงวดที่ 100 และมีข้อมูล ≥10 งวดของวันนั้น

### C.9 GOLDEN TEST VECTORS (ต้องผ่านทุกตัวก่อน merge ทุกครั้ง)

| Input (เวลา 16:00) | สี่เสา (ปี เดือน วัน ชม.) | เจ้าชะตา | A | B | รวม |
|---|---|---|---|---|---|
| 2026-08-16 | 丙午 丙申 壬戌 戊申 | น้ำยิ่ม (壬) | −4 | +1 | **−3** |
| 2026-08-01 | 丙午 乙未 丁未 戊申 | ไฟเต็ง (丁) | +1 | −5 | **−4** |
| 2026-01-17 | 乙巳 己丑 辛卯 丙申 | ทองซิง (辛) | −1 | 0 | **−1** |
| 1996-01-16 | 乙亥 己丑 壬子 戊申 | น้ำยิ่ม (壬) | −6 | +2 | **−4** |

เพิ่มเติม: ทดสอบ determinism (เรียกซ้ำ 100 ครั้งได้ผลเดิม), leading zero (เลข `007`, `01` ไม่เพี้ยน)

### C.10 เส้นฐานสุ่มของ Backtest (ระวังบั๊กที่เคยเกิดจริง)

```python
from itertools import permutations
def perm_count(s): return len(set(permutations(s)))     # "55"→1, "53"→2, "555"→1, "553"→3, "531"→6
# โหมด exact:      p_b2 = 1/100,  p_t3 = 1/1000
# โหมด permutation: p_b2 = perm_count(pred)/100,  p_t3 = perm_count(pred)/1000
# เลข 3 ตัว 4 ชุดทาย เทียบผลจริง k ชุด (k=จำนวนชุดจริงที่มีข้อมูลของงวดนั้น ≤4):
p_any = 1 - prod((1 - perm_count(x)/1000)**k for x in predicted_set3)   # ★ ต้องยกกำลัง k — เคยลืมแล้ว p-value พังทั้งตาราง
```

### C.11 ค่าอ้างอิงผล Backtest (สำหรับ regression test — โหมด permutation, เต็ม 708 งวด)

| ศาสตร์ | ถูก 2ล่าง | อัตรา | p-value | หมายเหตุ |
|---|---|---|---|---|
| ดวงจีน | 20/708 | 2.82% | ≈0.096 | ไม่มีนัยสำคัญ |
| ดวงไทย | 11/708 | 1.55% | ≈0.501 | " |
| เลขศาสตร์ | 18/708 | 2.54% | ≈0.211 | " |
| สถิติ WF | 17/608 | 2.80% | ≈0.189 | เริ่มหลัง warm-up 100 งวด |
| ศาสตร์อื่น | 12/708 | 1.69% | ≈0.890 | " |

ผล implementation ใหม่ต้องได้ตัวเลข "ถูก/จำนวนงวด" ตรงเป๊ะ (deterministic) — p-value ตรงในระดับปัดเศษ ถ้าไม่ตรง = สูตรผิด ห้าม tune จนตรง ให้หาสาเหตุ

---

## D. GUARDRAILS สำหรับ CLAUDE CODE (สรุปวินัย V5 ที่กระทบการเขียนโค้ดโดยตรง)

1. **TDD บังคับ:** golden tests §C.9 ต้องเขียนและรันก่อน implement ทุก PHASE — สูตรใดแก้แล้ว golden test ไม่ผ่าน = revert
2. **เลขหวยเป็น string ทุกจุดใน pipeline** ไม่ใช่แค่ใน DB (§4.21.4)
3. **ห้ามใส่สูตรใด ๆ ในโค้ด frontend** — Next.js เรียก engine ผ่าน API เท่านั้น (spec §7.4)
4. **Walk-forward เท่านั้น** — ห้าม random train/test split, ห้าม full-dataset normalization/PMI/Markov ใน backtest (§4.21.9)
5. **ห้ามสร้างผลลัพธ์ปลอม:** โมเดล/ฟีเจอร์ที่ยังไม่ implement ให้คืนสถานะ `NOT AVAILABLE` จริง ๆ ห้าม mock ค่าแล้วแสดงเหมือนคำนวณจริง (§4.21.17-B)
6. **ทุก endpoint ที่คืนตัวเลขต้องแนบ:** confidence tier, คำเตือนบังคับ, และ backtest summary ล่าสุด — บังคับที่ API layer ไม่ใช่หวังพึ่ง UI
7. **ชื่อไฟล์ export เป็น ASCII เท่านั้น** (ปัญหา encoding ชื่อไฟล์ไทยเคยทำให้ผู้ใช้โหลดไฟล์ไม่ได้จริง) — ชื่อไทยใส่ในหัวตารางในชีทแทน
8. **ห้ามข้ามขั้นตอน validation เพื่อให้ได้ตัวเลขเร็วขึ้น** (V5 Master Principle) — ถ้าข้อมูล import ไม่ผ่าน quality gate ให้หยุดและรายงาน ไม่ใช่วิเคราะห์ต่อ
9. เมื่อเจอความกำกวมใน spec: **ถามหรือระบุสมมติฐานชัดเจนใน PR description** ห้ามเดาเงียบ ๆ (§4.21.3)
10. Commit แยกตาม PHASE, ทุก commit ต้อง `make test` เขียว

---

## E. ORDER OF READING สำหรับ CLAUDE CODE

1. อ่านไฟล์นี้ทั้งหมด (สูตร §C คือ source of truth)
2. อ่าน spec v3_1 §0–§3 (หลักการ+data model), §6 (backtest), §7 (สถาปัตยกรรม), §8 (checklist)
3. §4.4-EXT และ §4.6–4.20 ใน spec เป็น **backlog อนาคต** — PHASE 1–6 ยังไม่ต้อง implement นอกเหนือจาก 5 ศาสตร์หลัก อย่าหลงไป build ทั้ง catalog
4. §4.21 (V5 Protocol) implement เป็น `protocol/v5_gate.py` ใน PHASE 5 — เน้น Self-Check, Failure States, Confidence, Banned Phrases ก่อน ส่วน Audit Mode แบบเต็มทำเท่าที่ infrastructure รองรับ แล้ว mark ที่เหลือเป็น NOT AVAILABLE ตามจริง
