"""Engine service layer: cached backtest + payload assembly with the V5 gate."""
from __future__ import annotations

import threading
from typing import Dict, List, Optional

from .backtest.walkforward import run_backtest, SchoolBacktest
from .backtest.ext_baselines import run_baseline_backtest
from .backtest.ml_models import run_ml_backtest
from .data import store
from .protocol import v5_gate

_lock = threading.Lock()
_cache: Dict[str, List[SchoolBacktest]] = {}
_baseline_cache: Dict[str, list] = {}
_ml_cache: Dict[str, list] = {}


def get_backtest(mode: str = "permutation") -> List[SchoolBacktest]:
    with _lock:
        if mode not in _cache:
            draws = store.get_draws()
            _cache[mode] = run_backtest(draws, mode)
        return _cache[mode]


def get_baselines(mode: str = "permutation") -> list:
    with _lock:
        if mode not in _baseline_cache:
            _baseline_cache[mode] = run_baseline_backtest(store.get_draws(), mode)
        return _baseline_cache[mode]


def get_ml(mode: str = "permutation") -> list:
    with _lock:
        if mode not in _ml_cache:
            _ml_cache[mode] = run_ml_backtest(store.get_draws(), mode)
        return _ml_cache[mode]


def clear_cache():
    with _lock:
        _cache.clear()
        _baseline_cache.clear()
        _ml_cache.clear()


def latest_backtest_summary(mode: str = "permutation") -> List[dict]:
    return [
        {"code": sb.code, "name": sb.name,
         "bottom2": sb.bottom2.as_dict(), "set3": sb.set3.as_dict()}
        for sb in get_backtest(mode)
    ]


def _any_beats_random(summ: List[dict]) -> bool:
    return any(s["bottom2"]["beats_random"] or s["set3"]["beats_random"] for s in summ)


def gate_for_predict(schools: List[dict], summary: List[dict]) -> dict:
    report = store.get_report()
    data_ok = report.grade in ("A", "B", "C")
    history_ok = all(s.get("status") != "NOT AVAILABLE" for s in schools)
    text_blobs = [s.get("name", "") for s in schools]
    gate = v5_gate.gate_numeric_payload(
        has_numbers=True,
        backtest_attached=bool(summary),
        beats_random=_any_beats_random(summary),
        p_value=None,
        data_graded_ok=data_ok,
        history_ok=history_ok,
        text_blobs=text_blobs,
    )
    return gate.as_dict()
