"""In-memory cache of historical draws loaded from the Excel audit source.

Path is configured via TIANMING_DATA_XLSX (defaults to the mounted data dir).
"""
from __future__ import annotations

import os
import threading
from typing import List, Optional

from ..models import Draw
from .excel_loader import load_draws, QualityReport

DEFAULT_PATH = os.environ.get("TIANMING_DATA_XLSX", "/data/thai.xlsx")

_lock = threading.Lock()
_draws: Optional[List[Draw]] = None
_report: Optional[QualityReport] = None


def _ensure_loaded(path: Optional[str] = None):
    global _draws, _report
    with _lock:
        if _draws is None or path is not None:
            p = path or DEFAULT_PATH
            _draws, _report = load_draws(p)


def get_draws(path: Optional[str] = None) -> List[Draw]:
    _ensure_loaded(path)
    return _draws  # type: ignore


def get_report(path: Optional[str] = None) -> QualityReport:
    _ensure_loaded(path)
    return _report  # type: ignore


def history_before(date, weekday: Optional[str] = None) -> List[Draw]:
    """Draws strictly before `date`, optionally filtered to one weekday."""
    draws = get_draws()
    out = [d for d in draws if d.date < date]
    if weekday is not None:
        out = [d for d in out if d.weekday == weekday]
    return out
