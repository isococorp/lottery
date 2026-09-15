"""Golden tests — spec §C.9. These MUST pass before merging any formula change.

Each vector fixes the four pillars and the day-power A/B/total for a solar
datetime at 16:00 (Thai lottery draw hour). If any of these fail, do NOT proceed
to later phases — the calendar/power core is wrong.
"""
import pytest

from app.core.pillars import compute_pillars
from app.core.power import compute_power

# (y, m, d, hh, year_gz, month_gz, day_gz, hour_gz, day_master, A, B, power)
# NOTE: the YEAR ganzhi rolls on a FIXED 28 Nov (matches D:\bazi), not 立春. Dates
# from 28 Nov through early Feb (e.g. 2026-01-02/17, 1996-01-16 below) therefore
# carry the *next* year's stem/branch — but the MONTH pillar keeps its conventional
# 立春-based 五虎遁 stem (NOT re-derived from that year): 17 ม.ค. 2569 -> ซิง 0.
GOLDEN = [
    (2026, 8, 16, 16, "丙午", "丙申", "壬戌", "戊申", "น้ำ", -4, +1, -3),
    (2026, 8, 1, 16, "丙午", "乙未", "丁未", "戊申", "ไฟ", +1, -5, -4),
    # 小雪 boundary, reported reference values:
    (2026, 1, 2, 16, "丙午", "戊子", "丙子", "丙申", "ไฟ", 0, -5, -5),   # ไฟเปี้ย -5
    (2026, 1, 17, 16, "丙午", "己丑", "辛卯", "丙申", "ทอง", 0, 0, 0),    # ซิง 0
    (1996, 1, 16, 16, "丙子", "己丑", "壬子", "戊申", "น้ำ", -5, +2, -3),
]


@pytest.mark.parametrize("y,m,d,hh,yg,mg,dg,hg,dm,A,B,power", GOLDEN)
def test_pillars_and_power(y, m, d, hh, yg, mg, dg, hg, dm, A, B, power):
    p = compute_pillars(y, m, d, hh)
    assert p.year_gz == yg, f"year {p.year_gz} != {yg}"
    assert p.month_gz == mg, f"month {p.month_gz} != {mg}"
    assert p.day_gz == dg, f"day {p.day_gz} != {dg}"
    assert p.hour_gz == hg, f"hour {p.hour_gz} != {hg}"

    dp = compute_power(p)
    assert dp.day_master == dm, f"day master {dp.day_master} != {dm}"
    assert dp.A == A, f"A {dp.A} != {A}"
    assert dp.B == B, f"B {dp.B} != {B}"
    assert dp.power == power, f"power {dp.power} != {power}"


def test_power_determinism():
    """Calling repeatedly yields identical results."""
    first = compute_power(compute_pillars(2026, 8, 16, 16))
    for _ in range(100):
        again = compute_power(compute_pillars(2026, 8, 16, 16))
        assert again == first
