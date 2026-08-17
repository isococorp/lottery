"""ศาสตร์ 4.18 Biorhythm — number generation (approved mapping).

Three sine cycles (physical 23, emotional 28, intellectual 33 days). Lottery has no
"birth date", so the Julian Day Number of the draw date is used as the fixed epoch
reference — making each cycle a deterministic function of the date alone.
"""
from __future__ import annotations

import datetime
import math

from ..core.pillars import jdn
from .base import SchoolResult


def _pct(J: int, period: int) -> int:
    """Sine phase mapped to 0–99."""
    return round((math.sin(2 * math.pi * (J % period) / period) + 1) / 2 * 99)


def generate(dt: datetime.datetime) -> SchoolResult:
    J = jdn(dt.year, dt.month, dt.day)
    P = _pct(J, 23)   # physical
    E = _pct(J, 28)   # emotional
    I = _pct(J, 33)   # intellectual

    top3 = f"{(P + E + I) % 1000:03d}"
    top2 = f"{P:02d}"
    bottom2 = f"{E:02d}"
    set3 = [
        f"{I:02d}{(P + E) % 10}",
        f"{P // 10}{E // 10}{I // 10}",
        f"{P % 10}{E % 10}{I % 10}",
        f"{(P * E + I) % 1000:03d}",
    ]

    factors = {"jdn": J, "physical": P, "emotional": E, "intellectual": I}
    return SchoolResult("4.18", "Biorhythm", top3, top2, bottom2, set3, factors)
