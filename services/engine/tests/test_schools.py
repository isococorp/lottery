"""Determinism + leading-zero + shape tests for the deterministic schools (§C.9)."""
import datetime

from app.core.pillars import compute_pillars
from app.core.power import compute_power
from app.schools import school_bazi, school_thai, school_numerology, school_other


def _all_deterministic(dt):
    p = compute_pillars(dt.year, dt.month, dt.day, dt.hour, dt.minute)
    dp = compute_power(p)
    return [
        school_bazi.generate(p, dp),
        school_thai.generate(dt.date(), p),
        school_numerology.generate(dt),
        school_other.generate(dt),
    ]


def test_determinism_100x():
    dt = datetime.datetime(2026, 8, 16, 16, 0)
    ref = [r.as_dict() for r in _all_deterministic(dt)]
    for _ in range(100):
        again = [r.as_dict() for r in _all_deterministic(dt)]
        assert again == ref


def test_leading_zero_shapes():
    # A date whose formulas produce leading zeros must keep them as strings.
    for dt in [datetime.datetime(1996, 1, 16, 16, 0),
               datetime.datetime(2026, 1, 17, 16, 0),
               datetime.datetime(2026, 8, 1, 16, 0)]:
        for r in _all_deterministic(dt):
            assert isinstance(r.top3, str) and len(r.top3) == 3
            assert isinstance(r.top2, str) and len(r.top2) == 2
            assert isinstance(r.bottom2, str) and len(r.bottom2) == 2
            assert len(r.set3) == 4 and all(len(s) == 3 for s in r.set3)


def test_known_thai_school_values():
    # 2026-08-16 is a Sunday (อาทิตย์): dao=1, kamlang=6, hour_branch=8 -> yam=9
    dt = datetime.datetime(2026, 8, 16, 16, 0)
    p = compute_pillars(dt.year, dt.month, dt.day, dt.hour)
    r = school_thai.generate(dt.date(), p)
    assert r.top3 == "106"      # dao=1, kl=06
    assert r.bottom2 == "16"    # dao=1, kl%10=6
    assert r.top2 == "19"       # dao=1, yam=9
