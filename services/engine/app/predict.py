"""Prediction facade — run all five schools for a given date/time (spec §PHASE-3).

Deterministic schools depend only on the datetime. The stats walk-forward school
depends on prior draws; here it uses all history strictly before the target date
(the same rule the backtest uses per-draw). If insufficient history exists it
reports NOT AVAILABLE rather than a fabricated value (§4.21.17-B).
"""
from __future__ import annotations

import datetime
from typing import Optional

from .core.pillars import compute_pillars
from .core.power import compute_power
from .core.constants import THAI_WEEKDAY
from . import schools
from .schools import school_stats_wf
from .data import store


def predict(dt: datetime.datetime, use_history: bool = True) -> dict:
    p = compute_pillars(dt.year, dt.month, dt.day, dt.hour, dt.minute)
    dp = compute_power(p)

    results = []
    # 4.1 ดวงจีน
    results.append(schools.school_bazi.generate(p, dp).as_dict())
    # 4.2 ดวงไทย
    results.append(schools.school_thai.generate(dt.date(), p).as_dict())
    # 4.3 เลขศาสตร์
    results.append(schools.school_numerology.generate(dt).as_dict())
    # 4.5 ศาสตร์อื่น
    results.append(schools.school_other.generate(dt).as_dict())
    # Approved additions (Chinese metaphysics): 4.6 Zi Wei · 4.7 Qi Men ·
    # 4.8 Da Liu Ren · 4.11 Xuan Kong · 4.12 Tong Sheng
    results.append(schools.school_ziwei.generate(dt, p).as_dict())
    results.append(schools.school_qimen.generate(dt, p).as_dict())
    results.append(schools.school_daliuren.generate(dt, p).as_dict())
    results.append(schools.school_xuankong.generate(dt, p).as_dict())
    results.append(schools.school_tongsheng.generate(dt, p).as_dict())
    # Approved additions: 4.9 Mei Hua · 4.10 I Ching · 4.15 Pythagorean ·
    # 4.16 Chaldean · 4.18 Biorhythm · 4.19 Tarot
    results.append(schools.school_meihua.generate(dt).as_dict())
    results.append(schools.school_iching.generate(dt, p).as_dict())
    results.append(schools.school_pythagorean.generate(dt).as_dict())
    results.append(schools.school_chaldean.generate(dt).as_dict())
    results.append(schools.school_biorhythm.generate(dt).as_dict())
    results.append(schools.school_tarot.generate(dt).as_dict())
    # 4.17 Western + 4.20 Vedic astrology (Swiss Ephemeris)
    results.append(schools.school_western.generate(dt).as_dict())
    results.append(schools.school_vedic.generate(dt).as_dict())

    # 4.4 สถิติ walk-forward (needs history)
    stats_entry: dict
    if use_history:
        weekday = THAI_WEEKDAY[dt.weekday()]
        hist = store.history_before(dt.date(), weekday)
        sr = school_stats_wf.generate(hist)
        if sr is None:
            stats_entry = {"code": "4.4", "name": "สถิติ WF",
                           "status": "NOT AVAILABLE",
                           "reason": f"ประวัติวัน{weekday}ไม่พอ "
                                     f"(มี {len(hist)} งวด, ต้องการ ≥{school_stats_wf.MIN_WEEKDAY})"}
        else:
            stats_entry = sr.as_dict()
    else:
        stats_entry = {"code": "4.4", "name": "สถิติ WF", "status": "NOT AVAILABLE",
                       "reason": "ปิดการใช้ประวัติ"}
    # keep school order 4.1..4.5
    results.insert(3, stats_entry)

    return {
        "input": {"date": dt.date().isoformat(), "time": dt.strftime("%H:%M")},
        "pillars": p.as_dict(),
        "power": dp.as_dict(),
        "schools": results,
    }
