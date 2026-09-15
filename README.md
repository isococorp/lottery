# Tianming Lottery Analyzer

เครื่องมือ **ทดลองเชิงสถิติเพื่อการศึกษา** ที่คำนวณตัวเลขจาก 5 ศาสตร์ และ **ทดสอบย้อนหลัง** (walk-forward)
เพื่อพิสูจน์ว่าไม่มีศาสตร์ใดพยากรณ์ผลสลากได้เกินระดับสุ่ม — ยืนยันด้วยข้อมูลจริง **708 งวด** (16 ม.ค. 2539 – 16 ส.ค. 2569).

> ⚠️ ระบบนี้ไม่ใช่ "เครื่องใบ้เลขแม่น" ทุกหน้าจอที่มีตัวเลขจะแนบคำเตือนและผล backtest เสมอ (V5 Protocol).

## สถาปัตยกรรม (monorepo)

```
services/engine/   FastAPI (Python 3.11) — สูตรทั้งหมดอยู่ที่นี่เท่านั้น (anti-copy §7.4)
  app/core/        pillars.py (sxtwl), power.py, constants.py
  app/schools/     5 ศาสตร์: bazi, thai, numerology, stats_wf, other
  app/backtest/    walkforward, baselines, metrics, export (Excel Navy/Gold/Tahoma)
  app/protocol/    v5_gate.py (Self-Check 18, Failure States, Confidence, Banned Phrases)
  tests/           golden tests §C.9 + backtest regression §C.11
apps/web/          Next.js 14 (App Router, TS, Tailwind) — BFF เรียก engine, ไม่มีสูตรใน frontend
packages/db/       Prisma schema + import script (Excel → Postgres) + Data Quality Report
data/              thai.xlsx (audit source, อ่านอย่างเดียว)
docker-compose.yml postgres + engine + web
```

**สูตร source of truth:** `Lottery.md §C` — ทุกสูตร deterministic ผ่าน golden tests แล้ว ห้ามแก้โดยไม่รัน test.

## Quick start

```bash
# 1) รัน engine test suite (golden §C.9 + backtest §C.11 + api) ใน Docker
make test

# 2) ยกทั้ง stack (postgres + engine + web)
make up
#    web:    http://localhost:3000
#    engine: http://localhost:8000  (docs: /docs)

# 3) import Excel → Postgres (หลัง up)
make import
```

## จุดตรวจสอบสำคัญ (verified)

| การทดสอบ | ผล |
|---|---|
| Golden §C.9 (สี่เสา + พลังวัน) | ✅ ผ่านครบ (เช่น 2026-08-16 → 壬戌, A=−4, B=+1, รวม −3; 2026-01-02 → 丙午 ไฟเปี้ย −5 ตามกฎ 小雪) |
| Determinism (เรียกซ้ำ 100 ครั้ง) | ✅ ผลเดิม |
| Leading zero (string ทุกจุด) | ✅ |
| Backtest §C.11 (permutation, ถูก 2 ล่าง) | ✅ 17/708, 11/708, 18/708, 17/608, 12/708 (ดวงจีน = 17 ตามเสาปี 28 พ.ย. = d:\bazi; เดิม 20 ที่ลี่ชุน) |
| p-value §C.11 (binomial two-sided) | ✅ 0.334 / 0.501 / 0.211 / 0.189 / 0.890 |
| ชนะการสุ่ม (CI-low > baseline) | ✅ ทุกศาสตร์ = ไม่ (สอดคล้องจุดยืนระบบ) |

**ศาสตร์ Production ปัจจุบัน = 18 วิชา:** §4.1–4.20 (ยกเว้น §4.13/4.14) — mapping ที่อนุมัติแล้ว
มี golden test + ผ่าน backtest §6, ทั้งหมด win=False.
§4.6/4.10/4.11 = faithful 排盤 · §4.7 = **排盤เต็ม (拆補: 節氣三元局+符頭+值符/值使)** ·
§4.8 = **四課ครบ + 三傳** (月將ตาม中氣; 賊剋/比用/涉害-孟仲季/遙剋/昴星) ·
§4.17/4.20 = **Swiss Ephemeris ไฟล์ se1 จริง** (sepl_18+semo_18 ใน `services/engine/ephe`,
fallback Moshier รายงานตามจริงใน factors; observer = Bangkok, Vedic = Lahiri sidereal) · ที่เหลือ numerology/อื่น ๆ.
§4.21 = ชั้นวินัย V5 (ไม่สร้างเลข) — รวม 19 วิชาในระบบ. §4.13/4.14 ถูกตัดออกจากโปรเจกต์ (spec ห้ามทำเป็น deterministic module).

## หมายเหตุการออกแบบ (สมมติฐานที่ระบุชัด — guardrail #9)

- **ปฏิทินจีน** ใช้ `sxtwl` สำหรับ วัน/เดือน (jie) และคำนวณชั่วโมงเองตาม 五鼠遁 (§C.3). **เฉพาะ "เสาปี" (year ganzhi) สลับที่ 28 พ.ย. แบบ fixed ตรงกับโปรแกรม bazi อ้างอิง (`D:\bazi`)** ไม่ใช่ลี่ชุน — ธันวาคม และ 28–30 พ.ย. นับเป็นปีถัดไป. **"เสาเดือน" คงตาม 立春-based 五虎遁** (ยืนยัน 17 ม.ค. 2569 → ซิง 0; 2 ม.ค. 2569 → 丙午 ไฟเปี้ย −5). เมทริกซ์คะแนน + การรวม A/B ตรงกับ `D:\bazi` และ **ผลกำลังตรงกันครบทั้ง 708 งวด**. ค่า backtest §C.11 ของ **ดวงจีน** = 17/708 (p≈0.334) แทน 20/708 (ลี่ชุน) — ศาสตร์อื่นไม่เปลี่ยน.
- **สถิติ WF tie-break:** "ค่าที่ออกบ่อยสุด" ใช้ `Counter.most_common` (ค่าที่ถึง max ก่อนตามลำดับเวลา) — เป็นค่าที่ reproduce §C.11 (17/608) พอดี ต่างจากนี้ได้ตัวเลขไม่ตรง.
- **p-value:** binomial **two-sided** ที่ baseline เฉลี่ยต่อศาสตร์ — reproduce ค่าอ้างอิง §C.11 ครบทั้ง 5.
- **baseline ชุด 3 ตัว:** ยกกำลัง `k` (จำนวนชุดจริงของงวดนั้น) ตาม §C.10 — มี regression test กันบั๊กที่เคยทำให้ p-value พังทั้งตาราง.
- **stats WF ในไลฟ์:** engine อ่านประวัติจาก `data/thai.xlsx` โดยตรง (self-contained); Postgres เป็น store ของฝั่ง web.

## Deploy (Docker บน VPS + nginx reverse proxy)

ดู [`docs/DEPLOY.md`](docs/DEPLOY.md). โครงเดียวกับ srv1587663 (nginx → web:3000, engine ไม่ต้อง expose ออกนอก).

## สถานะ / ข้อจำกัด

- **ศาสตร์ 18 วิชา Production** (จาก 19 วิชาในระบบ; อีก 1 คือ §4.21 ชั้นวินัย V5) — ทุกวิชามี golden test + ผ่าน backtest §6 (win=False ทุกตัว). §4.13/4.14 ถูกตัดออกจากโปรเจกต์ (spec สั่งห้ามทำเป็น deterministic module).
- **Data layer:** Excel → Postgres รันจริงแล้ว (`packages/db` : `prisma db push` + `tsx import.ts`) — 708 งวดใน Postgres, เกรด B, มี `ImportRun` audit record. Engine อ่านประวัติจาก `data/thai.xlsx` โดยตรง (self-contained); Postgres เป็น store ของฝั่ง web.
- **§4.21.6 Baseline Models (6 ชุด):** Random / Long-Freq / Recent-Freq / EMA / Gap-Overdue / Simple-Ensemble — walk-forward ชั้น 2, มี Baseline Comparison ในหน้า Backtest (§4.21.10). ทุก baseline win=False → ยืนยัน Advanced Ensemble ไม่ให้ค่าเพิ่ม.
- **§4.4-EXT หมวด M (ML models):** walk-forward, no-leakage, multiclass ทำนาย 2ล่าง — รันจริง **9 โมเดล** ที่ endpoint `/ml` (หนัก, cached; ปุ่มโหลดแยกในหน้า Backtest): sklearn 5 (LogReg/RandomForest/kNN/GradientBoosting/GaussianNB), **XGBoost** (LabelEncoder wrapper), และ DL **LSTM/GRU/Transformer** (torch CPU: embedding→sequence encoder→linear, Adam/CrossEntropy). ทุกโมเดล **win=False**. โครง `_unavailable_models()` ยังคงรายงาน `NOT AVAILABLE` ตามจริงหาก dependency หาย (§4.21.7 — ไม่ mock).
- **§4.4-EXT** ที่เหลือ (เทคนิคย่อยในหมวด A–N) เป็น catalog อนาคต — core baselines + representative ML models ทำแล้ว.
- **Audit Mode** (§4.21.18) ทำเท่าที่ infrastructure รองรับ ส่วนที่เหลือ mark `NOT AVAILABLE` ตามจริง (ไม่ mock).
- ไฟล์ spec `System_Spec_..._v3_1.md` อยู่ที่ root ของ repo แล้ว — §4.1–4.20 อ้างอิงสเปกนี้ + `Lottery.md §C` (สูตรแกน 5 ศาสตร์).
