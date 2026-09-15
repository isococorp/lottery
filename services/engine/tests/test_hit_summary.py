"""Per-school ถูกตรง/ถูกสลับ summary (หน้าคำนวน §8).

The summary must be consistent with the established permutation backtest: for any
position, (exact + swapped) equals the permutation hit count, and exact alone
equals the exact-mode hit count. This ties the new counts to the §C.11 reference.
"""
import datetime
import os

import pytest

from app.data.excel_loader import load_draws
from app.backtest.walkforward import run_backtest
from app.backtest.hit_summary import run_hit_summary

DATA = os.environ.get("TIANMING_DATA_XLSX", "/data/thai.xlsx")


@pytest.fixture(scope="module")
def draws():
    if not os.path.exists(DATA):
        pytest.skip(f"data file not mounted at {DATA}")
    d, _ = load_draws(DATA)
    return d


@pytest.fixture(scope="module")
def summary(draws):
    return {s["code"]: s for s in run_hit_summary(draws)}


def test_all_production_schools_present(summary):
    from app import schools as sch
    assert set(summary) == set(sch.PRODUCTION_CODES)


def test_counts_non_negative_and_bounded(summary):
    for s in summary.values():
        for pos in ("top3", "top2", "bottom2", "set3"):
            p = s[pos]
            assert 0 <= p["exact"] <= p["n"]
            assert 0 <= p["swapped"] <= p["n"]
            # A draw can be exact OR swapped, never both.
            assert p["exact"] + p["swapped"] <= p["n"]


def test_window_restricts_scoring(draws):
    """A date window (§10) scores only draws inside it; counts never exceed full."""
    full = {s["code"]: s for s in run_hit_summary(draws)}
    start, end = datetime.date(2020, 1, 1), datetime.date(2023, 12, 31)
    win = {s["code"]: s for s in run_hit_summary(draws, start, end)}
    ndraws = sum(1 for d in draws if start <= d.date <= end)
    # A deterministic school scores every windowed draw for bottom2 (always present).
    assert win["4.1"]["bottom2"]["n"] == ndraws
    assert 0 < ndraws < len(draws)
    # Windowed counts are a subset of the full-range counts.
    for code in full:
        for pos in ("top3", "top2", "bottom2", "set3"):
            assert win[code][pos]["exact"] <= full[code][pos]["exact"]
            assert win[code][pos]["swapped"] <= full[code][pos]["swapped"]


def test_bottom2_and_set3_match_permutation_backtest(draws, summary):
    """exact + swapped == permutation hits; exact == exact-mode hits (§C.11 tie-in)."""
    perm = {sb.code: sb for sb in run_backtest(draws, "permutation")}
    exact = {sb.code: sb for sb in run_backtest(draws, "exact")}
    for code, s in summary.items():
        for pos in ("bottom2", "set3"):
            hs = s[pos]
            assert hs["exact"] + hs["swapped"] == getattr(perm[code], pos).hits, \
                f"{code} {pos}: perm mismatch"
            assert hs["exact"] == getattr(exact[code], pos).hits, \
                f"{code} {pos}: exact mismatch"
            assert hs["n"] == getattr(perm[code], pos).n, f"{code} {pos}: n mismatch"
