"""Per-draw hit data for progressive window analysis (วิเคราะห์วิชา).

Computes hit status (exact/swapped/miss) for every school × position × draw.
The frontend uses suffix sums over this data to show how metrics change as
older draws are progressively removed from the scoring window.
"""
from __future__ import annotations

from typing import Dict, List

from ..models import Draw
from .. import schools
from ..schools import school_stats_wf
from .walkforward import _deterministic_predictions, DET_CODES, WARMUP_DRAWS


def _hit_code(pred, actual) -> int:
    """2 = exact, 1 = swapped (permutation only), 0 = miss."""
    if not pred or not actual:
        return 0
    if pred == actual:
        return 2
    if sorted(pred) == sorted(actual):
        return 1
    return 0


def _set3_hit_code(pred_sets, actual_sets) -> int:
    actual = [a for a in actual_sets if a]
    if not actual or not pred_sets:
        return 0
    if any(p == a for p in pred_sets for a in actual):
        return 2
    if any(sorted(p) == sorted(a) for p in pred_sets for a in actual):
        return 1
    return 0


def run_per_draw_hits(draws: List[Draw]) -> dict:
    """Return per-draw hit codes for every production school.

    Response shape::

        {
          "dates": ["1996-01-16", ...],
          "schools": {
            "4.1": {"name": "ดวงจีน", "hits": [[t3,t2,b2,s3], ...]},
            ...
          }
        }

    Each hit entry is [top3, top2, bottom2, set3] where values are
    0 (miss), 1 (swapped), 2 (exact).
    """
    codes = schools.PRODUCTION_CODES
    names = dict(schools.SCHOOL_NAMES)

    dates: List[str] = [d.date.isoformat() for d in draws]
    school_hits: Dict[str, List[List[int]]] = {c: [] for c in codes}

    for dr, res in _deterministic_predictions(draws):
        for c in DET_CODES:
            sr = res[c]
            school_hits[c].append([
                _hit_code(sr.top3, dr.top3),
                _hit_code(sr.top2, dr.top2),
                _hit_code(sr.bottom2, dr.bottom2),
                _set3_hit_code(sr.set3, dr.present_set3),
            ])

    for i, dr in enumerate(draws):
        if i < WARMUP_DRAWS:
            school_hits["4.4"].append([0, 0, 0, 0])
            continue
        hist = [d for d in draws[:i] if d.weekday == dr.weekday]
        sr = school_stats_wf.generate(hist)
        if sr is None:
            school_hits["4.4"].append([0, 0, 0, 0])
            continue
        school_hits["4.4"].append([
            _hit_code(sr.top3, dr.top3),
            _hit_code(sr.top2, dr.top2),
            _hit_code(sr.bottom2, dr.bottom2),
            _set3_hit_code(sr.set3, dr.present_set3),
        ])

    return {
        "dates": dates,
        "schools": {
            c: {"name": names[c], "hits": school_hits[c]}
            for c in codes
        },
    }
