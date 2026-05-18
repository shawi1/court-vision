"""GET /roster?team=<abbr> — current team roster from nba_stats_mcp.

Returns the team's active players sorted alphabetically. Frontend uses this to
populate the scouting panel's lineup with a real, current roster instead of
a hardcoded list that goes stale every trade.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services import mcp_client

router = APIRouter()


class RosterPlayer(BaseModel):
    name: str
    position: str | None = None
    jersey: str | None = None
    height: str | None = None


class RosterResponse(BaseModel):
    team: str
    team_id: int | None = None
    full_name: str | None = None
    players: list[RosterPlayer]
    # Starters from the team's most recent game (BoxScoreTraditionalV2 filtered
    # by START_POSITION). Length 5 in the common case; empty if the team has
    # no recent games or the boxscore lookup failed — the frontend should fall
    # back to its own slice of `players` in that case.
    starters: list[RosterPlayer] = []
    source: str  # "nba_stats_mcp" | "stub"


@router.get("/roster", response_model=RosterResponse)
def roster_endpoint(team: str = Query(..., description="3-letter team abbreviation (GSW, LAL, BOS, ...)")) -> RosterResponse:
    if not mcp_client.available():
        raise HTTPException(503, "nba_stats_mcp not available")

    # Resolve abbreviation → team_id via nba_api static data
    try:
        from nba_api.stats.static import teams  # type: ignore
        match = teams.find_team_by_abbreviation(team.upper())
    except Exception as e:
        raise HTTPException(500, f"team lookup failed: {e}")
    if not match:
        raise HTTPException(404, f"no team found for abbreviation {team!r}")

    team_id = match["id"]
    full_name = match["full_name"]

    # Pull live roster via leaguedashlineups → fall back to team_roster
    try:
        from nba_api.stats.endpoints import commonteamroster  # type: ignore
        from nba_stats_mcp.tools._helpers import (  # type: ignore
            normalize_records, normalize_season,
        )
        client = mcp_client._ensure_client()
        season_n = normalize_season(None)
        ep = client.call(
            commonteamroster.CommonTeamRoster,
            cache_key=f"cv:roster:{team_id}:{season_n}",
            cache_ttl=3600,
            team_id=team_id,
            season=season_n,
        )
        rows: list[dict[str, Any]] = normalize_records(ep).get("CommonTeamRoster", [])
    except Exception as e:
        raise HTTPException(502, f"roster fetch failed: {e}")

    players = [
        RosterPlayer(
            name=str(r.get("PLAYER", "")).strip(),
            position=r.get("POSITION") or None,
            jersey=str(r.get("NUM")) if r.get("NUM") is not None else None,
            height=r.get("HEIGHT") or None,
        )
        for r in rows
        if r.get("PLAYER")
    ]
    players.sort(key=lambda p: p.name)

    # Cross-reference the season's top 5-man unit with roster rows so the UI
    # gets the same name/position/jersey/height fields as `players`.
    roster_by_pid: dict[int, dict[str, Any]] = {
        int(r["PLAYER_ID"]): r for r in rows if r.get("PLAYER_ID") is not None
    }
    starter_ids = mcp_client.season_top_starting_lineup(team_id)
    starters: list[RosterPlayer] = []
    for pid in starter_ids:
        roster_row = roster_by_pid.get(pid)
        if roster_row is None:
            # Could happen if a starter was traded mid-season — skip.
            continue
        starters.append(RosterPlayer(
            name=str(roster_row.get("PLAYER", "")).strip(),
            position=roster_row.get("POSITION") or None,
            jersey=str(roster_row.get("NUM")) if roster_row.get("NUM") is not None else None,
            height=roster_row.get("HEIGHT") or None,
        ))

    return RosterResponse(
        team=team.upper(),
        team_id=team_id,
        full_name=full_name,
        players=players,
        starters=starters,
        source="nba_stats_mcp",
    )
