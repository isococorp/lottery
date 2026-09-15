"""Shared Swiss Ephemeris helpers for §4.17 (Western) and §4.20 (Vedic).

Fidelity: uses the REAL Swiss Ephemeris data files (sepl_18.se1 / semo_18.se1,
coverage 1800–2399) shipped in services/engine/ephe — FLG_SWIEPH. If the files
are absent in an environment, falls back to the built-in Moshier analytical
ephemeris and reports that honestly via `ephemeris_source()` (§4.21.7 — never
pretend precision that isn't there).

Thai draws are local ICT (UTC+7, no DST); we convert to UT. A fixed observer
location (Bangkok) is used for the ascendant.
"""
from __future__ import annotations

import datetime
import os

import swisseph as swe

BKK_LAT, BKK_LON = 13.7563, 100.5018
ICT_OFFSET = 7

_EPHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))), "ephe")
_HAS_FILES = (os.path.exists(os.path.join(_EPHE_DIR, "sepl_18.se1"))
              and os.path.exists(os.path.join(_EPHE_DIR, "semo_18.se1")))

if _HAS_FILES:
    swe.set_ephe_path(_EPHE_DIR)
    FLAGS = swe.FLG_SWIEPH
else:  # honest fallback — lower precision, reported via ephemeris_source()
    FLAGS = swe.FLG_MOSEPH


def ephemeris_source() -> str:
    return "swiss(se1)" if _HAS_FILES else "moshier(fallback)"


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
