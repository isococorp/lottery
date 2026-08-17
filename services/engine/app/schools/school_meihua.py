"""ศาสตร์ 4.9 Mei Hua Yi Shu 梅花易數 — number generation (approved mapping).

Number-based 起卦: builds the original hexagram 本卦 and the changed hexagram 变卦
(flip the moving line). The 本卦→变卦 pair is the signature that distinguishes this
from §4.10 I Ching (which casts a single hexagram from the lunar date).

Trigram numbering is Fu Xi (先天八卦): a trigram's 3-bit value = 8 − its number.
"""
from __future__ import annotations

import datetime

from .base import SchoolResult


def _flip_line(upper: int, lower: int, moving: int):
    """Return (upper', lower') after flipping the moving line (1=bottom … 6=top)."""
    if moving <= 3:                       # line is in the lower trigram
        binv = (8 - lower) ^ (1 << (moving - 1))
        return upper, 8 - binv
    binv = (8 - upper) ^ (1 << (moving - 3 - 1))  # line is in the upper trigram
    return 8 - binv, lower


def generate(dt: datetime.datetime) -> SchoolResult:
    a = dt.day + dt.month + (dt.year % 100)
    b = a + dt.hour
    upper = (a - 1) % 8 + 1
    lower = (b - 1) % 8 + 1
    moving = (b - 1) % 6 + 1
    H_ben = (upper - 1) * 8 + lower

    upper2, lower2 = _flip_line(upper, lower, moving)
    H_bian = (upper2 - 1) * 8 + lower2

    top3 = f"{H_ben:02d}{H_bian % 10}"
    top2 = f"{H_bian % 100:02d}"
    bottom2 = f"{H_ben % 100:02d}"
    set3 = [
        f"{(upper * 100 + lower * 10 + moving) % 1000:03d}",
        f"{(H_ben * 10 + moving) % 1000:03d}",
        f"{(H_bian * 10 + moving) % 1000:03d}",
        f"{(H_ben + H_bian + upper + lower + moving) % 1000:03d}",
    ]

    factors = {"upper": upper, "lower": lower, "moving_line": moving,
               "ben_gua": H_ben, "bian_gua": H_bian}
    return SchoolResult("4.9", "Mei Hua", top3, top2, bottom2, set3, factors)
