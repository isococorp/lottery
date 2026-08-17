"""ศาสตร์ 4.19 Tarot + Numerology — number generation (approved mapping).

Maps the date to Major Arcana cards 0–21 (The Fool … The World) by reducing digit
sums until the value is ≤ 21.
"""
from __future__ import annotations

import datetime

from .base import SchoolResult


def reduce21(n: int) -> int:
    """Digit-sum reduction until the value is at most 21 (a Major Arcana index)."""
    n = abs(int(n))
    while n > 21:
        n = sum(int(c) for c in str(n))
    return n


def generate(dt: datetime.datetime) -> SchoolResult:
    birth = reduce21(dt.month + dt.day + dt.year)   # Birth / Sun card
    day_c = reduce21(dt.day)
    hour_c = reduce21(dt.month + dt.hour)           # time-sensitive card

    top3 = f"{birth:02d}{day_c % 10}"
    top2 = f"{birth:02d}"
    bottom2 = f"{day_c:02d}"
    set3 = [
        f"{hour_c:02d}{birth % 10}",
        f"{(birth + day_c + hour_c) % 1000:03d}",
        f"{birth % 10}{day_c % 10}{hour_c % 10}",
        f"{(birth * 10 + hour_c) % 1000:03d}",
    ]

    factors = {"birth_card": birth, "day_card": day_c, "hour_card": hour_c}
    return SchoolResult("4.19", "Tarot", top3, top2, bottom2, set3, factors)
