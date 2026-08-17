"""Shared types/helpers for schools.

Every school returns exactly 7 numbers as strings (leading zeros preserved,
spec §4.21.4): top3, top2, bottom2, and four bottom-3 sets.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Dict, Any


def digit_root(n: int) -> int:
    """Repeated digit sum until a single digit. digit_root(0) == 0."""
    n = abs(int(n))
    while n >= 10:
        n = sum(int(c) for c in str(n))
    return n


@dataclass(frozen=True)
class SchoolResult:
    code: str
    name: str
    top3: str          # 3 ตัวบน
    top2: str          # 2 ตัวบน
    bottom2: str       # 2 ตัวล่าง
    set3: List[str]    # 3 ตัวล่าง ชุด 1–4 (length 4)
    factors: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        # Enforce the leading-zero / string contract up front.
        assert len(self.top3) == 3, f"{self.code} top3 len={len(self.top3)}"
        assert len(self.top2) == 2, f"{self.code} top2 len={len(self.top2)}"
        assert len(self.bottom2) == 2, f"{self.code} bottom2 len={len(self.bottom2)}"
        assert len(self.set3) == 4, f"{self.code} set3 count={len(self.set3)}"
        for s in self.set3:
            assert len(s) == 3, f"{self.code} set3 item len={len(s)}"

    def as_dict(self) -> Dict[str, Any]:
        return {
            "code": self.code,
            "name": self.name,
            "numbers": {
                "top3": self.top3,
                "top2": self.top2,
                "bottom2": self.bottom2,
                "set3": list(self.set3),
            },
            "factors": self.factors,
        }
