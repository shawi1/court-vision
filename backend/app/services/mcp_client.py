"""
nba_stats_mcp integration — server-side direct import.

Brandon's `nba_stats_mcp` is a remote MCP server (OAuth-protected, Streamable HTTP)
designed as a claude.ai connector. For Court Vision's backend we don't need the MCP
wire protocol — we import the underlying `NBAClient` and call `nba_api` endpoints
directly. Same caching / rate limiting / browser-headers, no OAuth dance.

If the package isn't installed (Sean hasn't cloned the MCP sibling yet, or the
`pip install -e ../nba_stats_mcp` step was skipped), every function returns a stub
so the rest of Court Vision keeps working.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Lazy-loaded singleton so import-time failures don't crash the backend.
_nba_client: Any | None = None
_nba_available: bool | None = None


def _ensure_client() -> Any | None:
    global _nba_client, _nba_available
    if _nba_available is False:
        return None
    if _nba_client is not None:
        return _nba_client
    try:
        from nba_stats_mcp.nba_client import NBAClient  # type: ignore
        _nba_client = NBAClient(timeout=30.0, max_rps=1.0)
        _nba_available = True
        logger.info("nba_stats_mcp NBAClient initialized")
    except Exception as e:
        _nba_available = False
        logger.warning("nba_stats_mcp not available (%s) — scouting falls back to stub", e)
    return _nba_client


def available() -> bool:
    """True when the nba_stats_mcp package is installed and importable."""
    _ensure_client()
    return _nba_available is True


# ---- helpers ----

def _lookup_player(name: str) -> dict[str, Any] | None:
    """Return the first nba_api static-data match for a player name, or None."""
    if not available():
        return None
    try:
        from nba_api.stats.static import players  # type: ignore
        matches = players.find_players_by_full_name(name.strip())
        if not matches:
            last = name.strip().split()[-1]
            matches = [
                p for p in players.get_players()
                if last.lower() in p.get("last_name", "").lower()
            ]
        return matches[0] if matches else None
    except Exception as e:
        logger.warning("find_player(%r) failed: %s", name, e)
        return None


def _player_splits(player_id: int) -> dict[str, Any]:
    """Pull season splits for a player. Returns {} on failure."""
    client = _ensure_client()
    if not client:
        return {}
    try:
        from nba_api.stats.endpoints import playerdashboardbygeneralsplits  # type: ignore
        from nba_stats_mcp.tools._helpers import (  # type: ignore
            normalize_records, normalize_season, normalize_season_type, first_result,
        )
        season_n = normalize_season(None)
        st = normalize_season_type("Regular Season")
        ep = client.call(
            playerdashboardbygeneralsplits.PlayerDashboardByGeneralSplits,
            cache_key=f"cv:psplit:{player_id}:{season_n}",
            cache_ttl=900,
            player_id=player_id,
            season=season_n,
            season_type_playoffs=st,
        )
        records = normalize_records(ep)
        # first_result returns a list[dict]; flatten to the single row coaches care about.
        overall_list = first_result(records, "OverallPlayerDashboard")
        return {
            "overall": overall_list[0] if overall_list else None,
            "by_location": records.get("LocationPlayerDashboard", []),
            "by_win_loss": records.get("WinsLossesPlayerDashboard", []),
        }
    except Exception as e:
        logger.warning("player_splits(%d) failed: %s", player_id, e)
        return {"error": str(e)}


def _current_team(player_id: int) -> dict[str, Any] | None:
    """Resolve a player's current team via commonplayerinfo.

    player_game_log's TEAM_ID column is empty in current NBA stats responses;
    commonplayerinfo gives team_id + team_name + team_city directly. Cached 1h.
    """
    client = _ensure_client()
    if not client:
        return None
    try:
        from nba_api.stats.endpoints import commonplayerinfo  # type: ignore
        from nba_stats_mcp.tools._helpers import normalize_records  # type: ignore
        ep = client.call(
            commonplayerinfo.CommonPlayerInfo,
            cache_key=f"cv:cpi:{player_id}",
            cache_ttl=3600,
            player_id=player_id,
        )
        info = normalize_records(ep).get("CommonPlayerInfo", [])
        if not info:
            return None
        row = info[0]
        tid = row.get("TEAM_ID")
        if not tid:
            return None
        return {
            "team_id": int(tid),
            "team_name": row.get("TEAM_NAME"),
            "team_city": row.get("TEAM_CITY"),
            "team_abbreviation": row.get("TEAM_ABBREVIATION"),
            "position": row.get("POSITION"),
            "jersey": row.get("JERSEY"),
        }
    except Exception as e:
        logger.warning("_current_team(%d) failed: %s", player_id, e)
    return None


def _team_lineups(team_id: int, top_n: int = 5) -> list[dict[str, Any]]:
    """Top-N most-used 5-man lineups for a team this season. [] on failure."""
    client = _ensure_client()
    if not client:
        return []
    try:
        from nba_api.stats.endpoints import leaguedashlineups  # type: ignore
        from nba_stats_mcp.tools._helpers import (  # type: ignore
            normalize_records, normalize_season, normalize_season_type,
        )
        season_n = normalize_season(None)
        st = normalize_season_type("Regular Season")
        ep = client.call(
            leaguedashlineups.LeagueDashLineups,
            cache_key=f"cv:lineups:{team_id}:{season_n}",
            cache_ttl=900,
            season=season_n,
            season_type_all_star=st,
            group_quantity=5,
            per_mode_detailed="Per100Possessions",
            measure_type_detailed_defense="Base",
            team_id_nullable=team_id,
        )
        records = normalize_records(ep)
        rows = records.get("Lineups", [])
        rows.sort(key=lambda r: r.get("MIN") or 0, reverse=True)
        return rows[:top_n]
    except Exception as e:
        logger.warning("team_lineups(%d) failed: %s", team_id, e)
        return []


# ---- public API used by routes/scout.py ----

def fetch_scouting_context(lineup: list[str]) -> dict[str, Any]:
    """Look up the given players + pull per-player splits and the team's top lineups.

    Returns a structure suitable for embedding into a Claude scouting prompt.
    Failures are degraded gracefully — caller always gets a valid dict.
    """
    if not available():
        return {
            "lineup": lineup,
            "mock": True,
            "note": "nba_stats_mcp not installed — install it as a sibling repo + `pip install -e ../nba_stats_mcp`",
        }

    players_data: list[dict[str, Any]] = []
    team_id_votes: dict[int, int] = {}

    for name in lineup:
        match = _lookup_player(name)
        if not match:
            players_data.append({"name": name, "found": False})
            continue
        pid = match["id"]
        splits = _player_splits(pid)
        team = _current_team(pid) or {}
        tid = team.get("team_id")
        if tid:
            team_id_votes[tid] = team_id_votes.get(tid, 0) + 1
        players_data.append({
            "name": name,
            "found": True,
            "player_id": pid,
            "full_name": match["full_name"],
            "is_active": match.get("is_active", False),
            "team_id": tid,
            "team_name": team.get("team_name"),
            "team_abbreviation": team.get("team_abbreviation"),
            "position": team.get("position"),
            "splits_overall": splits.get("overall"),
            "splits_by_win_loss": splits.get("by_win_loss"),
        })

    team_id = max(team_id_votes, key=team_id_votes.get) if team_id_votes else None
    lineups = _team_lineups(team_id) if team_id else []

    return {
        "lineup_input": lineup,
        "mock": False,
        "primary_team_id": team_id,
        "players": players_data,
        "top_team_lineups": lineups,
    }
