"""Debug what player_game_log returns so we can extract team_id reliably."""
from __future__ import annotations

import sys
sys.path.insert(0, ".")

import logging
logging.basicConfig(level=logging.DEBUG)

from nba_stats_mcp.nba_client import NBAClient
from nba_api.stats.endpoints import playergamelog, commonplayerinfo
from nba_stats_mcp.tools._helpers import (
    normalize_records, normalize_season, normalize_season_type,
)


def main() -> None:
    client = NBAClient(timeout=30.0, max_rps=1.0)
    pid = 201939  # Curry
    season_n = normalize_season(None)
    st = normalize_season_type("Regular Season")
    print(f"--- player_game_log({pid}, season={season_n}, st={st}) ---")
    try:
        ep = client.call(
            playergamelog.PlayerGameLog,
            cache_key=f"dbg:plog:{pid}:{season_n}",
            cache_ttl=900,
            player_id=pid,
            season=season_n,
            season_type_all_star=st,
        )
        records = normalize_records(ep)
        print("result set names:", list(records.keys()))
        games = records.get("PlayerGameLog", [])
        print(f"games count: {len(games)}")
        if games:
            print("first game keys:", list(games[0].keys())[:15])
            print("first game TEAM_ID:", games[0].get("TEAM_ID"))
            print("first game MATCHUP:", games[0].get("MATCHUP"))
    except Exception as e:
        print(f"player_game_log failed: {e!r}")

    print()
    print("--- commonplayerinfo as fallback ---")
    try:
        ep2 = client.call(
            commonplayerinfo.CommonPlayerInfo,
            cache_key=f"dbg:cpi:{pid}",
            cache_ttl=3600,
            player_id=pid,
        )
        records = normalize_records(ep2)
        print("result set names:", list(records.keys()))
        info = records.get("CommonPlayerInfo", [])
        if info:
            print("TEAM_ID:", info[0].get("TEAM_ID"))
            print("TEAM_NAME:", info[0].get("TEAM_NAME"))
            print("TEAM_CITY:", info[0].get("TEAM_CITY"))
    except Exception as e:
        print(f"commonplayerinfo failed: {e!r}")


if __name__ == "__main__":
    main()
