"""Engine service layer: cached backtest + payload assembly with the V5 gate."""
from __future__ import annotations

import threading
from typing import Dict, List, Optional

from .backtest.walkforward import run_backtest, SchoolBacktest
from .backtest.ext_baselines import run_baseline_backtest
from .backtest.ml_models import run_ml_backtest
from .backtest.hit_summary import run_hit_summary
from .backtest.progressive_analysis import run_per_draw_hits
from .data import store
from .protocol import v5_gate

_lock = threading.Lock()
_cache: Dict[str, List[SchoolBacktest]] = {}
_baseline_cache: Dict[str, list] = {}
_ml_cache: Dict[str, list] = {}
_hit_summary_cache: Dict[str, list] = {}
_per_draw_cache: dict = {}


def clear_caches() -> None:
    """Drop every draw-derived cache.

    Must be called whenever the underlying dataset changes (see
    ``store.reload``); otherwise backtest/hit-summary keep serving results
    computed from the previous version of the workbook.
    """
    with _lock:
        _cache.clear()
        _baseline_cache.clear()
        _ml_cache.clear()
        _hit_summary_cache.clear()
        _per_draw_cache.clear()


def _key(mode: str, start=None, end=None) -> str:
    """Cache key that distinguishes the scoring window (None → full series)."""
    return f"{mode}|{start or ''}|{end or ''}"


def get_backtest(mode: str = "permutation", start=None, end=None) -> List[SchoolBacktest]:
    k = _key(mode, start, end)
    with _lock:
        if k not in _cache:
            draws = store.get_draws()
            _cache[k] = run_backtest(draws, mode, start, end)
        return _cache[k]


def get_baselines(mode: str = "permutation", start=None, end=None) -> list:
    k = _key(mode, start, end)
    with _lock:
        if k not in _baseline_cache:
            _baseline_cache[k] = run_baseline_backtest(store.get_draws(), mode, start, end)
        return _baseline_cache[k]


def get_ml(mode: str = "permutation", start=None, end=None) -> list:
    k = _key(mode, start, end)
    with _lock:
        if k not in _ml_cache:
            _ml_cache[k] = run_ml_backtest(store.get_draws(), mode, start, end)
        return _ml_cache[k]


def get_hit_summary(start=None, end=None) -> list:
    """Per-school ถูกตรง/ถูกสลับ counts over the scoring window (cached per window)."""
    k = _key("hitsummary", start, end)
    with _lock:
        if k not in _hit_summary_cache:
            _hit_summary_cache[k] = run_hit_summary(store.get_draws(), start, end)
        return _hit_summary_cache[k]


def get_per_draw_hits() -> dict:
    """Per-draw hit data for progressive analysis (cached, no parameters)."""
    with _lock:
        if not _per_draw_cache:
            _per_draw_cache.update(run_per_draw_hits(store.get_draws()))
        return _per_draw_cache


def clear_cache():
    with _lock:
        _cache.clear()
        _baseline_cache.clear()
        _ml_cache.clear()
        _hit_summary_cache.clear()
        _per_draw_cache.clear()


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
