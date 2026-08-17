"""ศาสตร์ 4.4 สถิติ Walk-forward — number generation (spec §C.8).

State is kept per weekday. A prediction for a target draw is built ONLY from
draws that occurred strictly before it (walk-forward, no leakage):
  - bottom2 = most frequent 2-ล่าง value for that weekday
  - top3    = per-position most frequent digit of 3-บน for that weekday
  - top2    = most frequent 2-บน value for that weekday
  - set3    = the 4 most frequent 3-digit values across all bottom-3 columns

Tie-break (spec §C.8 is silent here — ASSUMPTION, guardrail #9): the most frequent
value is chosen by Python `Counter.most_common`, i.e. among equally-frequent values
the one that first reached that count (earliest chronological appearance). This
reproduces the §C.11 reference (สถิติ WF 17/608) exactly; other tie-breaks do not.
Counters are therefore built by iterating history in chronological order.
"""
from __future__ import annotations

from collections import Counter
from typing import List, Optional

from ..models import Draw
from .base import SchoolResult

WARMUP_DRAWS = 100      # start evaluating only after the 100th overall draw
MIN_WEEKDAY = 10        # …and only with ≥10 prior draws of that weekday


def _most_common(counter: Counter, default: str) -> str:
    if not counter:
        return default
    # Counter.most_common breaks ties by first-reached-max (chronological), which
    # matches the reference implementation (§C.11). Do NOT re-sort by value.
    return counter.most_common(1)[0][0]


def _position_digits(values: List[str], width: int, default: str) -> str:
    if not values:
        return default * width
    out = []
    for i in range(width):
        c = Counter(v[i] for v in values if len(v) == width)
        out.append(c.most_common(1)[0][0] if c else "0")
    return "".join(out)


def generate(history_same_weekday: List[Draw]) -> Optional[SchoolResult]:
    """Build a stats prediction from prior same-weekday draws.

    Returns None when there is not enough weekday history (caller decides how to
    treat warm-up). The overall-warmup (100 draws) is enforced by the caller.
    """
    hist = history_same_weekday
    if len(hist) < MIN_WEEKDAY:
        return None

    b2 = Counter(d.bottom2 for d in hist if d.bottom2)
    t2 = Counter(d.top2 for d in hist if d.top2)
    t3_vals = [d.top3 for d in hist if d.top3]
    set3_vals = Counter()
    for d in hist:
        for s in d.present_set3:
            set3_vals[s] += 1

    bottom2 = _most_common(b2, "00")
    top2 = _most_common(t2, "00")
    top3 = _position_digits(t3_vals, 3, "0")

    top4 = [v for v, _ in set3_vals.most_common(4)]
    while len(top4) < 4:
        top4.append("000")

    factors = {
        "weekday_history": len(hist),
        "bottom2_support": b2.get(bottom2, 0),
        "distinct_set3": len(set3_vals),
    }
    return SchoolResult("4.4", "สถิติ WF", top3, top2, bottom2, top4, factors)
