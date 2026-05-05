"""Quick smoke test for the nba_stats_mcp integration."""
from __future__ import annotations

import json
import sys

# allow `python backend/scripts/smoke_mcp.py` from the repo root
sys.path.insert(0, ".")

# Windows console is cp1252 by default; nba_api returns unicode (middle dots in
# lineup GROUP_NAME, accented player names, etc.). Force UTF-8 stdout.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

from app.services import mcp_client  # noqa: E402


def main() -> None:
    print("available:", mcp_client.available())

    lineup = ["Stephen Curry", "Draymond Green", "Andrew Wiggins"]
    ctx = mcp_client.fetch_scouting_context(lineup)

    print("mock:", ctx["mock"])
    print("primary_team_id:", ctx.get("primary_team_id"))
    print("top_lineups count:", len(ctx.get("top_team_lineups", [])))

    if ctx.get("top_team_lineups"):
        top = ctx["top_team_lineups"][0]
        print("top lineup GROUP_NAME:", top.get("GROUP_NAME"))
        print(
            "top lineup MIN:", top.get("MIN"),
            "NET_RATING:", top.get("NET_RATING"),
            "OFF_RATING:", top.get("OFF_RATING"),
            "DEF_RATING:", top.get("DEF_RATING"),
        )

    for p in ctx["players"]:
        if not p["found"]:
            print(f"  MISSING: {p['name']}")
            continue
        ovr = p.get("splits_overall") or {}
        print(
            f"  {p['full_name']}: pid={p['player_id']} team={p['team_id']} "
            f"GP={ovr.get('GP')} PTS={ovr.get('PTS')} FG_PCT={ovr.get('FG_PCT')}"
        )


if __name__ == "__main__":
    main()
