"""End-to-end /parse-play tests in mock mode."""
from __future__ import annotations

import os

from fastapi.testclient import TestClient


def _client() -> TestClient:
    os.environ["COURT_VISION_MOCK"] = "1"
    from app.main import app
    return TestClient(app)


def test_healthz() -> None:
    client = _client()
    r = client.get("/healthz")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["mock_mode"] is True


def test_parse_play_mock_returns_valid_schema() -> None:
    client = _client()
    r = client.post("/parse-play", json={
        "transcript": "Horns set, 1 brings it up, 5 sets a ball screen and slips.",
    })
    assert r.status_code == 200, r.text
    play = r.json()["play"]
    assert play["schemaVersion"] == "0.2"
    assert len(play["players"]) == 5
    assert any(a["t"] == "screen" for a in play["actions"])


def test_parse_play_blob_detection() -> None:
    client = _client()
    r = client.post("/parse-play", json={
        "transcript": "BLOB, box set, 5 is the inbounder, slap and go.",
    })
    assert r.status_code == 200
    play = r.json()["play"]
    assert play["meta"]["situation"] == "BLOB"
    assert any(p.get("isInbounder") for p in play["players"])
    # v0.2: BLOB mock should set a slap trigger
    assert play["meta"]["trigger"]["type"] == "slap"


def test_parse_play_picks_hammer_mock() -> None:
    client = _client()
    r = client.post("/parse-play", json={
        "transcript": "Run hammer — 1 attacks baseline, 4 sets a back screen weak side for 3.",
    })
    assert r.status_code == 200
    play = r.json()["play"]
    assert "Hammer" in play["meta"]["name"]
    assert any(a.get("screenType") == "hammer" for a in play["actions"])


def test_parse_play_picks_spain_mock() -> None:
    client = _client()
    r = client.post("/parse-play", json={
        "transcript": "Spain PnR — 5 screens for 1, 3 back-picks 5's man and pops.",
    })
    assert r.status_code == 200
    play = r.json()["play"]
    assert "Spain" in play["meta"]["name"]
    assert any(a.get("screenType") == "spain" for a in play["actions"])
    assert len(play["counters"]) >= 1


def test_scout_mock() -> None:
    client = _client()
    r = client.post("/scout", json={
        "lineup": [
            {"name": "Curry", "role": "PG"},
            {"name": "Thompson", "role": "SG"},
            {"name": "Wiggins", "role": "SF"},
            {"name": "Green", "role": "PF"},
            {"name": "Looney", "role": "C"},
        ],
    })
    assert r.status_code == 200
    body = r.json()
    assert "summary" in body
    assert body["mock"] is True
