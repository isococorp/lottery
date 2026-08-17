"""Shared deterministic helpers for the Chinese-metaphysics schools
(§4.6, §4.7, §4.8, §4.11, §4.12). Kept together to avoid duplication.
"""
from __future__ import annotations


def gz_index(stem: int, branch: int) -> int:
    """60-jiazi index (0–59) for a (stem 0–9, branch 0–11) pair."""
    for k in range(6):
        g = stem + 10 * k
        if g % 12 == branch:
            return g
    raise ValueError(f"invalid ganzhi stem={stem} branch={branch}")


def digit_single(n: int) -> int:
    """Reduce to a single digit 1–9 (0 stays 0)."""
    n = abs(int(n))
    while n > 9:
        n = sum(int(c) for c in str(n))
    return n


# 納音五行 → 五行局 number (水2 木3 金4 土5 火6) per 60-jiazi pair (30 entries).
BUREAU_PAIR = [4, 6, 3, 5, 4, 6, 2, 5, 4, 3, 2, 5, 6, 3, 2, 4, 6, 3, 5, 4,
               6, 2, 5, 4, 3, 2, 5, 6, 3, 2]

# 五虎遁: year stem -> stem of the 寅 palace/month.
YIN_STEM = {0: 2, 5: 2, 1: 4, 6: 4, 2: 6, 7: 6, 3: 8, 8: 8, 4: 0, 9: 0}

# 玄空 月紫白 starting star by year-branch group.
MONTH_START = {0: 8, 6: 8, 3: 8, 9: 8,     # 子午卯酉
               4: 5, 10: 5, 1: 5, 7: 5,    # 辰戌丑未
               2: 2, 8: 2, 5: 2, 11: 2}    # 寅申巳亥

# 日干寄宮: day stem -> branch it lodges in (大六壬).
GAN_JI = {0: 2, 1: 4, 2: 5, 3: 7, 4: 5, 5: 7, 6: 8, 7: 10, 8: 11, 9: 1}


def bureau_of(stem: int, branch: int) -> int:
    """五行局 number from the palace ganzhi via 納音."""
    return BUREAU_PAIR[gz_index(stem, branch) // 2]
