"""ศาสตร์ 4.10 I Ching 易經 (64 卦) — number generation (approved mapping).

Time-cast (梅花 method): upper/lower trigrams from lunar month/day + year & hour
branches, plus a moving line. Hexagram number uses the Fu Xi index (U-1)*8+L
(1–64, unambiguous) rather than the irregular King Wen sequence.
"""
from __future__ import annotations

import datetime

from ..core.pillars import Pillars
from .base import SchoolResult

try:
    import sxtwl  # type: ignore
    _HAS_SXTWL = True
except Exception:  # pragma: no cover
    _HAS_SXTWL = False


def generate(dt: datetime.datetime, p: Pillars) -> SchoolResult:
    if not _HAS_SXTWL:
        raise RuntimeError("I Ching school requires sxtwl for the lunar date")

    day = sxtwl.fromSolar(dt.year, dt.month, dt.day)
    lm = day.getLunarMonth()          # lunar month 1–12
    ld = day.getLunarDay()            # lunar day 1–30
    yb = p.year_branch + 1            # year earthly branch number 1–12 (子=1)
    hb = p.hour_branch + 1            # hour earthly branch number 1–12

    upper_sum = yb + lm + ld
    lower_sum = yb + lm + ld + hb
    U = (upper_sum - 1) % 8 + 1       # upper trigram 1–8 (Fu Xi)
    L = (lower_sum - 1) % 8 + 1       # lower trigram 1–8
    M = (lower_sum - 1) % 6 + 1       # moving line 1–6
    H = (U - 1) * 8 + L               # hexagram 1–64 (Fu Xi index)

    top3 = f"{H:02d}{M}"
    top2 = f"{U}{L}"
    bottom2 = f"{H % 100:02d}"
    set3 = [
        f"{(U * 100 + L * 10 + M) % 1000:03d}",
        f"{(H * 10 + M) % 1000:03d}",
        f"{(H * 10 + U) % 1000:03d}",
        f"{(U + L + H + M) % 1000:03d}",
    ]

    factors = {"lunar_month": lm, "lunar_day": ld, "year_branch_no": yb,
               "hour_branch_no": hb, "upper": U, "lower": L, "moving_line": M,
               "hexagram": H}
    return SchoolResult("4.10", "I Ching", top3, top2, bottom2, set3, factors)
