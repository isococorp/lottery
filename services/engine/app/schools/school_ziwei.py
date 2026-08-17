"""ศาสตร์ 4.6 Zi Wei Dou Shu 紫微斗數 — number generation (faithful chart setup).

Standard 排盤: 命宮/身宮 from lunar month + hour branch, 五行局 from the 納音 of the
命宮 ganzhi, then the 紫微 (and mirror 天府) star positions via the classic algorithm.
"""
from __future__ import annotations

import datetime
import math

from ..core.pillars import Pillars
from .base import SchoolResult
from ._cn_helpers import YIN_STEM, bureau_of

try:
    import sxtwl  # type: ignore
    _HAS_SXTWL = True
except Exception:  # pragma: no cover
    _HAS_SXTWL = False


def generate(dt: datetime.datetime, p: Pillars) -> SchoolResult:
    if not _HAS_SXTWL:
        raise RuntimeError("Zi Wei school requires sxtwl for the lunar date")
    day = sxtwl.fromSolar(dt.year, dt.month, dt.day)
    lm, ld = day.getLunarMonth(), day.getLunarDay()
    hb = p.hour_branch

    ming = (2 + (lm - 1) - hb) % 12                 # 命宮
    shen = (2 + (lm - 1) + hb) % 12                 # 身宮
    ming_stem = (YIN_STEM[p.year_stem] + (ming - 2)) % 10
    ju = bureau_of(ming_stem, ming)                 # 五行局 2..6

    q = math.ceil(ld / ju)
    r = q * ju - ld
    zw = (2 + (q - 1) + (r if r % 2 == 0 else -r)) % 12   # 紫微
    tf = (4 - zw) % 12                              # 天府

    M, S, Z, F, J = ming + 1, shen + 1, zw + 1, tf + 1, ju
    top3 = f"{(J * 100 + Z * 10 + M) % 1000:03d}"
    top2 = f"{(M * 10 + S) % 100:02d}"
    bottom2 = f"{(Z * 10 + F) % 100:02d}"
    set3 = [
        f"{(M * 100 + S * 10 + J) % 1000:03d}",
        f"{(Z * 100 + F * 10 + J) % 1000:03d}",
        f"{(J * 100 + M * 10 + Z) % 1000:03d}",
        f"{(M + S + Z + F + J) % 1000:03d}",
    ]
    factors = {"lunar_month": lm, "lunar_day": ld, "ming_gong": M, "shen_gong": S,
               "wu_xing_ju": J, "zi_wei": Z, "tian_fu": F}
    return SchoolResult("4.6", "Zi Wei", top3, top2, bottom2, set3, factors)
