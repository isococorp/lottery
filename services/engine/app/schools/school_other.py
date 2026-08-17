"""ศาสตร์ 4.5 ศาสตร์อื่น (Lo Shu / lunar age / life-path) — spec §C.7."""
from __future__ import annotations

import datetime

from ..core.pillars import jdn
from .base import SchoolResult, digit_root


def generate(dt: datetime.datetime) -> SchoolResult:
    d, m, y = dt.day, dt.month, dt.year
    J = jdn(y, m, d)
    lo = J % 9 + 1                                   # โหลวซู (Lo Shu) 1–9
    ma = round((J - 2451550.1) % 29.53) % 30         # อายุจันทร์ (moon age)
    lp = digit_root(d + m + y)                       # life-path (Gregorian year)

    top3 = f"{lo}{ma % 100:02d}"
    bottom2 = f"{(lo * 10 + lp) % 100:02d}"
    top2 = f"{(lo + ma) % 100:02d}"
    set3 = [
        f"{(lo * 100 + ma) % 1000:03d}",
        f"{(lp * 100 + lo * 10 + ma % 10) % 1000:03d}",
        f"{(ma * 10 + lp) % 1000:03d}",
        f"{(lo + lp + ma) % 1000:03d}",
    ]

    factors = {"jdn": J, "lo_shu": lo, "moon_age": ma, "life_path": lp}
    return SchoolResult("4.5", "ศาสตร์อื่น", top3, top2, bottom2, set3, factors)
