"""Shared Swiss Ephemeris helpers for §4.17 (Western) and §4.20 (Vedic).

Uses the built-in Moshier analytical ephemeris (FLG_MOSEPH) so no external data
files are required. Thai draws are local ICT (UTC+7, no DST); we convert to UT.
A fixed observer location (Bangkok) is used for the ascendant.
"""
from __future__ import annotations

import datetime

import swisseph as swe

BKK_LAT, BKK_LON = 13.7563, 100.5018
ICT_OFFSET = 7
FLAGS = swe.FLG_MOSEPH


def jd_ut(dt: datetime.datetime) -> float:
    ut = dt.hour + dt.minute / 60 - ICT_OFFSET
    return swe.julday(dt.year, dt.month, dt.day, ut)


def longitude(jd: float, planet: int, sidereal: bool = False) -> float:
    flags = FLAGS | (swe.FLG_SIDEREAL if sidereal else 0)
    res = swe.calc_ut(jd, planet, flags)
    return res[0][0]  # ecliptic longitude in degrees


def ascendant(jd: float) -> float:
    _cusps, ascmc = swe.houses_ex(jd, BKK_LAT, BKK_LON, b"P", FLAGS)
    return ascmc[0]
