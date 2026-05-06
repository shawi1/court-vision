"""Verify the play schema's NamedLocation enum covers what the few-shots use."""
from __future__ import annotations

import json

from app.prompts.few_shots import FEW_SHOTS
from app.schemas import NamedLocation


_LOCATION_KEYS: dict[str, tuple[str, ...]] = {
    # only the keys on each action type that hold a CourtLocation
    "move":    ("to",),
    "screen":  ("location",),
    "cut":     ("from", "to"),
    "pass":    (),                # from/to are player ids
    "dribble": ("to",),
    "handoff": ("location",),     # from/to are player ids
    "shot":    ("from",),
}


def _all_locations_in_shot(shot: dict) -> list[str]:
    locs: list[str] = []
    for p in shot["players"]:
        loc = p["startPosition"]
        if isinstance(loc, str):
            locs.append(loc)
    for a in shot["actions"]:
        for key in _LOCATION_KEYS.get(a["t"], ()):
            v = a.get(key)
            if isinstance(v, str):
                locs.append(v)
    return locs


def test_few_shot_locations_are_known() -> None:
    known = {nl.value for nl in NamedLocation}
    for shot in FEW_SHOTS:
        used = _all_locations_in_shot(shot["play_json"])
        unknown = [u for u in used if u not in known]
        assert not unknown, f"few-shot uses unknown locations: {unknown}"


def test_no_duplicate_location_values() -> None:
    values = [nl.value for nl in NamedLocation]
    assert len(values) == len(set(values))
