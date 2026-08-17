"""§4.4-EXT Baseline Models (spec §4.21.6) — walk-forward statistical predictors.

Required by §4.21.6 ("Baseline Models อย่างน้อย 5 ชุด") and §4.21.10 ("Baseline
Comparison"). These are LAYER-2 statistical methods, NOT belief schools — each
learns only from draws strictly before the evaluated draw (no leakage), starts
after a 100-draw warm-up, and is reported with the same honesty discipline: none
is expected to beat random, and wording avoids gambler's-fallacy claims.

Each predictor returns (top3, top2, bottom2, set3) as strings (leading zeros kept).
"""
from __future__ import annotations

import math
from collections import Counter
from typing import List, Optional, Tuple

from ..models import Draw

WARMUP = 100
RECENT_WINDOW = 50
EMA_HALFLIFE = 26.0

Pred = Tuple[str, str, str, List[str]]


def _pos_digits(values: List[str], width: int) -> str:
    out = []
    for i in range(width):
        c = Counter(v[i] for v in values if len(v) == width)
        out.append(c.most_common(1)[0][0] if c else "0")
    return "".join(out)


def _top_sets(hist: List[Draw], n: int = 4) -> List[str]:
    c = Counter()
    for d in hist:
        for s in d.present_set3:
            c[s] += 1
    top = [v for v, _ in c.most_common(n)]
    while len(top) < n:
        top.append("000")
    return top


def _freq_pred(hist: List[Draw]) -> Pred:
    b2 = Counter(d.bottom2 for d in hist if d.bottom2)
    t2 = Counter(d.top2 for d in hist if d.top2)
    t3 = [d.top3 for d in hist if d.top3]
    bottom2 = b2.most_common(1)[0][0] if b2 else "00"
    top2 = t2.most_common(1)[0][0] if t2 else "00"
    top3 = _pos_digits(t3, 3)
    return top3, top2, bottom2, _top_sets(hist)


# --- B1 Random ------------------------------------------------------------

def random_baseline(hist: List[Draw], draw: Draw) -> Pred:
    """Deterministic pseudo-random pick seeded by the draw date (history-free)."""
    o = draw.date.toordinal()
    b2 = f"{(o * 7919) % 100:02d}"
    t2 = f"{(o * 104729) % 100:02d}"
    t3 = f"{(o * 1299709) % 1000:03d}"
    set3 = [f"{(o * p) % 1000:03d}" for p in (15485863, 32452843, 49979687, 67867967)]
    return t3, t2, b2, set3


# --- B2 Long-term frequency ----------------------------------------------

def long_frequency(hist: List[Draw], draw: Draw) -> Pred:
    return _freq_pred(hist)


# --- B3 Recent frequency --------------------------------------------------

def recent_frequency(hist: List[Draw], draw: Draw) -> Pred:
    return _freq_pred(hist[-RECENT_WINDOW:])


# --- B4 EMA-weighted frequency -------------------------------------------

def ema_frequency(hist: List[Draw], draw: Draw) -> Pred:
    decay = math.log(2) / EMA_HALFLIFE
    n = len(hist)
    wb2, wt2 = Counter(), Counter()
    wsets = Counter()
    pos = [Counter(), Counter(), Counter()]
    for idx, d in enumerate(hist):
        age = n - 1 - idx
        w = math.exp(-decay * age)
        if d.bottom2:
            wb2[d.bottom2] += w
        if d.top2:
            wt2[d.top2] += w
        if d.top3 and len(d.top3) == 3:
            for i in range(3):
                pos[i][d.top3[i]] += w
        for s in d.present_set3:
            wsets[s] += w
    bottom2 = wb2.most_common(1)[0][0] if wb2 else "00"
    top2 = wt2.most_common(1)[0][0] if wt2 else "00"
    top3 = "".join(p.most_common(1)[0][0] if p else "0" for p in pos)
    top = [v for v, _ in wsets.most_common(4)]
    while len(top) < 4:
        top.append("000")
    return top3, top2, bottom2, top


# --- B5 Gap / Overdue -----------------------------------------------------

def gap_overdue(hist: List[Draw], draw: Draw) -> Pred:
    """Pick the value with the largest current gap (longest since last seen).

    Reported as a testable statistic — NOT a claim that an absent number is 'due'
    (§4.21.6 forbids gambler's-fallacy wording).
    """
    last_seen = {}
    for idx, d in enumerate(hist):
        if d.bottom2:
            last_seen[d.bottom2] = idx
    n = len(hist)
    # Among all 00–99, the biggest gap = never seen (gap=n) or oldest last-seen.
    def gap(v):
        return n - last_seen[v] if v in last_seen else n + 1
    bottom2 = max((f"{i:02d}" for i in range(100)), key=lambda v: (gap(v), v))
    # For top3/sets reuse long-frequency (gap is meaningful mainly for 2-digit).
    t3, t2, _b, sets = _freq_pred(hist)
    return t3, t2, bottom2, sets


# --- B6 Simple ensemble (equal-weight vote) -------------------------------

_MEMBERS = [long_frequency, recent_frequency, ema_frequency, gap_overdue]


def simple_ensemble(hist: List[Draw], draw: Draw) -> Pred:
    votes_b2, votes_t2, votes_t3 = Counter(), Counter(), Counter()
    set_votes = Counter()
    for fn in _MEMBERS:
        t3, t2, b2, sets = fn(hist, draw)
        votes_b2[b2] += 1
        votes_t2[t2] += 1
        votes_t3[t3] += 1
        for s in sets:
            set_votes[s] += 1
    bottom2 = votes_b2.most_common(1)[0][0]
    top2 = votes_t2.most_common(1)[0][0]
    top3 = votes_t3.most_common(1)[0][0]
    top = [v for v, _ in set_votes.most_common(4)]
    while len(top) < 4:
        top.append("000")
    return top3, top2, bottom2, top


BASELINES = [
    ("B1", "Random", random_baseline),
    ("B2", "Long Freq", long_frequency),
    ("B3", "Recent Freq", recent_frequency),
    ("B4", "EMA", ema_frequency),
    ("B5", "Gap/Overdue", gap_overdue),
    ("B6", "Simple Ensemble", simple_ensemble),
]


def run_baseline_backtest(draws: List[Draw], mode: str = "permutation") -> List[dict]:
    """Walk-forward backtest of the §4.21.6 baselines (bottom2 + set3 metrics)."""
    from . import baselines as base_p
    from . import metrics

    ordered = sorted(draws, key=lambda d: d.date)
    out = []
    for code, name, fn in BASELINES:
        b2_hits, b2_bp, s3_hits, s3_bp = [], [], [], []
        for i in range(WARMUP, len(ordered)):
            dr = ordered[i]
            hist = ordered[:i]
            _t3, _t2, bottom2, set3 = fn(hist, dr)
            hb = metrics.hit_two(bottom2, dr.bottom2, mode)
            if hb is not None:
                b2_hits.append(1 if hb else 0)
                b2_bp.append(base_p.p_two(bottom2, mode))
            actual_sets = dr.present_set3
            hs = metrics.hit_three_any(set3, actual_sets, mode)
            if hs is not None:
                s3_hits.append(1 if hs else 0)
                s3_bp.append(base_p.p_any_set3(set3, len(actual_sets), mode))
        b2 = metrics.summarize(f"{name} 2ล่าง", b2_hits, b2_bp)
        s3 = metrics.summarize(f"{name} 3ล่าง(4ชุด)", s3_hits, s3_bp)
        out.append({"code": code, "name": name,
                    "bottom2": b2.as_dict(), "set3": s3.as_dict()})
    return out
