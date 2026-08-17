"""§4.4-EXT Category M — ML models: leak-free + honest NOT-AVAILABLE tests.

Uses a small slice to keep the walk-forward training fast in CI.
"""
import os

import pytest

from app.data.excel_loader import load_draws
from app.backtest import ml_models

DATA = os.environ.get("TIANMING_DATA_XLSX", "/data/thai.xlsx")
needs_data = pytest.mark.skipif(not os.path.exists(DATA), reason="data not mounted")


def test_availability_helpers_consistent():
    # §4.21.7: a model is NOT AVAILABLE iff its dependency is absent (never faked).
    unavail = {c for c, _n, _r in ml_models._unavailable_models()}
    assert ("M-XGB" in unavail) == (not ml_models._xgb_available())
    dl = {"M-LSTM", "M-GRU", "M-TF"}
    if ml_models._torch_available():
        assert not (dl & unavail)
    else:
        assert dl <= unavail


def test_features_are_leak_free():
    if not os.path.exists(DATA):
        pytest.skip("data not mounted")
    draws, _ = load_draws(DATA)
    X, y, valid = ml_models._features(draws)
    # A feature row must be reconstructable from strictly-earlier draws only.
    k = valid[50]
    expected = [draws[k].date.weekday(), draws[k].date.day, draws[k].date.month,
                int(draws[k - 1].bottom2[0]), int(draws[k - 1].bottom2[1]),
                int(draws[k - 2].bottom2[0]), int(draws[k - 2].bottom2[1]),
                int(draws[k - 3].bottom2[0]), int(draws[k - 3].bottom2[1])]
    assert X[k] == expected
    assert y[k] == int(draws[k].bottom2)


@needs_data
def test_ml_backtest_runs_and_none_beats_random_small():
    draws, _ = load_draws(DATA)
    res = ml_models.run_ml_backtest(draws[:180], "permutation")
    codes = {m["code"] for m in res}
    assert {"M-LR", "M-RF", "M-KNN", "M-GB", "M-NB"} <= codes  # sklearn always runs
    for m in res:
        if m["status"] == "READY":
            assert not m["bottom2"]["beats_random"], f'{m["name"]} beat random'
            assert "reason" not in m       # ready models carry no excuse
        else:
            assert m["reason"]             # honest reason present
