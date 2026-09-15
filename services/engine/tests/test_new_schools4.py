"""Golden/determinism tests for the ephemeris additions: §4.17, §4.20.

Golden vectors approved for 2026-08-16 16:00 ICT, computed with the Swiss/Moshier
ephemeris (deterministic). Bangkok observer, Lahiri ayanamsa for Vedic.
"""
import datetime

import pytest

from app.schools import school_western, school_vedic

DT = datetime.datetime(2026, 8, 16, 16, 0)


def test_ephemeris_uses_real_se1_files():
    # Fidelity: the real Swiss Ephemeris files ship in services/engine/ephe.
    from app.schools._swe_helpers import ephemeris_source, _HAS_FILES
    assert _HAS_FILES, "sepl_18.se1/semo_18.se1 missing from services/engine/ephe"
    assert ephemeris_source() == "swiss(se1)"


def test_western_golden():
    r = school_western.generate(DT)
    assert (r.factors["sun_sign"], r.factors["sun_deg"]) == (5, 23)    # Leo 23°
    assert (r.factors["moon_sign"], r.factors["moon_deg"]) == (7, 10)  # Libra 10°
    assert (r.factors["asc_sign"], r.factors["asc_deg"]) == (10, 13)   # Capricorn 13°
    assert (r.top3, r.top2, r.bottom2) == ("057", "23", "10")
    assert r.set3 == ["130", "046", "570", "580"]


def test_vedic_golden():
    r = school_vedic.generate(DT)
    assert (r.factors["nakshatra"], r.factors["pada"], r.factors["tithi"],
            r.factors["yoga"], r.factors["moon_rashi"]) == (13, 2, 4, 22, 6)
    assert (r.top3, r.top2, r.bottom2) == ("132", "04", "22")
    assert r.set3 == ["063", "039", "342", "042"]


@pytest.mark.parametrize("dt", [
    datetime.datetime(1996, 1, 16, 16, 0),
    datetime.datetime(2026, 1, 17, 16, 0),
])
def test_shapes_and_determinism(dt):
    for _ in range(10):
        for r in (school_western.generate(dt), school_vedic.generate(dt)):
            assert len(r.top3) == 3 and len(r.top2) == 2 and len(r.bottom2) == 2
            assert len(r.set3) == 4 and all(len(s) == 3 for s in r.set3)
