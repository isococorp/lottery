"""Walk-forward backtest driver (spec §6.2).

Two modes:
  - "exact": prediction must equal the actual draw.
  - "permutation": prediction matches if it is a digit-permutation of the actual.

Deterministic schools are evaluated on every draw. The stats walk-forward school
learns only from draws strictly before each evaluated draw and starts after a
100-draw warm-up (and ≥10 same-weekday draws), per §C.8.
"""
from __future__ import annotations

import datetime
from dataclasses import dataclass, field
from typing import Dict, List

from ..models import Draw
from ..core.pillars import compute_pillars
from ..core.power import compute_power
from .. import schools
from ..schools import school_stats_wf
from . import baselines, metrics

WARMUP_DRAWS = school_stats_wf.WARMUP_DRAWS  # 100


@dataclass
class SchoolBacktest:
    code: str
    name: str
    bottom2: metrics.MetricResult
    set3: metrics.MetricResult
    predictions: List[dict] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {"code": self.code, "name": self.name,
                "bottom2": self.bottom2.as_dict(), "set3": self.set3.as_dict()}


# Deterministic school codes (everything except stats 4.4).
DET_CODES = ["4.1", "4.2", "4.3", "4.5", "4.6", "4.7", "4.8", "4.9", "4.10",
             "4.11", "4.12", "4.15", "4.16", "4.17", "4.18", "4.19", "4.20"]


def _deterministic_predictions(draws: List[Draw]):
    """Yield (draw, {code: SchoolResult}) for the deterministic schools."""
    for dr in draws:
        dt = datetime.datetime.combine(dr.date, dr.time or datetime.time(16, 0))
        p = compute_pillars(dt.year, dt.month, dt.day, dt.hour, dt.minute)
        dp = compute_power(p)
        yield dr, {
            "4.1": schools.school_bazi.generate(p, dp),
            "4.2": schools.school_thai.generate(dt.date(), p),
            "4.3": schools.school_numerology.generate(dt),
            "4.5": schools.school_other.generate(dt),
            "4.6": schools.school_ziwei.generate(dt, p),
            "4.7": schools.school_qimen.generate(dt, p),
            "4.8": schools.school_daliuren.generate(dt, p),
            "4.9": schools.school_meihua.generate(dt),
            "4.10": schools.school_iching.generate(dt, p),
            "4.11": schools.school_xuankong.generate(dt, p),
            "4.12": schools.school_tongsheng.generate(dt, p),
            "4.15": schools.school_pythagorean.generate(dt),
            "4.16": schools.school_chaldean.generate(dt),
            "4.17": schools.school_western.generate(dt),
            "4.18": schools.school_biorhythm.generate(dt),
            "4.19": schools.school_tarot.generate(dt),
            "4.20": schools.school_vedic.generate(dt),
        }


def _collect(draws: List[Draw], mode: str, start=None, end=None):
    """Build per-school hit flags + baseline probs for bottom2 and set3 metrics.

    `start`/`end` (optional dates) restrict which draws are *scored*; history for
    the walk-forward school is unaffected (see metrics.in_window).
    """
    codes = schools.PRODUCTION_CODES
    names = dict(schools.SCHOOL_NAMES)
    b2_hits: Dict[str, list] = {c: [] for c in codes}
    b2_bp: Dict[str, list] = {c: [] for c in codes}
    s3_hits: Dict[str, list] = {c: [] for c in codes}
    s3_bp: Dict[str, list] = {c: [] for c in codes}
    preds: Dict[str, list] = {c: [] for c in codes}

    # Deterministic schools over every draw in the scoring window.
    for dr, res in _deterministic_predictions(draws):
        if not metrics.in_window(dr.date, start, end):
            continue
        for c in DET_CODES:
            sr = res[c]
            hb = metrics.hit_two(sr.bottom2, dr.bottom2, mode)
            if hb is not None:
                b2_hits[c].append(1 if hb else 0)
                b2_bp[c].append(baselines.p_two(sr.bottom2, mode))
            actual_sets = dr.present_set3
            k = len(actual_sets)
            hs = metrics.hit_three_any(sr.set3, actual_sets, mode)
            if hs is not None:
                s3_hits[c].append(1 if hs else 0)
                s3_bp[c].append(baselines.p_any_set3(sr.set3, k, mode))
            preds[c].append({"date": dr.date.isoformat(), "bottom2": sr.bottom2,
                             "actual_b2": dr.bottom2, "hit_b2": bool(hb),
                             "set3": sr.set3, "actual_set3": actual_sets,
                             "hit_set3": bool(hs) if hs is not None else None})

    # Stats walk-forward: only after warm-up, learning from prior draws.
    for i, dr in enumerate(draws):
        if i < WARMUP_DRAWS:
            continue
        if not metrics.in_window(dr.date, start, end):
            continue
        hist = [d for d in draws[:i] if d.weekday == dr.weekday]
        sr = school_stats_wf.generate(hist)
        if sr is None:
            continue
        hb = metrics.hit_two(sr.bottom2, dr.bottom2, mode)
        if hb is not None:
            b2_hits["4.4"].append(1 if hb else 0)
            b2_bp["4.4"].append(baselines.p_two(sr.bottom2, mode))
        actual_sets = dr.present_set3
        k = len(actual_sets)
        hs = metrics.hit_three_any(sr.set3, actual_sets, mode)
        if hs is not None:
            s3_hits["4.4"].append(1 if hs else 0)
            s3_bp["4.4"].append(baselines.p_any_set3(sr.set3, k, mode))
        preds["4.4"].append({"date": dr.date.isoformat(), "bottom2": sr.bottom2,
                             "actual_b2": dr.bottom2, "hit_b2": bool(hb),
                             "set3": sr.set3, "actual_set3": actual_sets,
                             "hit_set3": bool(hs) if hs is not None else None})

    return codes, names, b2_hits, b2_bp, s3_hits, s3_bp, preds


def run_backtest(draws: List[Draw], mode: str = "permutation",
                 start=None, end=None) -> List[SchoolBacktest]:
    codes, names, b2_hits, b2_bp, s3_hits, s3_bp, preds = _collect(draws, mode, start, end)
    out = []
    for c in codes:
        b2 = metrics.summarize(f"{names[c]} 2ล่าง", b2_hits[c], b2_bp[c])
        s3 = metrics.summarize(f"{names[c]} 3ล่าง(4ชุด)", s3_hits[c], s3_bp[c])
        out.append(SchoolBacktest(c, names[c], b2, s3, preds[c]))
    return out
