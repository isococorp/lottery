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


def test_catalog_has_21_vicha():
    r = client.get("/schools")
    assert r.status_code == 200
    c = r.json()
    assert c["total_vicha"] == 21
    assert c["summary"] == {"production": 18, "backlog": 2, "discipline": 1}
    # Every backlog vicha is named and honestly not-available (no mock numbers).
    for v in c["backlog"]:
        assert v["name"] and v["status"] != "PRODUCTION"


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
    assert schools["ดวงจีน"]["bottom2"]["hits"] == 20
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
