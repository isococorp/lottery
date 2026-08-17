"""Random baselines for the backtest (spec §6.3 / §C.10).

CAUTION (real bug guarded by tests): for the 4-set bottom-3 metric, the
random baseline MUST raise the per-draw miss probability to the power k, where
k is the number of published actual sets for that draw. Forgetting the exponent
made every p-value collapse to 0.
"""
from __future__ import annotations

from functools import lru_cache
from itertools import permutations
from math import prod


@lru_cache(maxsize=4096)
def perm_count(s: str) -> int:
    """Distinct digit permutations of `s`. '55'->1, '53'->2, '553'->3, '531'->6."""
    return len(set(permutations(s)))


def p_two(pred: str, mode: str) -> float:
    """Baseline hit probability for a 2-digit prediction."""
    if mode == "exact":
        return 1 / 100
    return perm_count(pred) / 100


def p_three(pred: str, mode: str) -> float:
    """Baseline hit probability for a single 3-digit prediction."""
    if mode == "exact":
        return 1 / 1000
    return perm_count(pred) / 1000


def p_any_set3(predicted_set3, k: int, mode: str) -> float:
    """Baseline P(at least one of 4 predicted 3-digit sets hits) vs k actual sets.

    p_any = 1 - Π_x (1 - p_three(x))**k   — the **k** exponent is mandatory.
    """
    if k <= 0:
        return 0.0
    return 1 - prod((1 - p_three(x, mode)) ** k for x in predicted_set3)
