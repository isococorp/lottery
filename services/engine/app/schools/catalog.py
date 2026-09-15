"""Full 21-วิชา catalog (spec §4.1–4.21).

The calculator draws from "21 วิชา" (§5), but the spec designates only §4.1–4.5 as
Production with verified deterministic formulas. §4.6–4.20 are an explicit belief
BACKLOG with NO formula defined in the spec; §4.21 is the V5 operating discipline
(not a 7-value school). Per §4 ("ห้ามใส่ศาสตร์อื่น ๆ แบบไม่ระบุชื่อ") every discipline
is named here; per §4.21.17-B unimplemented ones report an honest status — never a
mock number.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import List, Optional


class Status:
    PRODUCTION = "PRODUCTION"        # verified formula, computes 7 values
    NOT_AVAILABLE = "NOT AVAILABLE"  # backlog: no verified 7-value formula yet
    NOT_RECOMMENDED = "NOT RECOMMENDED"  # spec advises against a deterministic module
    NEEDS_EPHEMERIS = "NEEDS EPHEMERIS"  # requires external planetary data (Swiss Ephemeris)
    DISCIPLINE = "DISCIPLINE"        # operating protocol, not a number school


@dataclass(frozen=True)
class Vicha:
    code: str
    name: str
    layer: int          # Layered Framework: 1 data / 2 stats / 3 belief
    status: str
    principle: str
    note: Optional[str] = None

    def as_dict(self) -> dict:
        return asdict(self)


# §4.1–4.5 — Production (implemented; formulas verified by golden tests)
PRODUCTION: List[Vicha] = [
    Vicha("4.1", "ดวงจีน (BaZi พลังวัน)", 3, Status.PRODUCTION,
          "ธาตุ→เลขเหอถู 河圖 ผสมคะแนนพลังวัน A/B"),
    Vicha("4.2", "ดวงไทย", 3, Status.PRODUCTION,
          "เลขดาวประจำวัน × กำลังวันตำราไทย × เลขยาม"),
    Vicha("4.3", "เลขศาสตร์วัน-เวลา", 3, Status.PRODUCTION,
          "รากเลข (digit root) + ผสมเลขวัน/เดือน/ปี/เวลา"),
    Vicha("4.4", "สถิติ (Walk-forward)", 2, Status.PRODUCTION,
          "เลขที่ออกบ่อยสุดจริงในอดีต เฉพาะข้อมูลก่อนวันทำนาย (no look-ahead)"),
    Vicha("4.5", "ศาสตร์อื่น (โหลวซู+จันทรคติ+Life Path)", 3, Status.PRODUCTION,
          "โหลวซู 洛書 (JDN mod 9) + อายุจันทร์ + Life Path"),
    Vicha("4.6", "Zi Wei Dou Shu 紫微斗數", 3, Status.PRODUCTION,
          "排盤: 命宮/身宮/五行局(納音)/紫微/天府 (faithful)"),
    Vicha("4.7", "Qi Men Dun Jia 奇門遁甲", 3, Status.PRODUCTION,
          "排盤เต็ม (拆補): 節氣三元局 + 符頭 + แผ่นดิน六仪三奇 + 值符/值使"),
    Vicha("4.8", "Da Liu Ren 大六壬", 3, Status.PRODUCTION,
          "月將ตาม中氣 + 四課ครบ + 三傳 (賊剋/比用/涉害-孟仲季/遙剋/昴星)"),
    Vicha("4.9", "Mei Hua Yi Shu 梅花易數", 3, Status.PRODUCTION,
          "เลข起卦: 本卦 + 变卦 (พลิกเส้นเคลื่อน), ตรีลักษณ์ Fu Xi"),
    Vicha("4.10", "I Ching 易經 (64 卦)", 3, Status.PRODUCTION,
          "cast ตามเวลา (梅花): ตรีลักษณ์บน/ล่าง + เส้นเคลื่อน, เฮกซะแกรม Fu Xi index 1–64"),
    Vicha("4.11", "Xuan Kong Fei Xing 玄空飛星 (ดาวบิน)", 3, Status.PRODUCTION,
          "元運 + 年紫白 + 月紫白 (faithful San Yuan)"),
    Vicha("4.12", "Tong Sheng 通勝 + Tai Yi 太乙", 3, Status.PRODUCTION,
          "建除十二神 + 二十八宿 (คาบ) + 太乙九宮 (almanac primitives)"),
    Vicha("4.15", "Numerology — Pythagorean", 3, Status.PRODUCTION,
          "Life Path/Birthday/Attitude แบบคง Master Numbers 11/22/33"),
    Vicha("4.16", "Numerology — Chaldean", 3, Status.PRODUCTION,
          "ค่าตัวอักษร Chaldean 1–8 ของชื่อวัน EN + psychic (วัน) + destiny (วันที่)"),
    Vicha("4.17", "Western Astrology (12 ราศี)", 3, Status.PRODUCTION,
          "Swiss Ephemeris (ไฟล์ se1 จริง): ราศี+องศา Sun/Moon + Ascendant (Bangkok)"),
    Vicha("4.18", "Biorhythm (ชีวจังหวะ)", 2, Status.PRODUCTION,
          "3 รอบไซน์ กาย/อารมณ์/สติปัญญา (23/28/33) อ้างอิง JDN เป็น epoch"),
    Vicha("4.19", "Tarot + Numerology", 3, Status.PRODUCTION,
          "จับคู่วันที่กับ Major Arcana 0–21 (Birth/Day/Hour card)"),
    Vicha("4.20", "Vedic Astrology (Jyotisha) + Panchanga", 3, Status.PRODUCTION,
          "Swiss Ephemeris (ไฟล์ se1 จริง, Lahiri sidereal): Nakshatra+Pada/Tithi/Yoga/Rashi"),
]

# Belief backlog. §4.13/4.14 were removed from the project (spec forbids building
# them as deterministic modules); no backlog schools remain.
BACKLOG: List[Vicha] = []

# §4.21 — V5 operating discipline (implemented as protocol/v5_gate.py; not a number school)
DISCIPLINE = Vicha(
    "4.21", "Thai Lottery AI V5 — Statistical Operating Protocol", 2, Status.DISCIPLINE,
    "ชั้นวินัยครอบทุกเอาต์พุต (Self-Check 18, Failure States, Confidence, Banned Phrases)",
    "ACTIVE — ห่อหุ้มทุก response ของ /predict, /backtest, /ml, /audit อยู่แล้ว "
    "(ไม่สร้าง 7 ค่าเอง ตาม §4.21.27); ดูสถานะสดที่ badge '§4.21 V5' และหน้า 'ตรวจระบบ'",
)


def full_catalog() -> dict:
    return {
        "total_vicha": len(PRODUCTION) + len(BACKLOG) + 1,   # 5 + 15 + 1 = 21
        "production": [v.as_dict() for v in PRODUCTION],
        "backlog": [v.as_dict() for v in BACKLOG],
        "discipline": DISCIPLINE.as_dict(),
        "summary": {
            "production": len(PRODUCTION),
            "backlog": len(BACKLOG),
            "discipline": 1,
        },
        "note": ("19 วิชาในระบบ: 18 วิชามีสูตร deterministic ที่ตรวจสอบแล้ว (Production: "
                 "§4.1–4.12 + §4.15–4.20; §4.17/4.20 ใช้ Swiss Ephemeris, "
                 "§4.7/4.8 simplified, ที่เหลือ faithful/numerology) และ 1 วิชาเป็นชั้นวินัย V5 (§4.21). "
                 "§4.13/4.14 ถูกตัดออกจากโปรเจกต์ (spec ห้ามทำเป็น deterministic module)."),
    }
