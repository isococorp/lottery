"""ศาสตร์ 4.1 ดวงจีน — number generation (spec §C.6)."""
from __future__ import annotations

from ..core.constants import SE, BE, HETU
from ..core.pillars import Pillars
from ..core.power import DayPower
from .base import SchoolResult


def _hetu(elem: str, is_yang: bool) -> int:
    return HETU[elem][0] if is_yang else HETU[elem][1]


def generate(p: Pillars, dp: DayPower) -> SchoolResult:
    dmD = _hetu(SE[p.day_stem], p.day_stem % 2 == 0)
    seatD = _hetu(BE[p.day_branch], p.day_branch % 2 == 0)
    power = dp.power
    pwD = power % 10  # Python modulo maps negatives into 0–9

    top3 = f"{dmD}{seatD}{pwD}"
    bottom2 = f"{dmD}{(power + 10) % 10}"
    top2 = f"{seatD}{pwD}"

    set3 = [
        f"{_hetu(SE[p.hour_stem], p.hour_stem % 2 == 0)}"
        f"{_hetu(BE[p.hour_branch], p.hour_branch % 2 == 0)}{dmD}",
        f"{_hetu(SE[p.month_stem], p.month_stem % 2 == 0)}"
        f"{_hetu(BE[p.month_branch], p.month_branch % 2 == 0)}{dmD}",
        f"{_hetu(SE[p.year_stem], p.year_stem % 2 == 0)}"
        f"{_hetu(BE[p.year_branch], p.year_branch % 2 == 0)}{seatD}",
        f"{pwD}{(dp.A + 10) % 10}{(dp.B + 10) % 10}",
    ]

    factors = {
        "day_master_hetu": dmD,
        "seat_hetu": seatD,
        "power": power,
        "power_digit": pwD,
        "A": dp.A,
        "B": dp.B,
        "four_pillars": [p.year_gz, p.month_gz, p.day_gz, p.hour_gz],
    }
    return SchoolResult("4.1", "ดวงจีน", top3, top2, bottom2, set3, factors)
