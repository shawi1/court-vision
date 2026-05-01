"""
Anthropic client wrapper. Handles structured-output enforcement for /parse-play
via JSON-schema tool use, and a simpler text response for /scout.

Falls back to mock responses if no API key is configured.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from app.config import get_settings
from app.prompts.few_shots import FEW_SHOTS
from app.prompts.vocabulary_prompt import build_system_prompt
from app.schemas import PlaySchema

logger = logging.getLogger(__name__)

CLAUDE_MODEL = "claude-opus-4-7"
SCOUT_MODEL = "claude-sonnet-4-6"

PLAY_TOOL_NAME = "emit_play"
PLAY_TOOL_DESCRIPTION = (
    "Emit the structured Court Vision play schema for the coach's described play. "
    "This is the ONLY way to respond. Do not produce free-form text."
)


def _play_tool_schema() -> dict[str, Any]:
    """Build a JSON-schema input_schema for Claude's tool-use structured output."""
    schema = PlaySchema.model_json_schema(by_alias=True)
    schema.setdefault("$defs", schema.pop("definitions", {}))
    return schema


def _build_messages(transcript: str, hint: str | None) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    for shot in FEW_SHOTS:
        messages.append({"role": "user", "content": shot["transcript"]})
        messages.append({
            "role": "assistant",
            "content": [{
                "type": "tool_use",
                "id": f"few_shot_{abs(hash(shot['transcript'])) % 10_000_000}",
                "name": PLAY_TOOL_NAME,
                "input": shot["play_json"],
            }],
        })
        messages.append({
            "role": "user",
            "content": [{
                "type": "tool_result",
                "tool_use_id": f"few_shot_{abs(hash(shot['transcript'])) % 10_000_000}",
                "content": "OK",
            }],
        })
    user_msg = transcript if not hint else f"[Hint: {hint}]\n\n{transcript}"
    messages.append({"role": "user", "content": user_msg})
    return messages


def parse_play_via_claude(transcript: str, hint: str | None = None) -> PlaySchema:
    """Call Claude with structured output to produce a play schema."""
    settings = get_settings()
    if settings.mock_mode or not settings.has_anthropic:
        return _mock_play(transcript)

    from anthropic import Anthropic  # imported lazily so mock-only setups don't need the package

    client = Anthropic(api_key=settings.anthropic_api_key)
    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=4096,
        system=build_system_prompt(),
        tools=[{
            "name": PLAY_TOOL_NAME,
            "description": PLAY_TOOL_DESCRIPTION,
            "input_schema": _play_tool_schema(),
        }],
        tool_choice={"type": "tool", "name": PLAY_TOOL_NAME},
        messages=_build_messages(transcript, hint),
    )

    for block in response.content:
        if getattr(block, "type", None) == "tool_use" and block.name == PLAY_TOOL_NAME:
            return PlaySchema.model_validate(block.input)

    raise RuntimeError(f"Claude did not return a tool_use block; got: {response.content!r}")


def scout_via_claude(prompt: str, mcp_tools: list[dict[str, Any]] | None = None) -> str:
    """Plain text scouting summary; MCP tools may be attached when available."""
    settings = get_settings()
    if settings.mock_mode or not settings.has_anthropic:
        return _mock_scout(prompt)

    from anthropic import Anthropic

    client = Anthropic(api_key=settings.anthropic_api_key)
    kwargs: dict[str, Any] = dict(
        model=SCOUT_MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    if mcp_tools:
        kwargs["tools"] = mcp_tools
    response = client.messages.create(**kwargs)
    parts = [b.text for b in response.content if getattr(b, "type", None) == "text"]
    return "\n\n".join(parts).strip()


# ---- mocks ----

def _mock_play(transcript: str) -> PlaySchema:
    """Mock that picks among a few canned plays based on transcript keywords.

    Not a parser — just enough variety to exercise the frontend through different
    situations (ATO half-court, BLOB, SLOB, hammer, Spain) before real keys are wired.
    """
    logger.info("parse_play: returning MOCK response (no API key or mock mode)")
    t = transcript.lower()
    if "blob" in t or "baseline out" in t or "inbound" in t and "baseline" in t:
        return _mock_blob_box_curl()
    if "slob" in t or "sideline out" in t:
        return _mock_slob_stack()
    if "hammer" in t:
        return _mock_hammer()
    if "spain" in t:
        return _mock_spain()
    return _mock_horns_slip()


def _mock_horns_slip() -> PlaySchema:
    return PlaySchema.model_validate({
        "schemaVersion": "0.2",
        "meta": {"name": "Mock Horns Slip", "situation": "halfCourtSet"},
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
            {"t": "screen", "screener": "P5", "screenee": "P1",
             "screenType": "slip", "location": "rightWing", "tick": 1},
            {"t": "cut", "actor": "P5", "cutType": "basket",
             "from": "rightWing", "to": "rim", "tick": 1},
            {"t": "pass", "from": "P1", "to": "P5", "tick": 2},
            {"t": "shot", "actor": "P5", "from": "rim", "tick": 3},
        ],
        "counters": [
            {
                "trigger": "if the switch comes early",
                "actions": [
                    {"t": "move", "actor": "P4", "to": "topOfKey", "tick": 0},
                    {"t": "pass", "from": "P1", "to": "P4", "tick": 1},
                ],
            },
        ],
    })


def _mock_blob_box_curl() -> PlaySchema:
    return PlaySchema.model_validate({
        "schemaVersion": "0.2",
        "meta": {
            "name": "Mock BLOB Box Curl",
            "situation": "BLOB",
            "trigger": {"type": "slap", "actor": "P5"},
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
            {"t": "cut", "actor": "P1", "cutType": "curl",
             "from": "leftCorner", "to": "leftWing", "tick": 1},
            {"t": "pass", "from": "P5", "to": "P1", "tick": 2},
            {"t": "screen", "screener": "P4", "screenee": "P5",
             "screenType": "backScreen", "location": "rightElbow", "tick": 2},
            {"t": "cut", "actor": "P5", "cutType": "basket",
             "from": "baselineInbound", "to": "rim", "tick": 3},
        ],
    })


def _mock_slob_stack() -> PlaySchema:
    return PlaySchema.model_validate({
        "schemaVersion": "0.2",
        "meta": {
            "name": "Mock SLOB Stack",
            "situation": "SLOB",
            "trigger": {"type": "slap", "actor": "P1"},
        },
        "players": [
            {"id": "P1", "role": "PG", "startPosition": "sidelineInbound", "isInbounder": True},
            {"id": "P2", "role": "SG", "startPosition": "leftCorner"},
            {"id": "P3", "role": "SF", "startPosition": "leftWing"},
            {"id": "P4", "role": "PF", "startPosition": "leftBlock"},
            {"id": "P5", "role": "C",  "startPosition": "leftElbow"},
        ],
        "initialFormation": "stack",
        "actions": [
            {"t": "screen", "screener": "P5", "screenee": "P2",
             "screenType": "pinDown", "location": "leftBlock", "tick": 0},
            {"t": "cut", "actor": "P2", "cutType": "curl",
             "from": "leftCorner", "to": "topOfKey", "tick": 1},
            {"t": "pass", "from": "P1", "to": "P2", "tick": 2},
        ],
    })


def _mock_hammer() -> PlaySchema:
    return PlaySchema.model_validate({
        "schemaVersion": "0.2",
        "meta": {"name": "Mock Hammer", "situation": "halfCourtSet"},
        "players": [
            {"id": "P1", "role": "PG", "startPosition": "topOfKey"},
            {"id": "P2", "role": "SG", "startPosition": "rightCorner"},
            {"id": "P3", "role": "SF", "startPosition": "leftCorner"},
            {"id": "P4", "role": "PF", "startPosition": "leftBlock"},
            {"id": "P5", "role": "C",  "startPosition": "rightElbow"},
        ],
        "initialFormation": "spread",
        "actions": [
            {"t": "screen", "screener": "P5", "screenee": "P1",
             "screenType": "ballScreen", "location": "topOfKey", "tick": 0},
            {"t": "dribble", "actor": "P1", "to": "rightShortCorner", "tick": 1},
            {"t": "screen", "screener": "P4", "screenee": "P3",
             "screenType": "hammer", "location": "leftBlock", "tick": 2},
            {"t": "move", "actor": "P3", "to": "leftCorner", "tick": 2},
            {"t": "pass", "from": "P1", "to": "P3", "tick": 3},
            {"t": "shot", "actor": "P3", "from": "leftCorner", "tick": 4},
        ],
    })


def _mock_spain() -> PlaySchema:
    return PlaySchema.model_validate({
        "schemaVersion": "0.2",
        "meta": {"name": "Mock Spain PnR", "situation": "halfCourtSet"},
        "players": [
            {"id": "P1", "role": "PG", "startPosition": "topOfKey"},
            {"id": "P2", "role": "SG", "startPosition": "leftCorner"},
            {"id": "P3", "role": "SF", "startPosition": "rightCorner"},
            {"id": "P4", "role": "PF", "startPosition": "rightWing"},
            {"id": "P5", "role": "C",  "startPosition": "highPost"},
        ],
        "initialFormation": "custom",
        "actions": [
            {"t": "screen", "screener": "P5", "screenee": "P1",
             "screenType": "ballScreen", "location": "topOfKey", "tick": 0},
            {"t": "screen", "screener": "P3", "screenee": "P5",
             "screenType": "spain", "location": "highPost", "tick": 1},
            {"t": "cut", "actor": "P5", "cutType": "basket",
             "from": "highPost", "to": "rim", "tick": 2},
            {"t": "move", "actor": "P3", "to": "topOfKey", "tick": 2},
        ],
        "counters": [
            {
                "trigger": "if they tag the roller",
                "actions": [
                    {"t": "pass", "from": "P1", "to": "P3", "tick": 0},
                    {"t": "shot", "actor": "P3", "from": "topOfKey", "tick": 1},
                ],
            },
        ],
    })


def _mock_scout(prompt: str) -> str:
    return (
        "**Mock scouting report** (no Anthropic API key configured).\n\n"
        "Wire `ANTHROPIC_API_KEY` and the `nba_stats_mcp` server in `backend/.env` "
        "to enable real reports.\n\n"
        f"Echoed prompt:\n```\n{prompt[:400]}\n```"
    )


def play_to_dict(play: PlaySchema) -> dict[str, Any]:
    return json.loads(play.model_dump_json(by_alias=True))
