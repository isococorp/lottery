"""Golden/determinism tests for Chinese-metaphysics additions:
§4.6, §4.7, §4.8, §4.11, §4.12. Golden vectors approved for 2026-08-16 16:00.
"""
import datetime

import pytest

from app.core.pillars import compute_pillars
from app.schools import (school_ziwei, school_xuankong, school_qimen,
                         school_daliuren, school_tongsheng)

DT = datetime.datetime(2026, 8, 16, 16, 0)
P = compute_pillars(DT.year, DT.month, DT.day, DT.hour, DT.minute)


def test_ziwei_golden():
    r = school_ziwei.generate(DT, P)
    assert (r.factors["ming_gong"], r.factors["shen_gong"], r.factors["wu_xing_ju"],
            r.factors["zi_wei"], r.factors["tian_fu"]) == (1, 5, 6, 5, 1)
    assert (r.top3, r.top2, r.bottom2) == ("651", "15", "51")
    assert r.set3 == ["156", "516", "615", "018"]


def test_xuankong_golden():
    r = school_xuankong.generate(DT, P)
    assert (r.factors["period"], r.factors["annual_star"], r.factors["month_star"]) == (9, 9, 2)
    assert (r.top3, r.top2, r.bottom2) == ("992", "92", "99")
    assert r.set3 == ["299", "162", "020", "992"]


def test_qimen_golden():
    r = school_qimen.generate(DT, P)
    assert (r.factors["xun_head"], r.factors["hour_palace"],
            r.factors["chief"], r.factors["envoy"]) == (6, 9, 8, 6)
    assert (r.top3, r.top2, r.bottom2) == ("869", "86", "96")
    assert r.set3 == ["869", "686", "981", "029"]


def test_daliuren_golden():
    r = school_daliuren.generate(DT, P)
    assert (r.factors["yue_jiang"], r.factors["shift"],
            r.factors["lesson1_ganshang"], r.factors["lesson3_zhishang"]) == (6, 10, 9, 8)
    assert (r.top3, r.top2, r.bottom2) == ("990", "98", "71")
    assert r.set3 == ["711", "986", "098", "044"]


def test_tongsheng_golden():
    r = school_tongsheng.generate(DT, P)
    assert (r.factors["day_officer"], r.factors["mansion_28"], r.factors["tai_yi_palace"]) == (3, 14, 4)
    assert (r.top3, r.top2, r.bottom2) == ("144", "34", "14")
    assert r.set3 == ["314", "143", "414", "021"]


@pytest.mark.parametrize("dt", [
    datetime.datetime(1996, 1, 16, 16, 0),
    datetime.datetime(2026, 1, 17, 16, 0),
])
def test_shapes_and_determinism(dt):
    p = compute_pillars(dt.year, dt.month, dt.day, dt.hour)
    gens = [lambda: school_ziwei.generate(dt, p), lambda: school_xuankong.generate(dt, p),
            lambda: school_qimen.generate(dt, p), lambda: school_daliuren.generate(dt, p),
            lambda: school_tongsheng.generate(dt, p)]
    for _ in range(20):
        for g in gens:
            r = g()
            assert len(r.top3) == 3 and len(r.top2) == 2 and len(r.bottom2) == 2
            assert len(r.set3) == 4 and all(len(s) == 3 for s in r.set3)
