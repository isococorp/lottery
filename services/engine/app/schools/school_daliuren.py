"""ศาสตร์ 4.8 Da Liu Ren 大六壬 — number generation (SIMPLIFIED).

月將加時 rotation plus the head of the 四課 (干上神 / 支上神). Does NOT compute the
full 三傳 (賊剋/涉害). Labelled simplified.
"""
from __future__ import annotations

import datetime

from ..core.pillars import Pillars
from .base import SchoolResult
from ._cn_helpers import GAN_JI

try:
    import sxtwl  # type: ignore
    _HAS_SXTWL = True
except Exception:  # pragma: no cover
    _HAS_SXTWL = False


def generate(dt: datetime.datetime, p: Pillars) -> SchoolResult:
    if not _HAS_SXTWL:
        raise RuntimeError("Da Liu Ren school requires sxtwl for the lunar month")
    day = sxtwl.fromSolar(dt.year, dt.month, dt.day)
    lm = day.getLunarMonth()

    yuejiang = (12 - lm) % 12                        # 月將 branch
    shift = (yuejiang - p.hour_branch) % 12          # 月將加時
    ganji = GAN_JI[p.day_stem]
    lesson1 = (ganji + shift) % 12                   # 干上神
    lesson3 = (p.day_branch + shift) % 12            # 支上神

    Y, SH, L1, L3, DB = yuejiang + 1, shift + 1, lesson1 + 1, lesson3 + 1, p.day_branch + 1
    top3 = f"{(L1 * 100 + L3 * 10 + SH) % 1000:03d}"
    top2 = f"{(L1 * 10 + L3) % 100:02d}"
    bottom2 = f"{(Y * 10 + DB) % 100:02d}"
    set3 = [
        f"{(Y * 100 + SH * 10 + DB) % 1000:03d}",
        f"{(L1 * 100 + L3 * 10 + Y) % 1000:03d}",
        f"{(SH * 100 + L1 * 10 + L3) % 1000:03d}",
        f"{(Y + SH + L1 + L3 + DB) % 1000:03d}",
    ]
    factors = {"yue_jiang": Y, "shift": SH, "lesson1_ganshang": L1,
               "lesson3_zhishang": L3, "day_branch": DB}
    return SchoolResult("4.8", "Da Liu Ren", top3, top2, bottom2, set3, factors)
