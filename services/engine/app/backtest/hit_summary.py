"""Per-school hit summary over the whole dataset (หน้าคำนวน — สรุปถูกตรง/ถูกสลับ).

For every production วิชา, count how often each predicted position matched the
actual draw across ALL historical งวด in the database, split into:
  - exact   (ถูกตรง)  : same digits in the same order
  - swapped (ถูกสลับ) : a digit-permutation match that is NOT already exact

Positions scored: top3 (3 บน), top2 (2 บน), bottom2 (2 ล่าง),
set3 (3 ล่าง ชุด 1–4 — any predicted set matching any published actual set).

Deterministic schools are scored on every draw; the walk-forward school (4.4) is
scored only after the warm-up and learns from prior draws only (no look-ahead),
matching the backtest driver in `walkforward.py`.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List

from ..models import Draw
from .. import schools
from ..schools import school_stats_wf
from . import metrics
from .walkforward import _deterministic_predictions, DET_CODES, WARMUP_DRAWS


@dataclass
class PosCount:
    n: int = 0          # งวดที่ให้คะแนนได้ (มีทั้งเลขทำนายและผลจริง)
    exact: int = 0      # ถูกตรง
    swapped: int = 0    # ถูกสลับตำแหน่งเท่านั้น (ไม่นับที่ตรงเป๊ะอยู่แล้ว)

    def add_two(self, pred, actual):
        """Score a 2/3-digit position (top3, top2, bottom2)."""
        if not pred or not actual:
            return
        self.n += 1
        if pred == actual:
            self.exact += 1
        elif sorted(pred) == sorted(actual):
            self.swapped += 1

    def add_set3(self, pred_sets, actual_sets):
        """Score the bottom-3 sets: best match across all predicted/actual sets."""
        actual = [a for a in actual_sets if a]
        if not actual:
            return
        self.n += 1
        if any(p == a for p in pred_sets for a in actual):
            self.exact += 1
        elif any(sorted(p) == sorted(a) for p in pred_sets for a in actual):
            self.swapped += 1

    def as_dict(self) -> dict:
        return {"n": self.n, "exact": self.exact, "swapped": self.swapped}


@dataclass
class SchoolHitSummary:
    code: str
    name: str
    top3: PosCount
    top2: PosCount
    bottom2: PosCount
    set3: PosCount

    def as_dict(self) -> dict:
        return {"code": self.code, "name": self.name,
                "top3": self.top3.as_dict(), "top2": self.top2.as_dict(),
                "bottom2": self.bottom2.as_dict(), "set3": self.set3.as_dict()}


def run_hit_summary(draws: List[Draw], start=None, end=None) -> List[dict]:
    """`start`/`end` (optional dates) restrict which งวด are scored; the walk-forward
    school still learns from all prior draws (no look-ahead), only its scoring set is
    windowed — same semantics as the backtest driver."""
    codes = schools.PRODUCTION_CODES
    names = dict(schools.SCHOOL_NAMES)
    acc = {c: SchoolHitSummary(c, names[c], PosCount(), PosCount(), PosCount(), PosCount())
           for c in codes}

    # Deterministic schools over every draw in the scoring window.
    for dr, res in _deterministic_predictions(draws):
        if not metrics.in_window(dr.date, start, end):
            continue
        for c in DET_CODES:
            sr, s = res[c], acc[c]
            s.top3.add_two(sr.top3, dr.top3)
            s.top2.add_two(sr.top2, dr.top2)
            s.bottom2.add_two(sr.bottom2, dr.bottom2)
            s.set3.add_set3(sr.set3, dr.present_set3)

    # Stats walk-forward: only after warm-up, learning from prior draws only.
    for i, dr in enumerate(draws):
        if i < WARMUP_DRAWS:
            continue
        if not metrics.in_window(dr.date, start, end):
            continue
        hist = [d for d in draws[:i] if d.weekday == dr.weekday]
        sr = school_stats_wf.generate(hist)
        if sr is None:
            continue
        s = acc["4.4"]
        s.top3.add_two(sr.top3, dr.top3)
        s.top2.add_two(sr.top2, dr.top2)
        s.bottom2.add_two(sr.bottom2, dr.bottom2)
        s.set3.add_set3(sr.set3, dr.present_set3)

    return [acc[c].as_dict() for c in codes]
