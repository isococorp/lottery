"""Excel export of backtest results — 3 sheets, Navy/Gold/Tahoma theme (§PHASE-4).

Filename is ASCII-only (Thai filenames broke downloads historically, guardrail #7);
Thai text lives inside sheet headers instead.
"""
from __future__ import annotations

import datetime
import io
from typing import List

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from .walkforward import SchoolBacktest
from ..protocol.v5_gate import MANDATORY_WARNING

NAVY = "FF0A1F44"
GOLD = "FFC9A24B"
WHITE = "FFFFFFFF"
GREEN = "FFB7E1A1"
FONT = "Tahoma"

_thin = Side(style="thin", color="FFB0B0B0")
BORDER = Border(left=_thin, right=_thin, top=_thin, bottom=_thin)


def _title(ws, text, span):
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=span)
    c = ws.cell(row=1, column=1, value=text)
    c.font = Font(name=FONT, size=14, bold=True, color=GOLD)
    c.fill = PatternFill("solid", fgColor=NAVY)
    c.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 28


def _header(ws, row, headers):
    for j, h in enumerate(headers, start=1):
        c = ws.cell(row=row, column=j, value=h)
        c.font = Font(name=FONT, size=10, bold=True, color=WHITE)
        c.fill = PatternFill("solid", fgColor=NAVY)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = BORDER


def _cell(ws, row, col, val, fill=None, bold=False, align="center"):
    c = ws.cell(row=row, column=col, value=val)
    c.font = Font(name=FONT, size=10, bold=bold,
                  color=NAVY if fill != NAVY else WHITE)
    if fill:
        c.fill = PatternFill("solid", fgColor=fill)
    c.alignment = Alignment(horizontal=align, vertical="center")
    c.border = BORDER
    return c


def build_workbook(results: List[SchoolBacktest], mode: str,
                   date_min, date_max, generated_at: str) -> Workbook:
    wb = Workbook()

    # --- Sheet 1: summary ---------------------------------------------------
    ws = wb.active
    ws.title = "Summary"
    _title(ws, "สรุปผลการทดสอบย้อนหลัง (Backtest Summary)", 9)
    ws.cell(row=2, column=1, value=f"โหมด: {mode}  |  ช่วง: {date_min} .. {date_max}"
                                   f"  |  สร้างเมื่อ: {generated_at}").font = Font(name=FONT, size=9, italic=True)
    headers = ["ศาสตร์", "เมตริก", "ถูก", "จำนวนงวด", "อัตรา %",
               "baseline %", "p-value", "95% CI %", "ชนะสุ่ม?"]
    _header(ws, 3, headers)
    r = 4
    for sb in results:
        for m, mlabel in ((sb.bottom2, "2 ล่าง"), (sb.set3, "3 ล่าง (4 ชุด)")):
            win = "ใช่" if m.beats_random else "ไม่"
            fill = GREEN if m.beats_random else None
            _cell(ws, r, 1, sb.name, bold=True)
            _cell(ws, r, 2, mlabel)
            _cell(ws, r, 3, m.hits)
            _cell(ws, r, 4, m.n)
            _cell(ws, r, 5, round(m.rate * 100, 2))
            _cell(ws, r, 6, round(m.baseline_p * 100, 3))
            _cell(ws, r, 7, round(m.p_value, 3))
            _cell(ws, r, 8, f"[{m.ci_low*100:.2f}, {m.ci_high*100:.2f}]")
            _cell(ws, r, 9, win, fill=fill, bold=True)
            r += 1
    widths = [14, 16, 8, 10, 9, 11, 9, 16, 10]
    for j, w in enumerate(widths, start=1):
        ws.column_dimensions[chr(64 + j)].width = w

    # --- Sheet 2: per-draw detail ------------------------------------------
    ws2 = wb.create_sheet("Detail")
    _title(ws2, "รายละเอียดรายงวด (ไฮไลต์เขียว = ทายถูก)", 6)
    _header(ws2, 2, ["ศาสตร์", "วันที่", "ทาย 2 ล่าง", "ผลจริง 2 ล่าง", "ถูก?", "ทาย 3 ล่าง (4 ชุด)"])
    r = 3
    for sb in results:
        for p in sb.predictions:
            hit = p.get("hit_b2")
            fill = GREEN if hit else None
            _cell(ws2, r, 1, sb.name)
            _cell(ws2, r, 2, p["date"])
            _cell(ws2, r, 3, p["bottom2"])
            _cell(ws2, r, 4, p.get("actual_b2"))
            _cell(ws2, r, 5, "✓" if hit else "", fill=fill, bold=True)
            _cell(ws2, r, 6, " ".join(p["set3"]))
            r += 1
    for j, w in enumerate([14, 12, 12, 14, 8, 22], start=1):
        ws2.column_dimensions[chr(64 + j)].width = w
    ws2.freeze_panes = "A3"

    # --- Sheet 3: methodology + conclusion ---------------------------------
    ws3 = wb.create_sheet("Method")
    _title(ws3, "วิธีการและข้อสรุป (Methodology & Conclusion)", 2)
    lines = [
        ("คำเตือนบังคับ", MANDATORY_WARNING),
        ("วิธีทดสอบ", "Walk-forward: ทายแต่ละงวดด้วยข้อมูลก่อนหน้าเท่านั้น "
                      "(สถิติเริ่มหลัง warm-up 100 งวด)"),
        ("โหมด", f"{mode} — exact = ตรงตำแหน่ง, permutation = สลับตำแหน่ง (digit multiset)"),
        ("เส้นฐานสุ่ม", "2 ล่าง: perm_count(pred)/100 ; 3 ล่าง 4 ชุด: 1-Π(1-p)^k (ยกกำลัง k)"),
        ("สถิติ", "Binomial two-sided p-value + Bootstrap 95% CI (resample 2,000 รอบ)"),
        ("เกณฑ์ชนะสุ่ม", "CI-low > baseline"),
        ("ข้อสรุป", "จากข้อมูลจริง 708 งวด ไม่มีศาสตร์ใดให้ผลแตกต่างจากการสุ่มอย่างมีนัยสำคัญ "
                    "ทุกค่า 'ชนะสุ่ม' = ไม่"),
    ]
    r = 2
    for k, v in lines:
        _cell(ws3, r, 1, k, fill=GOLD, bold=True, align="left")
        c = _cell(ws3, r, 2, v, align="left")
        c.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
        ws3.row_dimensions[r].height = 60
        r += 1
    ws3.column_dimensions["A"].width = 18
    ws3.column_dimensions["B"].width = 90

    # Watermark on every sheet footer (anti-copy §7.4).
    watermark = ("Tianming Lottery Analyzer  -  experimental/educational  -  "
                 f"generated {generated_at}  -  (c) Tianming Ge")
    for sheet in wb.worksheets:
        sheet.oddFooter.center.text = watermark
        sheet.oddFooter.center.size = 8

    return wb


def export_bytes(results: List[SchoolBacktest], mode: str, date_min, date_max) -> bytes:
    generated_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    wb = build_workbook(results, mode, date_min, date_max, generated_at)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def ascii_filename(mode: str) -> str:
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M")
    return f"tianming_backtest_{mode}_{ts}.xlsx"
