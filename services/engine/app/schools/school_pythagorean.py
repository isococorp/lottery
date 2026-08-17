"""ศาสตร์ 4.15 Numerology — Pythagorean (approved mapping).

Pythagorean reduction preserves the Master Numbers 11/22/33 (its signature,
distinct from §4.5's plain digit root and §4.16 Chaldean's letter values).
"""
from __future__ import annotations

import datetime

from .base import SchoolResult


def pyth_reduce(n: int) -> int:
    """Digit-sum reduction that STOPS at master numbers 11/22/33."""
    n = abs(int(n))
    while n > 9 and n not in (11, 22, 33):
        n = sum(int(c) for c in str(n))
    return n


def generate(dt: datetime.datetime) -> SchoolResult:
    m_r = pyth_reduce(dt.month)
    d_r = pyth_reduce(dt.day)
    y_r = pyth_reduce(dt.year)
    LP = pyth_reduce(m_r + d_r + y_r)   # Life Path (may be 11/22/33)
    BD = d_r                            # Birthday number
    AT = pyth_reduce(dt.day + dt.month)  # Attitude / Sun number

    top3 = f"{LP:02d}{m_r % 10}"
    top2 = f"{AT % 100:02d}"
    bottom2 = f"{LP % 100:02d}"
    set3 = [
        f"{(m_r * 100 + d_r * 10 + (y_r % 10)) % 1000:03d}",
        f"{(LP * 10 + BD) % 1000:03d}",
        f"{(BD * 100 + AT) % 1000:03d}",
        f"{(LP + BD + AT + m_r + d_r + y_r) % 1000:03d}",
    ]

    factors = {"month_r": m_r, "day_r": d_r, "year_r": y_r,
               "life_path": LP, "birthday": BD, "attitude": AT}
    return SchoolResult("4.15", "Pythagorean", top3, top2, bottom2, set3, factors)
