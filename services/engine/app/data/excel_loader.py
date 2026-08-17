"""Load & validate historical draws from the source Excel workbook.

The Excel file is an audit source (read-only). This loader is used by the
backtest engine, the stats walk-forward school, and the Phase-1 import script.
It also produces a Data Quality Report with an A–D grade (spec §PHASE-1).
"""
from __future__ import annotations

import datetime
import re
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import openpyxl

from ..models import Draw

HEADER_KEY = "งวดวันที่"
# Column offsets relative to the header row (0-based within the row tuple).
COL_DATE, COL_SIX, COL_T3, COL_T2, COL_B2 = 0, 1, 2, 3, 4
COL_SET = [5, 6, 7, 8]      # 3 ล่าง ชุด 1–4
COL_TIME = 9

_DIGITS = re.compile(r"^\d+$")


@dataclass
class QualityReport:
    total_rows: int = 0
    valid_rows: int = 0
    date_errors: int = 0
    length_errors: int = 0
    duplicate_dates: int = 0
    null_counts: dict = field(default_factory=dict)
    set2_nulls: int = 0
    issues: List[str] = field(default_factory=list)
    date_min: Optional[datetime.date] = None
    date_max: Optional[datetime.date] = None

    @property
    def grade(self) -> str:
        if self.total_rows == 0:
            return "D"
        err = self.date_errors + self.length_errors + self.duplicate_dates
        ratio = err / self.total_rows
        if err == 0:
            return "A"
        if ratio < 0.01:
            return "B"
        if ratio < 0.05:
            return "C"
        return "D"

    def render(self) -> str:
        lines = [
            "=== Data Quality Report ===",
            f"Total rows       : {self.total_rows}",
            f"Valid rows       : {self.valid_rows}",
            f"Date range       : {self.date_min} .. {self.date_max}",
            f"Date errors      : {self.date_errors}",
            f"Length errors    : {self.length_errors}",
            f"Duplicate dates  : {self.duplicate_dates}",
            f"ชุด2 (set2) nulls : {self.set2_nulls}  (expected for pre-2015 draws)",
            f"Null counts      : {self.null_counts}",
            f"GRADE            : {self.grade}",
        ]
        if self.issues:
            lines.append("-- issues (first 20) --")
            lines.extend(self.issues[:20])
        return "\n".join(lines)


def _parse_date(v) -> Optional[datetime.date]:
    if isinstance(v, datetime.datetime):
        return v.date()
    if isinstance(v, datetime.date):
        return v
    if isinstance(v, str):
        s = v.strip()
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d"):
            try:
                return datetime.datetime.strptime(s, fmt).date()
            except ValueError:
                continue
    return None


def _clean_num(v) -> Optional[str]:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        # Should not normally happen (cells are text) but guard leading zeros.
        v = str(int(v))
    s = str(v).strip()
    return s or None


def _find_header(ws) -> int:
    for r in range(1, min(ws.max_row, 20) + 1):
        first = ws.cell(row=r, column=1).value
        if isinstance(first, str) and first.strip() == HEADER_KEY:
            return r
    raise ValueError(f"Header row containing '{HEADER_KEY}' not found")


def load_draws(path: str) -> Tuple[List[Draw], QualityReport]:
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active
    header_row = _find_header(ws)

    report = QualityReport()
    report.null_counts = {"top3": 0, "top2": 0, "bottom2": 0,
                          "set1": 0, "set2": 0, "set3": 0, "set4": 0}
    draws: List[Draw] = []
    seen_dates = set()
    expected_len = {COL_T3: 3, COL_T2: 2, COL_B2: 2}

    for r in range(header_row + 1, ws.max_row + 1):
        row = [ws.cell(row=r, column=c).value for c in range(1, COL_TIME + 2)]
        if all(v is None for v in row):
            continue
        report.total_rows += 1

        d = _parse_date(row[COL_DATE])
        if d is None:
            report.date_errors += 1
            report.issues.append(f"row {r}: bad date {row[COL_DATE]!r}")
            continue
        if d in seen_dates:
            report.duplicate_dates += 1
            report.issues.append(f"row {r}: duplicate date {d}")
        seen_dates.add(d)

        six = _clean_num(row[COL_SIX])
        t3 = _clean_num(row[COL_T3])
        t2 = _clean_num(row[COL_T2])
        b2 = _clean_num(row[COL_B2])
        sets = [_clean_num(row[c]) for c in COL_SET]

        row_ok = True
        for col, val, key in ((COL_T3, t3, "top3"), (COL_T2, t2, "top2"), (COL_B2, b2, "bottom2")):
            if val is None:
                report.null_counts[key] += 1
            elif not _DIGITS.match(val) or len(val) != expected_len[col]:
                report.length_errors += 1
                report.issues.append(f"row {r}: {key}={val!r} invalid")
                row_ok = False
        for i, s in enumerate(sets):
            key = f"set{i+1}"
            if s is None:
                report.null_counts[key] += 1
                if i == 1:
                    report.set2_nulls += 1
            elif not _DIGITS.match(s) or len(s) != 3:
                report.length_errors += 1
                report.issues.append(f"row {r}: {key}={s!r} invalid")
                row_ok = False

        t = row[COL_TIME] if isinstance(row[COL_TIME], datetime.time) else None
        draws.append(Draw(date=d, six=six, top3=t3, top2=t2, bottom2=b2, set3=sets, time=t))
        if row_ok:
            report.valid_rows += 1

    draws.sort(key=lambda x: x.date)
    if draws:
        report.date_min = draws[0].date
        report.date_max = draws[-1].date
    return draws, report
