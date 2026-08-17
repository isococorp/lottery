"""Shared domain model for a single lottery draw.

Numbers are stored as strings to preserve leading zeros (spec §4.21.4).
`set3` holds the four bottom-3 draws (ชุด 1–4); entries may be None for older
draws where a set was not published (pre-2015 ชุด 2, spec §PHASE-1).
"""
from __future__ import annotations

import datetime
from dataclasses import dataclass
from typing import List, Optional

from .core.constants import THAI_WEEKDAY


@dataclass(frozen=True)
class Draw:
    date: datetime.date
    six: Optional[str]          # 6-digit display number
    top3: Optional[str]         # 3 บน
    top2: Optional[str]         # 2 บน
    bottom2: Optional[str]      # 2 ล่าง
    set3: List[Optional[str]]   # 3 ล่าง ชุด 1–4
    time: Optional[datetime.time] = None

    @property
    def weekday(self) -> str:
        return THAI_WEEKDAY[self.date.weekday()]

    @property
    def present_set3(self) -> List[str]:
        """Only the bottom-3 sets that were actually published for this draw."""
        return [s for s in self.set3 if s]
