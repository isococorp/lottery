"""ศาสตร์ 4.2 ดวงไทย — number generation (spec §C.7)."""
from __future__ import annotations

import datetime

from ..core.constants import DAONUM, KAMLANG, THAI_WEEKDAY
from ..core.pillars import Pillars
from .base import SchoolResult


def generate(d: datetime.date, p: Pillars) -> SchoolResult:
    weekday = THAI_WEEKDAY[d.weekday()]
    dao = DAONUM[weekday]
    kl = KAMLANG[weekday]
    yam = (p.hour_branch + 1) % 10

    top3 = f"{dao}{kl:02d}"
    bottom2 = f"{dao}{kl % 10}"
    top2 = f"{dao}{yam}"
    set3 = [
        f"{(dao * 100 + kl) % 1000:03d}",
        f"{(kl * 10 + dao) % 1000:03d}",
        f"{dao}{yam}{kl % 10}",
        f"{(dao + kl + yam) % 1000:03d}",
    ]

    factors = {"weekday": weekday, "dao": dao, "kamlang": kl, "yam": yam}
    return SchoolResult("4.2", "ดวงไทย", top3, top2, bottom2, set3, factors)
