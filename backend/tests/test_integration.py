"""End-to-end integration tests in mock mode.

Exercises the full pipeline a user takes through the app:
    multipart audio -> /transcribe -> text -> /parse-play -> play JSON -> /scout

Verifies the responses are well-formed and connect (e.g., the parse-play accepts
whatever transcribe spat out).
"""
from __future__ import annotations

import io
import os

from fastapi.testclient import TestClient


def _client() -> TestClient:
    os.environ["COURT_VISION_MOCK"] = "1"
    from app.main import app
    return TestClient(app)


def test_full_voice_to_play_chain() -> None:
    client = _client()

    # 1. mock transcribe — returns a Horns-flavored transcript in mock mode
    fake_audio = io.BytesIO(b"not-a-real-audio-file-just-for-routing")
    r = client.post(
        "/transcribe",
        files={"audio": ("audio.m4a", fake_audio, "audio/m4a")},
    )
    assert r.status_code == 200, r.text
    transcript = r.json()["text"]
    assert "Horns" in transcript

    # 2. feed the transcript into /parse-play — should pick the Horns mock
    r = client.post("/parse-play", json={"transcript": transcript})
    assert r.status_code == 200, r.text
    body = r.json()
    play = body["play"]
    assert play["schemaVersion"] == "0.2"
    assert "Horns" in play["meta"]["name"]
    # Echo check: the transcript made it back so the client can display it.
    assert body["transcript"] == transcript


def test_play_types_round_trip_through_api() -> None:
    """Each demo transcript variety should produce a distinguishable mock."""
    client = _client()
    cases = [
        ("Spread floor, hammer screen weak side", "Hammer"),
        ("Spain action, 5 ball screens for 1", "Spain"),
        ("BLOB, box set", "BLOB"),
        ("SLOB, stack on the strong side", "SLOB"),
        ("Horns flare with 5 slipping", "Horns"),
    ]
    seen_names: set[str] = set()
    for transcript, expected_marker in cases:
        r = client.post("/parse-play", json={"transcript": transcript})
        assert r.status_code == 200
        name = r.json()["play"]["meta"]["name"]
        seen_names.add(name)
        assert expected_marker in name, f"{transcript!r} → {name!r}, expected to contain {expected_marker!r}"
    # The five transcripts should produce at least 4 distinct mock plays (BLOB/SLOB
    # share format but not name; Horns/Hammer/Spain are all distinct)
    assert len(seen_names) >= 4


def test_scout_chain_returns_summary_and_mock_flag() -> None:
    client = _client()
    r = client.post("/scout", json={
        "lineup": [
            {"name": "Curry", "role": "PG"},
            {"name": "Thompson", "role": "SG"},
            {"name": "Wiggins", "role": "SF"},
            {"name": "Green", "role": "PF"},
            {"name": "Looney", "role": "C"},
        ],
        "opponent_lineup": [
            {"name": "Doncic", "role": "PG"},
            {"name": "Irving", "role": "SG"},
            {"name": "Hardaway", "role": "SF"},
            {"name": "Washington", "role": "PF"},
            {"name": "Gafford", "role": "C"},
        ],
    })
    assert r.status_code == 200
    body = r.json()
    assert body["mock"] is True
    assert "Curry" in body["summary"]  # echoed prompt should contain lineup
    assert "Doncic" in body["summary"]  # echoed prompt should contain opponent
