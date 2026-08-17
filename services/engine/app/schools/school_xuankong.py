"""ศาสตร์ 4.11 Xuan Kong Fei Xing 玄空飛星 — number generation (faithful).

元運 (20-year period), 年紫白 (annual white star), 月紫白 (monthly star) via the
standard San Yuan formulas.
"""
from __future__ import annotations

import datetime

from ..core.pillars import Pillars
from .base import SchoolResult
from ._cn_helpers import digit_single, MONTH_START

try:
    import sxtwl  # type: ignore
    _HAS_SXTWL = True
except Exception:  # pragma: no cover
    _HAS_SXTWL = False


def generate(dt: datetime.datetime, p: Pillars) -> SchoolResult:
    if not _HAS_SXTWL:
        raise RuntimeError("Xuan Kong school requires sxtwl for the lunar month")
    day = sxtwl.fromSolar(dt.year, dt.month, dt.day)
    lm = day.getLunarMonth()

    P = ((dt.year - 1864) // 20) % 9 + 1            # 元運
    A = (10 - digit_single(dt.year)) % 9 or 9       # 年紫白 (center) 1–9
    Mo = (MONTH_START[p.year_branch] - (lm - 1)) % 9 or 9   # 月紫白 1–9

    top3 = f"{P}{A}{Mo}"
    top2 = f"{(A * 10 + Mo) % 100:02d}"
    bottom2 = f"{(P * 10 + A) % 100:02d}"
    set3 = [
        f"{(Mo * 100 + A * 10 + P) % 1000:03d}",
        f"{(P * A * Mo) % 1000:03d}",
        f"{(P + A + Mo) % 1000:03d}",
        f"{(A * 100 + P * 10 + Mo) % 1000:03d}",
    ]
    factors = {"period": P, "annual_star": A, "month_star": Mo}
    return SchoolResult("4.11", "Xuan Kong", top3, top2, bottom2, set3, factors)
