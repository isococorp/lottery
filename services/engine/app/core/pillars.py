"""Four Pillars (สี่เสา) computation — spec §C.2 / §C.3.

Production path uses the `sxtwl` Chinese-calendar library for the year/month/day
ganzhi (correct solar-term boundaries). The hour stem/branch is derived from the
day stem via 五鼠遁 (§C.3). A pure-Python JDN fallback is provided for parity with
the JS fallback described in the spec, but `sxtwl` is authoritative in the engine.
"""
from __future__ import annotations

from dataclasses import dataclass

from .constants import Gan, Zhi, GanTH, ZhiTH, SE, BE

try:
    import sxtwl  # type: ignore
    _HAS_SXTWL = True
except Exception:  # pragma: no cover - engine images always ship sxtwl
    _HAS_SXTWL = False


@dataclass(frozen=True)
class Pillars:
    """Stem/branch indices for the four pillars plus the hour resolution used."""
    year_stem: int
    year_branch: int
    month_stem: int
    month_branch: int
    day_stem: int
    day_branch: int
    hour_stem: int
    hour_branch: int
    source: str  # "sxtwl" or "jdn-fallback"

    def gz(self, stem: int, branch: int) -> str:
        return Gan[stem] + Zhi[branch]

    @property
    def year_gz(self) -> str:
        return self.gz(self.year_stem, self.year_branch)

    @property
    def month_gz(self) -> str:
        return self.gz(self.month_stem, self.month_branch)

    @property
    def day_gz(self) -> str:
        return self.gz(self.day_stem, self.day_branch)

    @property
    def hour_gz(self) -> str:
        return self.gz(self.hour_stem, self.hour_branch)

    def as_dict(self) -> dict:
        return {
            "year": {"gz": self.year_gz, "stem": self.year_stem, "branch": self.year_branch},
            "month": {"gz": self.month_gz, "stem": self.month_stem, "branch": self.month_branch},
            "day": {"gz": self.day_gz, "stem": self.day_stem, "branch": self.day_branch,
                    "stem_th": GanTH[self.day_stem], "branch_th": ZhiTH[self.day_branch],
                    "element": SE[self.day_stem]},
            "hour": {"gz": self.hour_gz, "stem": self.hour_stem, "branch": self.hour_branch},
            "source": self.source,
        }


def _hour_branch(hh: int) -> int:
    """Earthly branch of the hour (§C.3). 16:00 -> 申 (8)."""
    return ((hh + 1) % 24) // 2


def _hour_stem(day_stem: int, hour_branch: int) -> int:
    """Hour stem from day stem via 五鼠遁 (§C.3)."""
    hs0 = {0: 0, 5: 0, 1: 2, 6: 2, 2: 4, 7: 4, 3: 6, 8: 6, 4: 8, 9: 8}[day_stem]
    return (hs0 + hour_branch) % 10


# ---------------------------------------------------------------------------
# JDN fallback (parity with the spec's JS fallback — NOT used when sxtwl loads)
# ---------------------------------------------------------------------------

def jdn(y: int, m: int, d: int) -> int:
    a = (14 - m) // 12
    yy = y + 4800 - a
    mm = m + 12 * a - 3
    return d + (153 * mm + 2) // 5 + 365 * yy + yy // 4 - yy // 100 + yy // 400 - 32045


def _fallback_pillars(y: int, m: int, d: int, hh: int) -> Pillars:
    day_stem = (jdn(y, m, d) + 9) % 10
    day_branch = (jdn(y, m, d) + 1) % 12

    solar_year = y - 1 if (m < 2 or (m == 2 and d < 4)) else y
    year_stem = (solar_year - 4) % 10
    year_branch = (solar_year - 4) % 12

    jieDOM = [6, 4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7]
    sm = m if d >= jieDOM[m - 1] else m - 1
    sm = 12 if sm == 0 else sm
    month_branch = sm % 12
    first_month_stem = {0: 2, 5: 2, 1: 4, 6: 4, 2: 6, 7: 6, 3: 8, 8: 8, 4: 0, 9: 0}[year_stem]
    month_stem = (first_month_stem + (month_branch - 2) % 12) % 10

    hb = _hour_branch(hh)
    return Pillars(year_stem, year_branch, month_stem, month_branch,
                   day_stem, day_branch, _hour_stem(day_stem, hb), hb, "jdn-fallback")


def compute_pillars(y: int, m: int, d: int, hh: int, mi: int = 0) -> Pillars:
    """Return the four pillars for a solar datetime.

    Uses sxtwl for year/month/day ganzhi (authoritative solar-term boundaries);
    the hour pillar is derived deterministically from the day stem (§C.3).
    """
    if not _HAS_SXTWL:
        return _fallback_pillars(y, m, d, hh)

    day = sxtwl.fromSolar(y, m, d)
    yg = day.getYearGZ()   # switches at 立春 by default
    mg = day.getMonthGZ()  # switches at 節 by default
    dg = day.getDayGZ()
    hb = _hour_branch(hh)
    hs = _hour_stem(dg.tg, hb)
    return Pillars(yg.tg, yg.dz, mg.tg, mg.dz, dg.tg, dg.dz, hs, hb, "sxtwl")
