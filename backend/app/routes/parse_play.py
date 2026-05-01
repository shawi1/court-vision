"""POST /parse-play — transcript → play schema."""
from __future__ import annotations

from fastapi import APIRouter

from app.schemas import ParsePlayRequest, ParsePlayResponse
from app.services.anthropic_client import parse_play_via_claude

router = APIRouter()


@router.post("/parse-play", response_model=ParsePlayResponse)
async def parse_play_endpoint(req: ParsePlayRequest) -> ParsePlayResponse:
    play = parse_play_via_claude(req.transcript, hint=req.hint)
    return ParsePlayResponse(play=play, transcript=req.transcript)
