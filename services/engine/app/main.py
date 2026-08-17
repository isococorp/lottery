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
from .backtest import export as export_mod
from .protocol import v5_gate
from .schools import catalog as catalog_mod

app = FastAPI(title="Tianming Lottery Analyzer — Engine", version="1.0.0")


class PredictRequest(BaseModel):
    date: str = Field(..., examples=["2026-08-16"])
    time: str = Field("16:00", examples=["16:00"])


class BacktestRequest(BaseModel):
    mode: str = Field("permutation", pattern="^(permutation|exact)$")


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
    try:
        results = service.get_backtest(req.mode)
        report = store.get_report()
    except Exception as e:
        raise HTTPException(503, f"data unavailable: {e}")
    gate = v5_gate.gate_numeric_payload(
        has_numbers=True, backtest_attached=True,
        beats_random=any(sb.bottom2.beats_random or sb.set3.beats_random for sb in results),
        data_graded_ok=report.grade in ("A", "B", "C"),
    ).as_dict()
    baselines = service.get_baselines(req.mode)  # §4.21.6 / §4.21.10
    return {
        "mode": req.mode,
        "date_range": [str(report.date_min), str(report.date_max)],
        "n_draws": report.total_rows,
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
    try:
        models = service.get_ml(req.mode)
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
