"""ศาสตร์ 4.3 เลขศาสตร์ วัน-เวลา — number generation (spec §C.7)."""
from __future__ import annotations

import datetime

from .base import SchoolResult, digit_root


def generate(dt: datetime.datetime) -> SchoolResult:
    d, m, y = dt.day, dt.month, dt.year
    hh, mi = dt.hour, dt.minute
    be = y + 543               # Buddhist year
    yy2 = be % 100
    r = digit_root(d + m + be)

    top3 = f"{(d * m * r) % 1000:03d}"
    bottom2 = f"{(d + m + yy2 + hh) % 100:02d}"
    top2 = f"{(d + m + r) % 100:02d}"
    set3 = [
        f"{(d * 100 + m * 10 + r) % 1000:03d}",
        f"{(yy2 * 10 + r) % 1000:03d}",
        f"{(d * m + hh * mi) % 1000:03d}",
        f"{((d + m) * (hh + 1)) % 1000:03d}",
    ]

    factors = {"buddhist_year": be, "yy2": yy2, "digit_root": r,
               "day": d, "month": m, "hour": hh, "minute": mi}
    return SchoolResult("4.3", "เลขศาสตร์", top3, top2, bottom2, set3, factors)
