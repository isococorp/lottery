"""ศาสตร์ 4.17 Western Astrology — number generation (Swiss Ephemeris).

Tropical zodiac. Uses real Sun/Moon longitudes and the Ascendant (Placidus) for a
fixed observer (Bangkok), from the Swiss/Moshier ephemeris.
"""
from __future__ import annotations

import datetime

import swisseph as swe

from .base import SchoolResult
from ._swe_helpers import jd_ut, longitude, ascendant


def generate(dt: datetime.datetime) -> SchoolResult:
    jd = jd_ut(dt)
    sun = longitude(jd, swe.SUN)
    moon = longitude(jd, swe.MOON)
    asc = ascendant(jd)

    Su, SuD = int(sun // 30) + 1, int(sun % 30)     # sign 1–12, degree 0–29
    Mo, MoD = int(moon // 30) + 1, int(moon % 30)
    As, AsD = int(asc // 30) + 1, int(asc % 30)

    top3 = f"{(As * 100 + Su * 10 + Mo) % 1000:03d}"
    top2 = f"{SuD:02d}"
    bottom2 = f"{MoD:02d}"
    set3 = [
        f"{AsD:02d}{As % 10}",
        f"{(SuD + MoD + AsD) % 1000:03d}",
        f"{Su % 10}{Mo % 10}{As % 10}",
        f"{(Su * 100 + Mo * 10 + As) % 1000:03d}",
    ]
    factors = {"sun_sign": Su, "sun_deg": SuD, "moon_sign": Mo, "moon_deg": MoD,
               "asc_sign": As, "asc_deg": AsD}
    return SchoolResult("4.17", "Western Astro", top3, top2, bottom2, set3, factors)
