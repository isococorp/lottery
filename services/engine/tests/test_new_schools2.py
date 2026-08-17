"""Golden/determinism tests for approved additions: §4.15, §4.9, §4.19.

Golden vectors are the worked examples approved for 2026-08-16 16:00.
"""
import datetime

import pytest

from app.schools import school_pythagorean, school_meihua, school_tarot

DT = datetime.datetime(2026, 8, 16, 16, 0)


def test_pythagorean_golden():
    r = school_pythagorean.generate(DT)
    assert (r.factors["life_path"], r.factors["birthday"], r.factors["attitude"]) == (7, 7, 6)
    assert (r.top3, r.top2, r.bottom2) == ("078", "06", "07")
    assert r.set3 == ["871", "077", "706", "036"]


def test_pythagorean_preserves_master_numbers():
    # 1998-11-04: m_r=11 (master, not reduced to 2)
    r = school_pythagorean.generate(datetime.datetime(1998, 11, 4, 16, 0))
    assert r.factors["month_r"] == 11


def test_meihua_golden():
    r = school_meihua.generate(DT)
    assert (r.factors["ben_gua"], r.factors["bian_gua"], r.factors["moving_line"]) == (10, 42, 6)
    assert (r.top3, r.top2, r.bottom2) == ("102", "42", "10")
    assert r.set3 == ["226", "106", "426", "062"]


def test_tarot_golden():
    r = school_tarot.generate(DT)
    assert (r.factors["birth_card"], r.factors["day_card"], r.factors["hour_card"]) == (7, 16, 6)
    assert (r.top3, r.top2, r.bottom2) == ("076", "07", "16")
    assert r.set3 == ["067", "029", "766", "076"]


@pytest.mark.parametrize("dt", [
    datetime.datetime(1996, 1, 16, 16, 0),
    datetime.datetime(2026, 1, 17, 16, 0),
])
def test_shapes_and_determinism(dt):
    for _ in range(20):
        for r in (school_pythagorean.generate(dt), school_meihua.generate(dt),
                  school_tarot.generate(dt)):
            assert len(r.top3) == 3 and len(r.top2) == 2 and len(r.bottom2) == 2
            assert len(r.set3) == 4 and all(len(s) == 3 for s in r.set3)
