"""§4.4-EXT baseline models (§4.21.6) — walk-forward + no-leakage + honesty tests."""
import os

import pytest

from app.data.excel_loader import load_draws
from app.backtest.ext_baselines import (BASELINES, run_baseline_backtest,
                                        long_frequency, WARMUP)

DATA = os.environ.get("TIANMING_DATA_XLSX", "/data/thai.xlsx")


def test_has_at_least_five_baselines():
    # §4.21.6 requires ≥5 baseline models.
    assert len(BASELINES) >= 5


def test_predictors_are_deterministic():
    if not os.path.exists(DATA):
        pytest.skip("data not mounted")
    draws, _ = load_draws(DATA)
    hist, target = draws[:200], draws[200]
    for _code, _name, fn in BASELINES:
        assert fn(hist, target) == fn(hist, target)


def test_long_frequency_no_leakage():
    # Prediction must depend only on prior draws (changing the future must not change it).
    if not os.path.exists(DATA):
        pytest.skip("data not mounted")
    draws, _ = load_draws(DATA)
    p1 = long_frequency(draws[:150], draws[150])
    p2 = long_frequency(draws[:150], draws[400])  # different target, same history slice
    assert p1 == p2  # history-only, target date irrelevant to a frequency count


def test_baseline_backtest_none_beats_random():
    if not os.path.exists(DATA):
        pytest.skip("data not mounted")
    draws, _ = load_draws(DATA)
    res = run_baseline_backtest(draws, "permutation")
    assert len(res) == len(BASELINES)
    for b in res:
        assert b["bottom2"]["n"] == len(draws) - WARMUP
        # System thesis: no baseline wins against random.
        assert not b["bottom2"]["beats_random"], f'{b["name"]} unexpectedly beat random'
