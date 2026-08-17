"""ศาสตร์ 4.12 Tong Sheng 通勝 / Tai Yi 太乙 — number generation (almanac primitives).

建除十二神 (day officer, faithful) + 二十八宿 (28-day cycle, faithful; phase anchor is
a stated convention JDN mod 28) + 太乙九宮 (JDN mod 9, simplified).
"""
from __future__ import annotations

import datetime

from ..core.pillars import Pillars, jdn
from .base import SchoolResult


def generate(dt: datetime.datetime, p: Pillars) -> SchoolResult:
    officer = (p.day_branch - p.month_branch) % 12  # 建除十二神 (0=建)
    J = jdn(dt.year, dt.month, dt.day)
    mansion = J % 28                                # 二十八宿 (phase = convention)
    taiyi = J % 9 + 1                               # 太乙九宮 1–9

    O, Ma, T = officer + 1, mansion + 1, taiyi
    top3 = f"{Ma % 100:02d}{T}"
    top2 = f"{(O * 10 + T) % 100:02d}"
    bottom2 = f"{Ma % 100:02d}"
    set3 = [
        f"{(O * 100 + Ma) % 1000:03d}",
        f"{(Ma * 10 + O) % 1000:03d}",
        f"{(T * 100 + Ma) % 1000:03d}",
        f"{(O + Ma + T) % 1000:03d}",
    ]
    factors = {"day_officer": O, "mansion_28": Ma, "tai_yi_palace": T}
    return SchoolResult("4.12", "Tong Sheng", top3, top2, bottom2, set3, factors)
