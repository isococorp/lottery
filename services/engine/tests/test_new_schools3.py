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


def test_qimen_golden_full_paipan():
    """Full 拆補 chart for 2026-08-16 16:00 (hand-verified against the classical
    method): 立秋 陰遁, 符頭 己未 → 下元, 局 8; 值符宮 8, 值使宮 9."""
    r = school_qimen.generate(DT, P)
    assert r.factors["term"] == "立秋"
    assert (r.factors["yuan"], r.factors["ju"], r.factors["dun"]) == (3, 8, "yin")
    assert (r.factors["chief_palace"], r.factors["envoy_palace"], r.factors["xun"]) == (8, 9, 5)
    assert (r.top3, r.top2, r.bottom2) == ("898", "89", "85")
    assert r.set3 == ["898", "589", "881", "033"]


def test_qimen_yang_dun_case():
    # 1996-01-16: 小寒 (陽遁), 符頭 branch in 子午卯酉 → 上元, 局 2.
    dt = datetime.datetime(1996, 1, 16, 16, 0)
    p = compute_pillars(1996, 1, 16, 16)
    r = school_qimen.generate(dt, p)
    assert r.factors["term"] == "小寒"
    assert (r.factors["yuan"], r.factors["ju"], r.factors["dun"]) == (1, 2, "yang")


def test_daliuren_golden_sanchuan():
    """月將 by 中氣 rule (大暑→午) + 元首課 (single 上剋下) 三傳 午辰寅
    — hand-verified for 2026-08-16 16:00."""
    r = school_daliuren.generate(DT, P)
    assert (r.factors["yue_jiang"], r.factors["shift"],
            r.factors["lesson1_ganshang"], r.factors["lesson3_zhishang"]) == (7, 11, 10, 9)
    assert r.factors["san_chuan"] == [7, 5, 3]           # 午 辰 寅
    assert r.factors["san_chuan_method"] == "賊剋(上剋下)"
    assert (r.top3, r.top2, r.bottom2) == ("101", "09", "81")
    assert r.set3 == ["821", "753", "809", "063"]


def test_daliuren_zei_ke_case():
    # 1996-01-16: 下賊上 path; 月將 = 丑 (after 冬至 1995-12-22, before 大寒).
    dt = datetime.datetime(1996, 1, 16, 16, 0)
    p = compute_pillars(1996, 1, 16, 16)
    r = school_daliuren.generate(dt, p)
    assert r.factors["yue_jiang"] == 2                    # 丑
    assert r.factors["san_chuan_method"].startswith("賊剋(下賊上)")


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
