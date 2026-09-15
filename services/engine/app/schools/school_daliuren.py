"""ศาสตร์ 4.8 Da Liu Ren 大六壬 — number generation (FULL 四課 + 三傳).

Faithful upgrades over the earlier simplified version:
  - 月將 by the classical solar rule: switches at each 中氣 (大寒→子 … 冬至→丑),
    computed from sxtwl solar terms — not from the lunar month.
  - Complete 四課 (four lessons) from 月將加時 (heaven-plate shift).
  - 三傳 by the classical chain: 賊剋 (下賊上 first, then 上剋下) → 比用
    (match day-stem polarity) → 涉害 simplified to the 孟仲季 priority rule
    (stated assumption, guardrail #9) → 遙剋 (蒿矢/彈射) → 昴星 fallback.
"""
from __future__ import annotations

import datetime

from ..core.constants import SE, BE
from ..core.pillars import Pillars
from .base import SchoolResult
from ._cn_helpers import GAN_JI

try:
    import sxtwl  # type: ignore
    _HAS_SXTWL = True
except Exception:  # pragma: no cover
    _HAS_SXTWL = False

# 中氣 index (sxtwl: 0=冬至…23=大雪) → 月將 branch that begins after it.
# 大寒→子, 雨水→亥, 春分→戌, 谷雨→酉, 小满→申, 夏至→未,
# 大暑→午, 处暑→巳, 秋分→辰, 霜降→卯, 小雪→寅, 冬至→丑.
_YUEJIANG_BY_ZHONGQI = {2: 0, 4: 11, 6: 10, 8: 9, 10: 8, 12: 7,
                        14: 6, 16: 5, 18: 4, 20: 3, 22: 2, 0: 1}

# Element overcoming (剋): key overcomes value.
_OVERCOMES = {"ไม้": "ดิน", "ดิน": "น้ำ", "น้ำ": "ไฟ", "ไฟ": "ทอง", "ทอง": "ไม้"}

# Branch category for the simplified 涉害 tie-break: 孟(1) 仲(2) 季(3).
_MENG_ZHONG_JI = {2: 1, 8: 1, 5: 1, 11: 1,    # 寅申巳亥 孟
                  0: 2, 6: 2, 3: 2, 9: 2,     # 子午卯酉 仲
                  4: 3, 10: 3, 1: 3, 7: 3}    # 辰戌丑未 季


def _yuejiang(y: int, m: int, d: int) -> int:
    """月將 branch from the latest 中氣 on/before the date."""
    day = sxtwl.fromSolar(y, m, d)
    for _ in range(40):
        if day.hasJieQi():
            jq = day.getJieQi()
            if jq in _YUEJIANG_BY_ZHONGQI:
                return _YUEJIANG_BY_ZHONGQI[jq]
        day = day.before(1)
    raise RuntimeError("no zhong-qi found within 40 days")


def _ke(a_elem: str, b_elem: str) -> bool:
    return _OVERCOMES[a_elem] == b_elem


def _san_chuan(day_stem: int, day_branch: int, shift: int):
    """Return (c1, c2, c3, method) — the three transmissions (branch indices)."""
    top = lambda b: (b + shift) % 12  # heaven-plate branch above earth branch b

    ganji = GAN_JI[day_stem]
    l1, l3 = top(ganji), top(day_branch)
    l2, l4 = top(l1), top(l3)
    # lessons as (bottom_element, top_branch); lesson1's bottom is the day STEM.
    lessons = [
        (SE[day_stem], l1),
        (BE[l1], l2),
        (BE[day_branch], l3),
        (BE[l3], l4),
    ]
    day_yang = day_stem % 2 == 0

    def pick(cands, method):
        if len(cands) == 1:
            return cands[0], method
        # 比用: keep tops whose polarity matches the day stem.
        by = [b for b in cands if (b % 2 == 0) == day_yang]
        if len(by) == 1:
            return by[0], method + "+比用"
        pool = by or cands
        # 涉害 (simplified, stated): prefer 孟, then 仲, then 季; then lowest index.
        pool = sorted(set(pool), key=lambda b: (_MENG_ZHONG_JI[b], b))
        return pool[0], method + "+涉害(孟仲季)"

    # 下賊上: bottom overcomes top.
    zei = [t for (be, t) in lessons if _ke(be, BE[t])]
    if zei:
        c1, method = pick(zei, "賊剋(下賊上)")
    else:
        # 上剋下: top overcomes bottom.
        ke_ = [t for (be, t) in lessons if _ke(BE[t], be)]
        if ke_:
            c1, method = pick(ke_, "賊剋(上剋下)")
        else:
            # 遙剋: lesson tops vs the day stem element, from afar.
            hao = [t for (_be, t) in lessons[1:] if _ke(BE[t], SE[day_stem])]   # 蒿矢
            tan = [t for (_be, t) in lessons[1:] if _ke(SE[day_stem], BE[t])]   # 彈射
            if hao:
                c1, method = pick(hao, "遙剋(蒿矢)")
            elif tan:
                c1, method = pick(tan, "遙剋(彈射)")
            else:
                # 昴星 fallback: 陽日 branch above 酉; 陰日 branch whose top is 酉.
                c1 = top(9) if day_yang else (9 - shift) % 12
                method = "昴星"
    c2, c3 = top(c1), top(top(c1))
    return c1, c2, c3, method


def generate(dt: datetime.datetime, p: Pillars) -> SchoolResult:
    if not _HAS_SXTWL:
        raise RuntimeError("Da Liu Ren school requires sxtwl for solar terms")

    yj = _yuejiang(dt.year, dt.month, dt.day)
    shift = (yj - p.hour_branch) % 12          # 月將加時
    ganji = GAN_JI[p.day_stem]
    lesson1 = (ganji + shift) % 12             # 干上神
    lesson3 = (p.day_branch + shift) % 12      # 支上神
    c1, c2, c3, method = _san_chuan(p.day_stem, p.day_branch, shift)

    Y, SH = yj + 1, shift + 1
    L1, L3, DB = lesson1 + 1, lesson3 + 1, p.day_branch + 1
    C1, C2, C3 = c1 + 1, c2 + 1, c3 + 1

    top3 = f"{(L1 * 100 + L3 * 10 + SH) % 1000:03d}"
    top2 = f"{(L1 * 10 + L3) % 100:02d}"
    bottom2 = f"{(Y * 10 + DB) % 100:02d}"
    set3 = [
        f"{(Y * 100 + SH * 10 + DB) % 1000:03d}",
        f"{(C1 * 100 + C2 * 10 + C3) % 1000:03d}",       # 三傳
        f"{(C1 * 100 + L1 * 10 + L3) % 1000:03d}",       # 初傳 + 四課 heads
        f"{(Y + SH + L1 + L3 + DB + C1 + C2 + C3) % 1000:03d}",
    ]

    factors = {"yue_jiang": Y, "shift": SH, "lesson1_ganshang": L1,
               "lesson3_zhishang": L3, "day_branch": DB,
               "san_chuan": [C1, C2, C3], "san_chuan_method": method}
    return SchoolResult("4.8", "Da Liu Ren", top3, top2, bottom2, set3, factors)
