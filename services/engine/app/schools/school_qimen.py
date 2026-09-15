"""ศาสตร์ 4.7 Qi Men Dun Jia 奇門遁甲 — number generation (FULL hour-plate 排盤).

Faithful computation by the 拆補 (chai-bu) method:
  1. Governing solar term = latest of the 24 節氣 on/before the day (sxtwl).
  2. 符頭 = most recent 甲 or 己 day; its branch fixes the 元:
     子午卯酉→上元, 寅申巳亥→中元, 辰戌丑未→下元.
  3. 局 number + 陽遁/陰遁 from the classical (節氣 × 元) table.
  4. Earth plate: 六仪三奇 (戊己庚辛壬癸丁丙乙) laid from palace=局,
     forward for 陽遁 / backward for 陰遁 (Luo Shu palaces 1–9).
  5. 值符宮 = palace of the hour-stem on the earth plate (甲 hour uses the
     旬首's hidden 六仪 stem). 值使宮 = 旬首 palace advanced by the hour's
     position within its 旬 (forward 陽 / backward 陰).

Stated assumption (guardrail #9): 元 is fixed by 拆補, not the 置閏 method.
"""
from __future__ import annotations

import datetime

from ..core.pillars import Pillars
from .base import SchoolResult
from ._cn_helpers import gz_index

try:
    import sxtwl  # type: ignore
    _HAS_SXTWL = True
except Exception:  # pragma: no cover
    _HAS_SXTWL = False

# (節氣 index per sxtwl: 0=冬至 … 23=大雪) → (is_yang, [上元, 中元, 下元] 局)
JU_TABLE = {
    0:  (True,  [1, 7, 4]),   # 冬至
    1:  (True,  [2, 8, 5]),   # 小寒
    2:  (True,  [3, 9, 6]),   # 大寒
    3:  (True,  [8, 5, 2]),   # 立春
    4:  (True,  [9, 6, 3]),   # 雨水
    5:  (True,  [1, 7, 4]),   # 惊蛰
    6:  (True,  [3, 9, 6]),   # 春分
    7:  (True,  [4, 1, 7]),   # 清明
    8:  (True,  [5, 2, 8]),   # 谷雨
    9:  (True,  [4, 1, 7]),   # 立夏
    10: (True,  [5, 2, 8]),   # 小满
    11: (True,  [6, 3, 9]),   # 芒种
    12: (False, [9, 3, 6]),   # 夏至
    13: (False, [8, 2, 5]),   # 小暑
    14: (False, [7, 1, 4]),   # 大暑
    15: (False, [2, 5, 8]),   # 立秋
    16: (False, [1, 4, 7]),   # 处暑
    17: (False, [9, 3, 6]),   # 白露
    18: (False, [7, 1, 4]),   # 秋分
    19: (False, [6, 9, 3]),   # 寒露
    20: (False, [5, 8, 2]),   # 霜降
    21: (False, [6, 9, 3]),   # 立冬
    22: (False, [5, 8, 2]),   # 小雪
    23: (False, [4, 7, 1]),   # 大雪
}

TERM_NAMES = ["冬至", "小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明", "谷雨",
              "立夏", "小满", "芒种", "夏至", "小暑", "大暑", "立秋", "处暑", "白露",
              "秋分", "寒露", "霜降", "立冬", "小雪", "大雪"]

# Branch → 元 (1 上, 2 中, 3 下) by the 符頭 branch group.
_YUAN_BY_BRANCH = {0: 1, 6: 1, 3: 1, 9: 1,     # 子午卯酉 上元
                   2: 2, 8: 2, 5: 2, 11: 2,    # 寅申巳亥 中元
                   4: 3, 10: 3, 1: 3, 7: 3}    # 辰戌丑未 下元

# Plate stem order: 六仪 then 三奇 (stem indices: 戊4 己5 庚6 辛7 壬8 癸9 丁3 丙2 乙1)
_PLATE_ORDER = [4, 5, 6, 7, 8, 9, 3, 2, 1]


def _governing_term(y: int, m: int, d: int) -> int:
    """Latest solar-term index on/before the date."""
    day = sxtwl.fromSolar(y, m, d)
    for _ in range(20):
        if day.hasJieQi():
            return day.getJieQi()
        day = day.before(1)
    raise RuntimeError("no solar term found within 20 days")


def _fu_tou(y: int, m: int, d: int):
    """Most recent 甲/己 day (stem index 0 or 5) on/before the date → its GZ."""
    day = sxtwl.fromSolar(y, m, d)
    for _ in range(6):
        dg = day.getDayGZ()
        if dg.tg in (0, 5):
            return dg.tg, dg.dz
        day = day.before(1)
    raise RuntimeError("fu tou not found within 6 days")


def _earth_plate(ju: int, yang: bool) -> dict:
    """stem index -> Luo Shu palace (1–9)."""
    plate = {}
    p = ju
    for stem in _PLATE_ORDER:
        plate[stem] = p
        p = (p % 9) + 1 if yang else ((p - 2) % 9) + 1
    return plate


def generate(dt: datetime.datetime, p: Pillars) -> SchoolResult:
    if not _HAS_SXTWL:
        raise RuntimeError("Qi Men school requires sxtwl for solar terms")

    term = _governing_term(dt.year, dt.month, dt.day)
    yang, ju_row = JU_TABLE[term]
    _ft_stem, ft_branch = _fu_tou(dt.year, dt.month, dt.day)
    yuan = _YUAN_BY_BRANCH[ft_branch]
    ju = ju_row[yuan - 1]

    plate = _earth_plate(ju, yang)

    hgz = gz_index(p.hour_stem, p.hour_branch)
    xun = hgz // 10                       # 0–5 → 甲子/甲戌/甲申/甲午/甲辰/甲寅
    liu_yi = 4 + xun                      # hidden 六仪 stem of the 旬首
    origin = plate[liu_yi]                # 值符/值使 origin palace
    chief = plate[p.hour_stem if p.hour_stem != 0 else liu_yi]   # 值符宮
    pos = hgz % 10                        # hour position within its 旬 (0–9)
    envoy = ((origin - 1 + pos) % 9) + 1 if yang else ((origin - 1 - pos) % 9) + 1

    X = xun + 1                           # 1–6 for display/formulas
    top3 = f"{chief}{envoy}{ju}"
    top2 = f"{(chief * 10 + envoy) % 100:02d}"
    bottom2 = f"{(ju * 10 + X) % 100:02d}"
    set3 = [
        f"{(chief * 100 + envoy * 10 + ju) % 1000:03d}",
        f"{(X * 100 + chief * 10 + envoy) % 1000:03d}",
        f"{(ju * 100 + chief * 10 + (0 if yang else 1)) % 1000:03d}",
        f"{(chief + envoy + ju + X + yuan) % 1000:03d}",
    ]

    factors = {"term": TERM_NAMES[term], "yuan": yuan, "ju": ju,
               "dun": "yang" if yang else "yin", "xun": X,
               "chief_palace": chief, "envoy_palace": envoy, "method": "拆補"}
    return SchoolResult("4.7", "Qi Men", top3, top2, bottom2, set3, factors)
