"""POST /scout — lineup → scouting summary (Claude + nba_stats_mcp)."""
from __future__ import annotations

from fastapi import APIRouter

from app.config import get_settings
from app.schemas import ScoutRequest, ScoutResponse
from app.services import mcp_client
from app.services.anthropic_client import scout_via_claude

router = APIRouter()


@router.post("/scout", response_model=ScoutResponse)
async def scout_endpoint(req: ScoutRequest) -> ScoutResponse:
    names = [p.name for p in req.lineup]
    context = mcp_client.fetch_scouting_context(names)
    opp = (
        ", ".join(p.name for p in req.opponent_lineup)
        if req.opponent_lineup else "(no opponent specified)"
    )
    question = req.question or (
        "Give the coach a concise scouting report for the current 5-man unit "
        "on offense. Highlight strengths to attack, weaknesses to hide, and any "
        "matchups worth exploiting. Use the supplied stats — don't invent numbers."
    )
    prompt = (
        f"Lineup: {', '.join(names)}\n"
        f"Opponent on the floor: {opp}\n\n"
        f"Question: {question}\n\n"
        f"Stats context (real data when available):\n{context}"
    )
    text = scout_via_claude(prompt)

    bullets: list[str] = []
    for line in text.splitlines():
        line = line.strip()
        if line.startswith(("- ", "* ", "• ")):
            bullets.append(line.lstrip("-*• ").strip())

    # `mock` here means "no real Claude synthesis happened" (no API key).
    # Stats may still be real (from nba_stats_mcp) even when Claude is mock.
    settings = get_settings()
    no_claude = settings.mock_mode or not settings.has_anthropic
    data_source = "nba_stats_mcp" if mcp_client.available() and not context.get("mock", False) else "stub"
    return ScoutResponse(
        summary=text, bullets=bullets, mock=no_claude, data_source=data_source,
    )
