"""ศาสตร์ 4.20 Vedic Astrology (Jyotisha) — number generation (Swiss Ephemeris).

Sidereal zodiac (Lahiri ayanamsa). Uses the Panchanga elements derived from the
sidereal Sun/Moon longitudes: Nakshatra + Pada, Tithi, Yoga, and Moon Rashi.
"""
from __future__ import annotations

import datetime

import swisseph as swe

from .base import SchoolResult
from ._swe_helpers import jd_ut, longitude

_NAK = 360 / 27          # 13°20' per nakshatra
_PADA = _NAK / 4         # 3°20' per pada


def generate(dt: datetime.datetime) -> SchoolResult:
    swe.set_sid_mode(swe.SIDM_LAHIRI, 0, 0)
    jd = jd_ut(dt)
    sun = longitude(jd, swe.SUN, sidereal=True)
    moon = longitude(jd, swe.MOON, sidereal=True)

    nak = int(moon / _NAK)                        # 0–26
    pada = int((moon % _NAK) / _PADA)             # 0–3
    tithi = int(((moon - sun) % 360) / 12)        # 0–29
    yoga = int(((moon + sun) % 360) / _NAK)       # 0–26
    rashi = int(moon // 30)                       # 0–11

    N, Pd, Ti, Yo, Ra = nak + 1, pada + 1, tithi + 1, yoga + 1, rashi + 1
    top3 = f"{N:02d}{Pd}"
    top2 = f"{Ti % 100:02d}"
    bottom2 = f"{Yo % 100:02d}"
    set3 = [
        f"{Ra:02d}{N % 10}",
        f"{(N + Ti + Yo) % 1000:03d}",
        f"{N % 10}{Ti % 10}{Yo % 10}",
        f"{(Ti * 10 + Pd) % 1000:03d}",
    ]
    factors = {"nakshatra": N, "pada": Pd, "tithi": Ti, "yoga": Yo, "moon_rashi": Ra}
    return SchoolResult("4.20", "Vedic Astro", top3, top2, bottom2, set3, factors)
