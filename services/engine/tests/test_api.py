"""API + export smoke tests. Skips if the data file isn't mounted."""
import io
import os

import pytest
from fastapi.testclient import TestClient

from app.main import app

DATA = os.environ.get("TIANMING_DATA_XLSX", "/data/thai.xlsx")
client = TestClient(app)
needs_data = pytest.mark.skipif(not os.path.exists(DATA), reason="data not mounted")


def test_health():
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_catalog_has_19_vicha():
    # §4.13/4.14 were removed from the project (spec forbids deterministic modules).
    r = client.get("/schools")
    assert r.status_code == 200
    c = r.json()
    assert c["total_vicha"] == 19
    assert c["summary"] == {"production": 18, "backlog": 0, "discipline": 1}
    assert c["backlog"] == []
    # No removed vicha lingers anywhere in the catalog.
    codes = {v["code"] for v in c["production"]} | {c["discipline"]["code"]}
    assert "4.13" not in codes and "4.14" not in codes


@needs_data
def test_hit_summary_endpoint():
    r = client.get("/hit-summary")
    assert r.status_code == 200
    body = r.json()
    assert body["n_draws"] == 708
    assert len(body["schools"]) == 18
    for s in body["schools"]:
        for pos in ("top3", "top2", "bottom2", "set3"):
            p = s[pos]
            assert p["exact"] + p["swapped"] <= p["n"]


@needs_data
def test_predict_carries_warning_and_evidence():
    r = client.post("/predict", json={"date": "2026-08-16", "time": "16:00"})
    assert r.status_code == 200
    body = r.json()
    assert body["pillars"]["day"]["gz"] == "壬戌"
    assert len(body["schools"]) == 18  # 5 original + 13 approved additions
    assert body["v5"]["warning"]  # §0 mandatory warning attached
    assert body["backtest_summary"]           # evidence attached
    assert body["v5"]["confidence"] == "NONE"  # nothing beats random
    # No banned wording leaked into the payload.
    assert body["v5"]["banned_found"] == []


@needs_data
def test_backtest_endpoint_matches_reference():
    r = client.post("/backtest", json={"mode": "permutation"})
    assert r.status_code == 200
    schools = {s["name"]: s for s in r.json()["schools"]}
    assert schools["ดวงจีน"]["bottom2"]["hits"] == 17  # 小雪 year rule (was 20 under 立春)
    assert schools["สถิติ WF"]["bottom2"]["n"] == 608


@needs_data
def test_export_is_valid_xlsx_ascii_name():
    r = client.get("/backtest/export?mode=permutation")
    assert r.status_code == 200
    cd = r.headers["content-disposition"]
    fname = cd.split('filename="')[1].rstrip('"')
    assert fname.isascii() and fname.endswith(".xlsx")
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(r.content))
    assert wb.sheetnames == ["Summary", "Detail", "Method"]
