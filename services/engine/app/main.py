"""FastAPI application for the Tianming Lottery Analyzer engine.

All formulas live here (anti-copy §7.4). The Next.js BFF calls these endpoints;
no formula ever runs in the frontend. Every numeric response carries the V5 gate
(warning + confidence + backtest evidence).
"""
from __future__ import annotations

import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import predict as predict_mod
from . import service
from .data import store
from .data import excel_writer
from .backtest import export as export_mod
from .protocol import v5_gate
from .schools import catalog as catalog_mod

app = FastAPI(title="Tianming Lottery Analyzer — Engine", version="1.0.0")


class PredictRequest(BaseModel):
    date: str = Field(..., examples=["2026-08-16"])
    time: str = Field("16:00", examples=["16:00"])


class DrawUpsert(BaseModel):
    """One draw row destined for the Excel audit source. All numbers are strings."""
    date: str = Field(..., examples=["2026-09-01"])
    six: Optional[str] = None
    top3: Optional[str] = None
    top2: Optional[str] = None
    bottom2: Optional[str] = None
    set1: Optional[str] = None
    set2: Optional[str] = None
    set3: Optional[str] = None
    set4: Optional[str] = None
    drawTime: Optional[str] = Field("16:00", examples=["16:00"])


class BacktestRequest(BaseModel):
    mode: str = Field("permutation", pattern="^(permutation|exact)$")
    # Optional scoring window (งวดเริ่มต้น/สิ้นสุด). None → full series.
    # Only the evaluation set is restricted; walk-forward history stays full.
    start: Optional[str] = Field(None, examples=["2010-01-01"])
    end: Optional[str] = Field(None, examples=["2026-08-16"])


def _parse_opt_date(value: Optional[str], field: str) -> Optional[datetime.date]:
    if value is None or value == "":
        return None
    try:
        return datetime.date.fromisoformat(value)
    except ValueError:
        raise HTTPException(422, f"bad {field} {value!r} (expected YYYY-MM-DD)")


def _resolve_window(req: "BacktestRequest"):
    """Parse + validate the optional [start, end] scoring window.

    Returns (start, end, scored_draw_count). Raises 422 on bad input or start>end.
    """
    start = _parse_opt_date(req.start, "start")
    end = _parse_opt_date(req.end, "end")
    if start is not None and end is not None and start > end:
        raise HTTPException(422, f"start {start} is after end {end}")
    dates = [d.date for d in store.get_draws()]
    n = sum(1 for d in dates
            if (start is None or d >= start) and (end is None or d <= end))
    return start, end, n


def _parse_dt(date: str, time: str) -> datetime.datetime:
    try:
        d = datetime.date.fromisoformat(date)
    except ValueError:
        raise HTTPException(422, f"bad date {date!r} (expected YYYY-MM-DD)")
    try:
        hh, mm = (int(x) for x in time.split(":")[:2])
    except Exception:
        raise HTTPException(422, f"bad time {time!r} (expected HH:MM)")
    return datetime.datetime(d.year, d.month, d.day, hh, mm)


@app.get("/health")
def health():
    return {"status": "ok", "service": "engine"}


@app.get("/schools")
def schools_catalog():
    """Full 21-วิชา catalog (§4.1–4.21): production + belief backlog + V5 discipline."""
    return catalog_mod.full_catalog()


@app.get("/dates")
def available_dates():
    """All draw dates present in the dataset (ascending), for the date picker."""
    try:
        draws = store.get_draws()
    except Exception as e:
        raise HTTPException(503, f"data unavailable: {e}")
    return {"dates": [d.date.isoformat() for d in draws]}


@app.get("/hit-summary")
def hit_summary(start: Optional[str] = Query(None), end: Optional[str] = Query(None)):
    """Per-school ถูกตรง/ถูกสลับ counts over the scoring window (หน้าคำนวน สรุป).

    For every วิชา, how many งวด each position (3 บน / 2 บน / 2 ล่าง / 3 ล่าง ชุด 1–4)
    was hit exactly vs. as a digit-permutation (swapped). `start`/`end` (YYYY-MM-DD,
    optional) restrict the scored window; the full DB range is used when omitted.
    """
    s = _parse_opt_date(start, "start")
    e = _parse_opt_date(end, "end")
    if s is not None and e is not None and s > e:
        raise HTTPException(422, f"start {s} is after end {e}")
    try:
        rows = service.get_hit_summary(s, e)
        report = store.get_report()
    except Exception as ex:
        raise HTTPException(503, f"data unavailable: {ex}")
    dates = [d.date for d in store.get_draws()]
    n = sum(1 for d in dates if (s is None or d >= s) and (e is None or d <= e))
    return {
        "n_draws": n,
        "date_range": [str(report.date_min), str(report.date_max)],
        "window": [str(s or report.date_min), str(e or report.date_max)],
        "schools": rows,
        "note": ("สรุปตามช่วงที่เลือก · ต = ถูกตรง (ไม่สลับ) · ส = ถูกสลับตำแหน่ง · "
                 "4.4 สถิติ walk-forward นับหลัง warm-up (no look-ahead)"),
    }


@app.get("/school-analysis")
def school_analysis():
    """Per-draw hit data for progressive window analysis (วิเคราะห์วิชา)."""
    try:
        return service.get_per_draw_hits()
    except Exception as ex:
        raise HTTPException(503, f"data unavailable: {ex}")


@app.get("/data/quality")
def data_quality():
    try:
        report = store.get_report()
    except Exception as e:  # data file missing / unreadable
        raise HTTPException(503, f"data unavailable: {e}")
    return {
        "grade": report.grade,
        "total_rows": report.total_rows,
        "valid_rows": report.valid_rows,
        "date_range": [str(report.date_min), str(report.date_max)],
        "set2_nulls": report.set2_nulls,
        "null_counts": report.null_counts,
        "errors": {"date": report.date_errors, "length": report.length_errors,
                   "duplicate": report.duplicate_dates},
        "issues": report.issues[:20],
        "report_text": report.render(),
    }


@app.post("/data/reload")
def data_reload():
    """Re-read the Excel audit source and drop every draw-derived cache.

    Called by the web BFF after an admin appends a new draw, so live
    predictions and walk-forward stats pick it up without a process restart.
    """
    try:
        report = store.reload()
    except Exception as e:
        raise HTTPException(503, f"data unavailable: {e}")
    service.clear_caches()
    return {
        "reloaded": True,
        "grade": report.grade,
        "total_rows": report.total_rows,
        "date_range": [str(report.date_min), str(report.date_max)],
    }


@app.post("/data/draw")
def data_upsert_draw(req: DrawUpsert):
    """Insert/update one draw in the Excel audit source, then reload the cache.

    The workbook is backed up before every write and saved via a temp-file
    replace, so a failure can never leave a truncated audit source.
    """
    try:
        result = excel_writer.upsert_draw(store.DEFAULT_PATH, req.model_dump())
    except excel_writer.DrawWriteError as e:
        raise HTTPException(422, str(e))
    except FileNotFoundError as e:
        raise HTTPException(503, f"data unavailable: {e}")
    except PermissionError as e:
        raise HTTPException(500, f"เขียนไฟล์ไม่ได้ (mount อาจเป็น read-only): {e}")

    report = store.reload()
    service.clear_caches()
    return {
        **result,
        "grade": report.grade,
        "total_rows": report.total_rows,
        "date_range": [str(report.date_min), str(report.date_max)],
    }


@app.post("/predict")
def predict(req: PredictRequest):
    dt = _parse_dt(req.date, req.time)
    result = predict_mod.predict(dt, use_history=True)
    summary = service.latest_backtest_summary("permutation")
    gate = service.gate_for_predict(result["schools"], summary)
    return {
        **result,
        "layer": {"level": 2, "label": "ชั้น 2 — ตัวเลขเชิงทดลอง (ไม่ใช่คำพยากรณ์)"},
        "backtest_summary": summary,
        "catalog": catalog_mod.full_catalog(),
        "v5": gate,
    }


@app.post("/backtest")
def backtest(req: BacktestRequest):
    start, end, n_scored = _resolve_window(req)
    try:
        results = service.get_backtest(req.mode, start, end)
        report = store.get_report()
    except Exception as e:
        raise HTTPException(503, f"data unavailable: {e}")
    gate = v5_gate.gate_numeric_payload(
        has_numbers=True, backtest_attached=True,
        beats_random=any(sb.bottom2.beats_random or sb.set3.beats_random for sb in results),
        data_graded_ok=report.grade in ("A", "B", "C"),
    ).as_dict()
    baselines = service.get_baselines(req.mode, start, end)  # §4.21.6 / §4.21.10
    return {
        "mode": req.mode,
        "date_range": [str(report.date_min), str(report.date_max)],
        "window": [str(start or report.date_min), str(end or report.date_max)],
        "n_draws": n_scored,
        "schools": [sb.as_dict() for sb in results],
        "baselines": baselines,
        "baseline_note": ("§4.21.6 Baseline Models (walk-forward, ชั้น 2). "
                          "ไม่มี baseline ใดชนะการสุ่ม — Advanced Ensemble ไม่ให้ค่าเพิ่ม"),
        "layer": {"level": 3, "label": "ชั้น 3 — หลักฐานสถิติ (walk-forward)"},
        "v5": gate,
    }


@app.post("/ml")
def ml_backtest(req: BacktestRequest):
    """§4.4-EXT Category M — ML models (walk-forward). Separate endpoint: heavy;
    trains real models per §4.21.7 and reports NOT AVAILABLE for absent deps."""
    start, end, n_scored = _resolve_window(req)
    try:
        models = service.get_ml(req.mode, start, end)
        report = store.get_report()
    except Exception as e:
        raise HTTPException(503, f"data unavailable: {e}")
    ready = [m for m in models if m.get("status") == "READY"]
    gate = v5_gate.gate_numeric_payload(
        has_numbers=True, backtest_attached=True,
        beats_random=any(m["bottom2"]["beats_random"] for m in ready),
        data_graded_ok=report.grade in ("A", "B", "C"),
    ).as_dict()
    return {
        "mode": req.mode,
        "window": [str(start or report.date_min), str(end or report.date_max)],
        "n_draws": n_scored,
        "models": models,
        "note": ("§4.4-EXT หมวด M (walk-forward, ชั้น 2, no leakage). "
                 "โมเดลที่ dependency ไม่พร้อม = NOT AVAILABLE ตามจริง (§4.21.7). "
                 "ไม่มีโมเดลใดชนะการสุ่ม"),
        "v5": gate,
    }


@app.get("/backtest/export")
def backtest_export(mode: str = Query("permutation", pattern="^(permutation|exact)$")):
    try:
        results = service.get_backtest(mode)
        report = store.get_report()
    except Exception as e:
        raise HTTPException(503, f"data unavailable: {e}")
    data = export_mod.export_bytes(results, mode, report.date_min, report.date_max)
    fname = export_mod.ascii_filename(mode)  # ASCII only (guardrail #7)
    return StreamingResponse(
        iter([data]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@app.get("/audit")
def audit():
    """System self-check / audit (§4.21.18)."""
    try:
        report = store.get_report()
        data_ok = report.grade in ("A", "B", "C")
    except Exception:
        report = None
        data_ok = False
    gate = v5_gate.gate_numeric_payload(
        has_numbers=True, backtest_attached=True, data_graded_ok=data_ok,
    )
    return {
        "self_check_items": v5_gate.SELF_CHECK_ITEMS,
        "gate": gate.as_dict(),
        "data_grade": report.grade if report else "D",
        "golden_tests": "see services/engine/tests (run: make test)",
        "stance": "ระบบพิสูจน์แล้วว่าไม่มีศาสตร์ใดพยากรณ์เกินระดับสุ่ม (708 งวด)",
    }
