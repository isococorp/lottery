"""Hit-testing + statistics for the backtest (spec §4.21.10, §6.3.1)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

import numpy as np
from scipy.stats import binomtest

from .baselines import perm_count


def _multiset_eq(a: str, b: str) -> bool:
    return sorted(a) == sorted(b)


def hit_two(pred: Optional[str], actual: Optional[str], mode: str) -> Optional[bool]:
    if pred is None or actual is None:
        return None
    if mode == "exact":
        return pred == actual
    return _multiset_eq(pred, actual)


def hit_three_any(pred_sets: List[str], actual_sets: List[str], mode: str) -> Optional[bool]:
    """Does any predicted 3-digit set match any published actual set?"""
    actual = [a for a in actual_sets if a]
    if not actual:
        return None
    for p in pred_sets:
        for a in actual:
            if (p == a) if mode == "exact" else _multiset_eq(p, a):
                return True
    return False


@dataclass
class MetricResult:
    label: str
    hits: int
    n: int
    baseline_p: float
    p_value: float
    ci_low: float
    ci_high: float
    per_draw_hit: List[int] = field(default_factory=list)

    @property
    def rate(self) -> float:
        return self.hits / self.n if self.n else 0.0

    @property
    def beats_random(self) -> bool:
        # "ชนะการสุ่ม": bootstrap CI lower bound above the random baseline.
        return self.ci_low > self.baseline_p

    def as_dict(self) -> dict:
        return {
            "label": self.label, "hits": self.hits, "n": self.n,
            "rate": self.rate, "baseline_p": self.baseline_p,
            "p_value": self.p_value, "ci_low": self.ci_low, "ci_high": self.ci_high,
            "beats_random": self.beats_random,
        }


def summarize(label: str, hit_flags: List[int], baseline_ps: List[float],
              n_boot: int = 2000, seed: int = 12345) -> MetricResult:
    n = len(hit_flags)
    hits = int(sum(hit_flags))
    baseline_p = float(np.mean(baseline_ps)) if baseline_ps else 0.0

    # Binomial exact test against the mean baseline probability. Two-sided: the
    # system's claim is that no school DIFFERS from random (not merely "beats"),
    # and two-sided reproduces the §C.11 reference p-values exactly.
    if n > 0:
        p_value = float(binomtest(hits, n, min(max(baseline_p, 1e-12), 1 - 1e-12),
                                  alternative="two-sided").pvalue)
    else:
        p_value = 1.0

    # Bootstrap 95% CI on the hit rate (deterministic seed for reproducibility).
    if n > 0:
        rng = np.random.default_rng(seed)
        arr = np.asarray(hit_flags, dtype=float)
        idx = rng.integers(0, n, size=(n_boot, n))
        rates = arr[idx].mean(axis=1)
        ci_low, ci_high = np.percentile(rates, [2.5, 97.5])
    else:
        ci_low = ci_high = 0.0

    return MetricResult(label, hits, n, baseline_p, p_value,
                        float(ci_low), float(ci_high), list(hit_flags))
