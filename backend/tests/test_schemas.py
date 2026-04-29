"""Round-trip tests for the play schema."""
from __future__ import annotations

import json

import pytest

from app.prompts.few_shots import FEW_SHOTS
from app.schemas import PlaySchema, NamedLocation, ScreenType


def test_horns_slip_few_shot_validates() -> None:
    play = PlaySchema.model_validate(FEW_SHOTS[0]["play_json"])
    assert play.schemaVersion == "0.2"
    assert play.meta.situation.value == "halfCourtSet"
    assert len(play.players) == 5
    screens = [a for a in play.actions if a.t == "screen"]
    assert any(s.screenType == ScreenType.SLIP for s in screens)
    # v0.2: horns slip few-shot includes a switch counter
    assert len(play.counters) == 1
    assert "switch" in play.counters[0].trigger


def test_blob_box_curl_few_shot_validates() -> None:
    play = PlaySchema.model_validate(FEW_SHOTS[1]["play_json"])
    assert play.meta.situation.value == "BLOB"
    inbounders = [p for p in play.players if p.isInbounder]
    assert len(inbounders) == 1
    assert inbounders[0].id == "P5"
    # v0.2: BLOB few-shot has a slap trigger
    assert play.meta.trigger is not None
    assert play.meta.trigger.type.value == "slap"
    assert play.meta.trigger.actor == "P5"


def test_all_few_shots_roundtrip_json() -> None:
    for shot in FEW_SHOTS:
        play = PlaySchema.model_validate(shot["play_json"])
        as_json = play.model_dump_json(by_alias=True)
        reparsed = PlaySchema.model_validate(json.loads(as_json))
        assert reparsed.model_dump(by_alias=True) == play.model_dump(by_alias=True)


def test_must_have_exactly_five_players() -> None:
    bad = dict(FEW_SHOTS[0]["play_json"])
    bad["players"] = bad["players"][:4]
    with pytest.raises(Exception):
        PlaySchema.model_validate(bad)


def test_named_location_round_trips_as_string() -> None:
    play = PlaySchema.model_validate(FEW_SHOTS[0]["play_json"])
    payload = json.loads(play.model_dump_json(by_alias=True))
    assert payload["players"][0]["startPosition"] == "topOfKey"
    assert NamedLocation.TOP_OF_KEY.value == "topOfKey"
