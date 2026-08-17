"""Backtest regression tests against the §C.11 reference (permutation mode).

Requires the source Excel mounted at $TIANMING_DATA_XLSX (default /data/thai.xlsx).
The hit counts must match EXACTLY; p-values match to 3 decimals (§C.11 note).
"""
import os
import math

import pytest

from app.data.excel_loader import load_draws
from app.backtest.walkforward import run_backtest
from app.backtest.baselines import perm_count, p_any_set3

DATA = os.environ.get("TIANMING_DATA_XLSX", "/data/thai.xlsx")

# name -> (hits, n, p_value) for bottom-2, permutation mode (§C.11)
REF = {
    "ดวงจีน": (20, 708, 0.096),
    "ดวงไทย": (11, 708, 0.501),
    "เลขศาสตร์": (18, 708, 0.211),
    "สถิติ WF": (17, 608, 0.189),
    "ศาสตร์อื่น": (12, 708, 0.890),
}


@pytest.fixture(scope="module")
def backtest_permutation():
    if not os.path.exists(DATA):
        pytest.skip(f"data file not mounted at {DATA}")
    draws, report = load_draws(DATA)
    assert len(draws) == 708, f"expected 708 draws, got {len(draws)}"
    return run_backtest(draws, "permutation")


@pytest.mark.parametrize("name", list(REF.keys()))
def test_c11_counts_and_pvalues(backtest_permutation, name):
    sb = next(s for s in backtest_permutation if s.name == name)
    hits, n, pv = REF[name]
    assert sb.bottom2.hits == hits, f"{name} hits {sb.bottom2.hits} != {hits}"
    assert sb.bottom2.n == n, f"{name} n {sb.bottom2.n} != {n}"
    assert math.isclose(sb.bottom2.p_value, pv, abs_tol=0.001), \
        f"{name} p {sb.bottom2.p_value:.3f} != {pv}"


def test_no_school_beats_random(backtest_permutation):
    # System thesis (§A.4): nothing beats random. CI-low must not exceed baseline.
    for sb in backtest_permutation:
        assert not sb.bottom2.beats_random, f"{sb.name} unexpectedly beats random"


def test_perm_count_examples():
    assert perm_count("55") == 1
    assert perm_count("53") == 2
    assert perm_count("555") == 1
    assert perm_count("553") == 3
    assert perm_count("531") == 6


def test_p_any_set3_uses_k_exponent():
    """Regression for the real bug: forgetting the **k** exponent (§C.10)."""
    preds = ["531", "553", "555", "512"]
    p1 = p_any_set3(preds, 1, "permutation")
    p2 = p_any_set3(preds, 2, "permutation")
    # With more actual sets (higher k) the chance of any hit must strictly rise.
    assert p2 > p1 > 0
    # k=0 (no published sets) must be exactly 0, never a divide/NaN.
    assert p_any_set3(preds, 0, "permutation") == 0.0
