"""
Few-shot examples for /parse-play. Each pair is a realistic coach transcript paired with
the expected play schema JSON. These are injected into the Claude prompt as
prior turn user/assistant messages.

These will be refined / expanded after docs/vocabulary.md research completes.
"""
from __future__ import annotations

from typing import TypedDict


class FewShot(TypedDict):
    transcript: str
    play_json: dict


# Coach jargon style — short, choppy, mid-thought as if speaking into a recorder.
FEW_SHOTS: list[FewShot] = [
    {
        "transcript": (
            "Okay, Horns. 1 brings it up, 4 and 5 set up at the elbows, 2 in the left "
            "corner, 3 in the right. 1 dribbles to the right wing, 5 sets a ball screen, "
            "5 slips to the rim. 1 hits 4 popping to the top. 4 swings to 3. "
            "If they switch the ball screen, 5 re-screens for 1 going middle."
        ),
        "play_json": {
            "schemaVersion": "0.2",
            "meta": {"name": "Horns Slip", "situation": "halfCourtSet"},
            "players": [
                {"id": "P1", "role": "PG", "startPosition": "topOfKey"},
                {"id": "P2", "role": "SG", "startPosition": "leftCorner"},
                {"id": "P3", "role": "SF", "startPosition": "rightCorner"},
                {"id": "P4", "role": "PF", "startPosition": "leftElbow"},
                {"id": "P5", "role": "C",  "startPosition": "rightElbow"},
            ],
            "initialFormation": "horns",
            "actions": [
                {"t": "dribble", "actor": "P1", "to": "rightWing", "tick": 0},
                {"t": "screen",  "screener": "P5", "screenee": "P1",
                 "screenType": "slip", "location": "rightWing", "tick": 1},
                {"t": "cut",     "actor": "P5", "cutType": "basket",
                 "from": "rightWing", "to": "rim", "tick": 1},
                {"t": "move",    "actor": "P4", "to": "topOfKey", "tick": 2},
                {"t": "pass",    "from": "P1", "to": "P4", "tick": 3},
                {"t": "pass",    "from": "P4", "to": "P3", "tick": 4},
            ],
            "counters": [
                {
                    "trigger": "if they switch the ball screen",
                    "actions": [
                        {"t": "screen", "screener": "P5", "screenee": "P1",
                         "screenType": "reScreen", "location": "rightWing", "tick": 0},
                        {"t": "dribble", "actor": "P1", "to": "nail", "tick": 1},
                    ],
                },
            ],
        },
    },
    {
        "transcript": (
            "BLOB, box set. 5 is the inbounder. 1 in the left corner, 2 right corner, "
            "3 left elbow, 4 right elbow. On the slap, 3 down-screens for 1, 1 curls to "
            "the wing for the shot. 4 sets a back screen for 5 stepping in after the pass."
        ),
        "play_json": {
            "schemaVersion": "0.2",
            "meta": {
                "name": "Box Curl",
                "situation": "BLOB",
                "trigger": {"type": "slap", "actor": "P5", "description": "inbounder slaps the ball"},
            },
            "players": [
                {"id": "P1", "role": "PG", "startPosition": "leftCorner"},
                {"id": "P2", "role": "SG", "startPosition": "rightCorner"},
                {"id": "P3", "role": "SF", "startPosition": "leftElbow"},
                {"id": "P4", "role": "PF", "startPosition": "rightElbow"},
                {"id": "P5", "role": "C",  "startPosition": "baselineInbound", "isInbounder": True},
            ],
            "initialFormation": "box",
            "actions": [
                {"t": "screen", "screener": "P3", "screenee": "P1",
                 "screenType": "downScreen", "location": "leftElbow", "tick": 0},
                {"t": "cut",    "actor": "P1", "cutType": "curl",
                 "from": "leftCorner", "to": "leftWing", "tick": 1},
                {"t": "pass",   "from": "P5", "to": "P1", "tick": 2},
                {"t": "screen", "screener": "P4", "screenee": "P5",
                 "screenType": "backScreen", "location": "rightElbow", "tick": 2},
                {"t": "cut",    "actor": "P5", "cutType": "basket",
                 "from": "baselineInbound", "to": "rim", "tick": 3},
            ],
        },
    },
]
