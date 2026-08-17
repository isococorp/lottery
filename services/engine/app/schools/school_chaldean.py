"""ศาสตร์ 4.16 Chaldean Numerology — number generation (approved mapping).

Chaldean assigns 1–8 to letters (no 9), unlike Pythagorean. We spell the English
weekday name and sum its Chaldean values as the "name number", combined with the
day's psychic number and the full-date destiny number.
"""
from __future__ import annotations

import datetime

from .base import SchoolResult

# Chaldean letter values (1–8; 9 is never assigned to a letter).
_CHAL = {}
for _letters, _v in [("AIJQY", 1), ("BKR", 2), ("CGLS", 3), ("DMT", 4),
                     ("EHNX", 5), ("UVW", 6), ("OZ", 7), ("FP", 8)]:
    for _c in _letters:
        _CHAL[_c] = _v

_WEEKDAY_EN = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY",
               "FRIDAY", "SATURDAY", "SUNDAY"]  # Python weekday(): Mon=0..Sun=6


def _chaldean_root(n: int) -> int:
    """Reduce to a single digit 1–9 (0 stays 0)."""
    n = abs(int(n))
    while n >= 10:
        n = sum(int(c) for c in str(n))
    return n


def generate(dt: datetime.datetime) -> SchoolResult:
    name = _WEEKDAY_EN[dt.weekday()]
    name_compound = sum(_CHAL.get(c, 0) for c in name)     # e.g. SUNDAY -> 20
    name_root = _chaldean_root(name_compound)
    psychic = _chaldean_root(dt.day)
    destiny = _chaldean_root(sum(int(c) for c in f"{dt.year}{dt.month:02d}{dt.day:02d}"))

    top3 = f"{name_root}{name_compound % 100:02d}"
    top2 = f"{(psychic * 10 + destiny) % 100:02d}"
    bottom2 = f"{name_compound % 100:02d}"
    set3 = [
        f"{(name_compound * 10 + name_root) % 1000:03d}",
        f"{(psychic * 100 + destiny * 10 + name_root) % 1000:03d}",
        f"{(destiny * 100 + name_compound) % 1000:03d}",
        f"{(name_root + psychic + destiny + name_compound) % 1000:03d}",
    ]

    factors = {"weekday_en": name, "name_compound": name_compound,
               "name_root": name_root, "psychic": psychic, "destiny": destiny}
    return SchoolResult("4.16", "Chaldean", top3, top2, bottom2, set3, factors)
