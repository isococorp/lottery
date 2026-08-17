"""Golden/determinism tests for the approved additions: §4.10, §4.16, §4.18.

Golden vectors are the worked examples approved for 2026-08-16 16:00.
"""
import datetime

import pytest

from app.core.pillars import compute_pillars
from app.schools import school_chaldean, school_biorhythm, school_iching

DT = datetime.datetime(2026, 8, 16, 16, 0)


def test_chaldean_golden():
    r = school_chaldean.generate(DT)
    assert (r.top3, r.top2, r.bottom2) == ("220", "77", "20")
    assert r.set3 == ["202", "772", "720", "036"]
    assert r.factors["name_compound"] == 20  # SUNDAY


def test_biorhythm_golden():
    r = school_biorhythm.generate(DT)
    assert (r.factors["physical"], r.factors["emotional"], r.factors["intellectual"]) == (3, 61, 23)
    assert (r.top3, r.top2, r.bottom2) == ("087", "03", "61")
    assert r.set3 == ["234", "062", "313", "206"]


def test_iching_golden():
    p = compute_pillars(DT.year, DT.month, DT.day, DT.hour)
    r = school_iching.generate(DT, p)
    assert (r.factors["upper"], r.factors["lower"], r.factors["moving_line"], r.factors["hexagram"]) == (2, 3, 3, 11)
    assert (r.top3, r.top2, r.bottom2) == ("113", "23", "11")
    assert r.set3 == ["233", "113", "112", "019"]


@pytest.mark.parametrize("dt", [
    datetime.datetime(1996, 1, 16, 16, 0),
    datetime.datetime(2026, 1, 17, 16, 0),
])
def test_new_schools_determinism_and_shape(dt):
    p = compute_pillars(dt.year, dt.month, dt.day, dt.hour)
    for _ in range(20):
        for r in (school_chaldean.generate(dt), school_biorhythm.generate(dt),
                  school_iching.generate(dt, p)):
            assert len(r.top3) == 3 and len(r.top2) == 2 and len(r.bottom2) == 2
            assert len(r.set3) == 4 and all(len(s) == 3 for s in r.set3)
