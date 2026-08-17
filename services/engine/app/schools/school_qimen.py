"""ศาสตร์ 4.7 Qi Men Dun Jia 奇門遁甲 — number generation (SIMPLIFIED).

Uses authentic primitives — 陰陽遁 (by season), 六甲旬首, 時宮 (Luo Shu), 值符/值使
(from the day/hour ganzhi) — but NOT the full 節氣三元局 排盤. Labelled simplified.
"""
from __future__ import annotations

import datetime

from ..core.pillars import Pillars
from .base import SchoolResult
from ._cn_helpers import gz_index


def generate(dt: datetime.datetime, p: Pillars) -> SchoolResult:
    doy = dt.timetuple().tm_yday
    yy = 1 if (doy >= 356 or doy < 172) else 0      # 陽遁1 / 陰遁0 (winter→summer half)
    dgz = gz_index(p.day_stem, p.day_branch)
    xun = dgz // 10 + 1                              # 六甲旬首 1–6
    hour_palace = p.hour_branch % 9 + 1             # 時宮 (Luo Shu) 1–9
    chief = (p.day_stem + p.hour_branch) % 9 + 1    # 值符 1–9
    envoy = (p.day_branch + p.hour_stem) % 9 + 1    # 值使 1–9

    top3 = f"{chief}{envoy}{hour_palace}"
    top2 = f"{(chief * 10 + envoy) % 100:02d}"
    bottom2 = f"{(hour_palace * 10 + xun) % 100:02d}"
    set3 = [
        f"{(chief * 100 + envoy * 10 + hour_palace) % 1000:03d}",
        f"{(xun * 100 + chief * 10 + envoy) % 1000:03d}",
        f"{(hour_palace * 100 + chief * 10 + (1 - yy)) % 1000:03d}",
        f"{(chief + envoy + hour_palace + xun) % 1000:03d}",
    ]
    factors = {"yin_yang_dun": "yang" if yy else "yin", "xun_head": xun,
               "hour_palace": hour_palace, "chief": chief, "envoy": envoy}
    return SchoolResult("4.7", "Qi Men", top3, top2, bottom2, set3, factors)
