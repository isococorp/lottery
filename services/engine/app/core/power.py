"""Day Power (พลังวัน) scoring — spec §C.4 / §C.5.

A = heavenly-stem contribution of hour + month + year (NOT day/day-master).
B = earthly-branch contribution of all four pillars.
power = A + B.
"""
from __future__ import annotations

from dataclasses import dataclass

from .constants import SE, BE, MX, GanTH
from .pillars import Pillars


@dataclass(frozen=True)
class DayPower:
    day_master: str   # element of the day stem
    A: int
    B: int
    power: int
    label: str        # e.g. "น้ำยิ่ม -3"

    def as_dict(self) -> dict:
        return {"day_master": self.day_master, "A": self.A, "B": self.B,
                "power": self.power, "label": self.label}


def compute_power(p: Pillars) -> DayPower:
    dm = SE[p.day_stem]  # day-master element
    mx = MX[dm]

    # กิ่งฟ้า (heavenly stems): hour + month + year — day master excluded (§C.5)
    A = mx[SE[p.hour_stem]] + mx[SE[p.month_stem]] + mx[SE[p.year_stem]]
    # กิ่งดิน (earthly branches): all four pillars
    B = (mx[BE[p.hour_branch]] + mx[BE[p.day_branch]]
         + mx[BE[p.month_branch]] + mx[BE[p.year_branch]])
    power = A + B

    label = f"{dm}{GanTH[p.day_stem]} {power:+d}"
    return DayPower(dm, A, B, power, label)
